import { and, desc, eq, gte, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as s from "@db/schema";
import { DOC_FALTANTE } from "@contracts/catalogos";
import { esAbierto } from "@contracts/flujo";
import { DESTINO_DE, DIAS_ENTRE_BORRADORES, MOTIVO_LABEL, textoBorrador, type Motivo } from "@contracts/borradores";
import { adminQuery, createRouter, editorQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { assertEditable } from "../auth/alcance";
import { hoyISO, registrarEvento } from "../queries/siniestros";
import { listarSiniestros } from "./siniestros";
import { limitesSinRespuesta } from "./tablero";

const dias = (desde: string, hasta: string) => Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000);

/**
 * Revisa los siniestros abiertos y propone un mensaje donde hace falta: documentos que faltan,
 * información que pide la aseguradora, aseguradora sin respuesta o pago pendiente.
 * No repite un motivo mientras haya uno abierto o si se propuso hace menos de DIAS_ENTRE_BORRADORES.
 */
export async function generarBorradores(hoy = hoyISO()) {
  const db = getDb();
  const abiertos = (await listarSiniestros({})).filter((r) => esAbierto(r.estado));
  if (!abiertos.length) return 0;
  const ids = abiertos.map((r) => r.id);
  const desde = new Date(Date.parse(hoy) - DIAS_ENTRE_BORRADORES * 86_400_000);
  const [limite, previos, faltantes, contactos] = await Promise.all([
    limitesSinRespuesta(),
    db
      .select({ siniestroId: s.borradores.siniestroId, motivo: s.borradores.motivo })
      .from(s.borradores)
      .where(and(inArray(s.borradores.siniestroId, ids), or(inArray(s.borradores.estado, ["pendiente", "aprobado"]), gte(s.borradores.createdAt, desde)))),
    db
      .select({ siniestroId: s.documentos.siniestroId, nombre: s.documentos.nombre })
      .from(s.documentos)
      .where(and(inArray(s.documentos.siniestroId, ids), inArray(s.documentos.estado, DOC_FALTANTE))),
    db.select({ id: s.contratantes.id, contacto: s.contratantes.contacto, nombre: s.contratantes.nombre, tipo: s.contratantes.tipoPersona }).from(s.contratantes),
  ]);
  const ya = new Set(previos.map((p) => `${p.siniestroId}:${p.motivo}`));
  // A una persona física se le saluda por su nombre si no hay otro contacto.
  const contactoDe = new Map(contactos.map((c) => [c.id, c.contacto ?? (c.tipo === "fisica" ? c.nombre : null)]));
  const nuevos: (typeof s.borradores.$inferInsert)[] = [];
  for (const r of abiertos) {
    const sinMover = dias(hoyISO(r.ultimoMovimiento), hoy);
    const faltan = faltantes.filter((f) => f.siniestroId === r.id).map((f) => f.nombre);
    const saldo = r.autorizado !== null ? r.autorizado - r.pagado : null;
    const motivos: Motivo[] = [];
    if ((r.estado === "reportado" || r.estado === "recopilacion") && faltan.length) motivos.push("documentos");
    if (r.estado === "info_adicional") motivos.push("info_adicional");
    if ((r.estado === "ingresado" || r.estado === "en_revision") && sinMover >= limite(r.aseguradoraId)) motivos.push("sin_respuesta");
    if ((r.estado === "autorizado" || r.estado === "pago_parcial") && saldo !== null && saldo > 0 && sinMover >= limite(r.aseguradoraId)) motivos.push("pago");
    for (const motivo of motivos) {
      if (ya.has(`${r.id}:${motivo}`)) continue;
      const texto = textoBorrador(motivo, {
        folio: r.folio,
        afectado: r.afectado,
        contacto: contactoDe.get(r.contratanteId) ?? null,
        contratante: r.contratante,
        aseguradora: r.aseguradora,
        numeroSiniestro: r.numeroSiniestro,
        ejecutivo: r.ejecutivo,
        faltantes: faltan,
        proximaAccion: r.proximaAccion,
        diasSinRespuesta: sinMover,
        saldo,
      });
      nuevos.push({ siniestroId: r.id, motivo, para: DESTINO_DE[motivo], texto });
    }
  }
  if (nuevos.length) await db.insert(s.borradores).values(nuevos);
  return nuevos.length;
}

async function borradorEditable(user: s.User, id: number) {
  const [b] = await getDb().select().from(s.borradores).where(eq(s.borradores.id, id));
  if (!b) throw new TRPCError({ code: "NOT_FOUND", message: "Mensaje no encontrado." });
  await assertEditable(user, b.siniestroId);
  return b;
}

const textoInput = z.string().trim().min(1, "El mensaje no puede ir vacío.").max(4000);

export const seguimientoRouter = createRouter({
  /** Mensajes por aprobar, listos para enviar y los últimos enviados. El ejecutivo ve los de sus siniestros. */
  lista: editorQuery.query(async ({ ctx }) => {
    await generarBorradores();
    const db = getDb();
    const ejecutivo = alias(s.users, "ejecutivo");
    const rows = await db
      .select({
        b: s.borradores,
        folio: s.siniestros.folio,
        afectado: s.siniestros.afectado,
        ejecutivoId: s.siniestros.ejecutivoId,
        ejecutivo: ejecutivo.nombre,
        contratante: s.contratantes.nombre,
        telefono: s.contratantes.telefono,
        email: s.contratantes.email,
        aseguradora: s.aseguradoras.nombre,
        telefonoAseguradora: s.aseguradoras.telefonoCabina,
      })
      .from(s.borradores)
      .innerJoin(s.siniestros, eq(s.siniestros.id, s.borradores.siniestroId))
      .innerJoin(s.contratantes, eq(s.contratantes.id, s.siniestros.contratanteId))
      .innerJoin(s.aseguradoras, eq(s.aseguradoras.id, s.siniestros.aseguradoraId))
      .leftJoin(ejecutivo, eq(ejecutivo.id, s.siniestros.ejecutivoId))
      .where(ctx.user.role === "admin" ? undefined : eq(s.siniestros.ejecutivoId, ctx.user.id))
      .orderBy(desc(s.borradores.createdAt), desc(s.borradores.id));
    const items = rows.map(({ b, ...r }) => ({ ...b, ...r, motivoLabel: MOTIVO_LABEL[b.motivo] }));
    return {
      porAprobar: items.filter((i) => i.estado === "pendiente"),
      porEnviar: items.filter((i) => i.estado === "aprobado"),
      enviados: items.filter((i) => i.estado === "enviado").slice(0, 10),
    };
  }),

  editar: editorQuery.input(z.object({ id: z.number(), texto: textoInput })).mutation(async ({ ctx, input }) => {
    const b = await borradorEditable(ctx.user, input.id);
    if (b.estado !== "pendiente") throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se edita un mensaje que no se ha aprobado." });
    await getDb().update(s.borradores).set({ texto: input.texto }).where(eq(s.borradores.id, b.id));
    return { ok: true };
  }),

  /** Solo un administrador aprueba. Aprobar no envía nada: deja el mensaje listo para que el responsable lo mande. */
  aprobar: adminQuery.input(z.object({ id: z.number(), texto: textoInput })).mutation(async ({ ctx, input }) => {
    const b = await borradorEditable(ctx.user, input.id);
    if (b.estado !== "pendiente") throw new TRPCError({ code: "BAD_REQUEST", message: "Este mensaje ya fue revisado." });
    const db = getDb();
    await db.update(s.borradores).set({ texto: input.texto, estado: "aprobado", revisadoPorId: ctx.user.id, revisadoAt: new Date() }).where(eq(s.borradores.id, b.id));
    // A la bitácora, sin contar como movimiento del trámite.
    await db.insert(s.eventos).values({ siniestroId: b.siniestroId, tipo: "accion", nota: `Mensaje aprobado (${MOTIVO_LABEL[b.motivo].toLowerCase()}), listo para enviar.`, autorId: ctx.user.id });
    return { ok: true };
  }),

  descartar: editorQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const b = await borradorEditable(ctx.user, input.id);
    if (b.estado === "enviado") throw new TRPCError({ code: "BAD_REQUEST", message: "Este mensaje ya se envió." });
    await getDb().update(s.borradores).set({ estado: "descartado", revisadoPorId: ctx.user.id, revisadoAt: new Date() }).where(eq(s.borradores.id, b.id));
    return { ok: true };
  }),

  /** La persona lo envió por WhatsApp o correo; aquí solo se registra. */
  marcarEnviado: editorQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const b = await borradorEditable(ctx.user, input.id);
    if (b.estado !== "aprobado") throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se envía un mensaje aprobado." });
    await getDb().transaction(async (tx) => {
      await tx.update(s.borradores).set({ estado: "enviado", enviadoPorId: ctx.user.id, enviadoAt: new Date() }).where(eq(s.borradores.id, b.id));
      await registrarEvento(tx, {
        siniestroId: b.siniestroId,
        tipo: "accion",
        nota: `Se envió mensaje ${b.para === "cliente" ? "al cliente" : "a la aseguradora"}: ${MOTIVO_LABEL[b.motivo].toLowerCase()}.`,
        autorId: ctx.user.id,
      });
    });
    return { ok: true };
  }),

  /** Cuántos esperan acción, para el menú. */
  conteo: editorQuery.query(async ({ ctx }) => {
    await generarBorradores();
    const rows = await getDb()
      .select({ estado: s.borradores.estado })
      .from(s.borradores)
      .innerJoin(s.siniestros, eq(s.siniestros.id, s.borradores.siniestroId))
      .where(
        and(
          inArray(s.borradores.estado, ["pendiente", "aprobado"]),
          ctx.user.role === "admin" ? undefined : eq(s.siniestros.ejecutivoId, ctx.user.id),
        ),
      );
    return ctx.user.role === "admin" ? rows.filter((r) => r.estado === "pendiente").length : rows.filter((r) => r.estado === "aprobado").length;
  }),
});
