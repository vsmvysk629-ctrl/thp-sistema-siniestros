import { and, asc, desc, eq, inArray, like, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as s from "@db/schema";
import { GRUPOS, RAMOS, RESPONSABILIDADES, ramosDeGrupo } from "@contracts/catalogos";
import { documentosDe, leerAjustes } from "../queries/configuracion";
import { ESTADOS, ESTADO_LABEL, GRUPOS_ESTADO, validarTransicion, type GrupoEstado } from "@contracts/flujo";
import { authedQuery, createRouter, editorQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { assertEditable, assertSiniestro, puedeEditar } from "../auth/alcance";
import { documentosFaltantes, hoyISO, registrarEvento, siguienteFolio } from "../queries/siniestros";

const texto = (max = 255) => z.string().trim().max(max).nullish().transform((v) => v || null);
const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.");
export const monto = z
  .string()
  .trim()
  .transform((v) => v.replace(/[$,\s]/g, ""))
  .pipe(z.string().regex(/^(\d{1,12}(\.\d{1,2})?)?$/, "Monto inválido (usa números, p. ej. 12500.50)."))
  .nullish()
  .transform((v) => v || null);

/** Datos que se capturan y corrigen. El estatus, lo autorizado y lo pagado no se editan aquí. */
const datosInput = z.object({
  afectado: z.string().trim().min(1).max(255),
  tipo: z.string().trim().min(1).max(64),
  descripcion: texto(5000),
  fechaOcurrido: fechaISO,
  fechaReporte: fechaISO,
  numeroSiniestro: texto(64),
  polizaTexto: texto(64),
  gastado: monto,
  reclamado: monto,
  deducible: monto,
  coaseguro: monto,
  numeroReporte: texto(64),
  ajustadorNombre: texto(128),
  ajustadorTelefono: texto(32),
  tallerNombre: texto(128),
  lugar: texto(255),
  conductorNombre: texto(128),
  responsabilidad: z.enum(RESPONSABILIDADES),
  ejecutivoId: z.number(),
});

const CAMPO_LABEL: Record<string, string> = {
  afectado: "asegurado/afectado", tipo: "tipo", descripcion: "descripción", fechaOcurrido: "fecha de ocurrencia",
  fechaReporte: "fecha de reporte", numeroSiniestro: "número de siniestro", polizaTexto: "póliza", gastado: "gastado",
  reclamado: "reclamado", deducible: "deducible", coaseguro: "coaseguro", numeroReporte: "número de reporte",
  ajustadorNombre: "ajustador", ajustadorTelefono: "teléfono del ajustador", tallerNombre: "taller", lugar: "lugar",
  conductorNombre: "conductor", responsabilidad: "responsabilidad", ejecutivoId: "ejecutivo responsable",
};

const ejecutivo = alias(s.users, "ejecutivo");
const pagadoSql = sql<string>`coalesce((select sum(p.monto) from siniestro_pagos p where p.siniestroId = ${s.siniestros.id}), 0)`;

export const filtrosInput = z.object({
  busqueda: z.string().trim().max(100).optional(),
  grupoEstado: z.enum(Object.keys(GRUPOS_ESTADO) as [GrupoEstado, ...GrupoEstado[]]).optional(),
  ejecutivoId: z.number().optional(),
  aseguradoraId: z.number().optional(),
  grupoRamo: z.enum(GRUPOS).optional(),
  contratanteId: z.number().optional(),
});
export type Filtros = z.infer<typeof filtrosInput>;

/** Bandeja de siniestros con los datos que muestran la lista, el tablero y los reportes. */
export async function listarSiniestros(f: Filtros) {
  const b = f.busqueda;
  const conds: (SQL | undefined)[] = [
    f.grupoEstado ? inArray(s.siniestros.estado, GRUPOS_ESTADO[f.grupoEstado].estados) : undefined,
    f.ejecutivoId ? eq(s.siniestros.ejecutivoId, f.ejecutivoId) : undefined,
    f.aseguradoraId ? eq(s.siniestros.aseguradoraId, f.aseguradoraId) : undefined,
    f.grupoRamo ? inArray(s.siniestros.ramo, ramosDeGrupo(f.grupoRamo)) : undefined,
    f.contratanteId ? eq(s.siniestros.contratanteId, f.contratanteId) : undefined,
    b
      ? or(
          like(s.siniestros.folio, `%${b}%`),
          like(s.siniestros.afectado, `%${b}%`),
          like(s.siniestros.numeroSiniestro, `%${b}%`),
          like(s.contratantes.nombre, `%${b}%`),
          like(s.polizas.numero, `%${b}%`),
          like(s.siniestros.polizaTexto, `%${b}%`),
        )
      : undefined,
  ];
  const rows = await getDb()
    .select({
      id: s.siniestros.id,
      folio: s.siniestros.folio,
      contratanteId: s.siniestros.contratanteId,
      contratante: s.contratantes.nombre,
      afectado: s.siniestros.afectado,
      ramo: s.siniestros.ramo,
      tipo: s.siniestros.tipo,
      aseguradoraId: s.siniestros.aseguradoraId,
      aseguradora: s.aseguradoras.nombre,
      numeroSiniestro: s.siniestros.numeroSiniestro,
      poliza: sql<string | null>`coalesce(${s.polizas.numero}, ${s.siniestros.polizaTexto})`,
      estado: s.siniestros.estado,
      fechaOcurrido: s.siniestros.fechaOcurrido,
      fechaReporte: s.siniestros.fechaReporte,
      fechaIngreso: s.siniestros.fechaIngreso,
      proximaAccion: s.siniestros.proximaAccion,
      fechaCompromiso: s.siniestros.fechaCompromiso,
      ejecutivoId: s.siniestros.ejecutivoId,
      ejecutivo: ejecutivo.nombre,
      reclamado: s.siniestros.reclamado,
      autorizado: s.siniestros.autorizado,
      pagado: pagadoSql,
      ultimoMovimiento: s.siniestros.ultimoMovimiento,
    })
    .from(s.siniestros)
    .innerJoin(s.contratantes, eq(s.contratantes.id, s.siniestros.contratanteId))
    .innerJoin(s.aseguradoras, eq(s.aseguradoras.id, s.siniestros.aseguradoraId))
    .leftJoin(s.polizas, eq(s.polizas.id, s.siniestros.polizaId))
    .leftJoin(ejecutivo, eq(ejecutivo.id, s.siniestros.ejecutivoId))
    .where(and(...conds.filter((c): c is SQL => c !== undefined)))
    .orderBy(desc(s.siniestros.fechaReporte), desc(s.siniestros.id))
    .limit(2000);
  return rows.map((r) => ({ ...r, reclamado: Number(r.reclamado ?? 0), autorizado: r.autorizado === null ? null : Number(r.autorizado), pagado: Number(r.pagado ?? 0) }));
}
export type FilaSiniestro = Awaited<ReturnType<typeof listarSiniestros>>[number];

async function assertResponsable(u: s.User, ejecutivoId: number) {
  if (u.role !== "admin" && ejecutivoId !== u.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Solo un administrador puede asignar el siniestro a otro ejecutivo." });
  }
  const [e] = await getDb().select().from(s.users).where(eq(s.users.id, ejecutivoId));
  if (!e || !e.activo || e.role === "consulta") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "El responsable debe ser un ejecutivo o administrador activo." });
  }
}

export const siniestrosRouter = createRouter({
  list: authedQuery.input(filtrosInput).query(({ input }) => listarSiniestros(input)),

  /** Expediente completo. */
  get: authedQuery.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const sin = await assertSiniestro(input.id);
    const db = getDb();
    const autor = alias(s.users, "autor");
    const autorArch = alias(s.users, "autor_arch");
    const [contratante, poliza, aseguradora, ejecutivoRow, docs, archs, concs, pags, evts, ters, otros] = await Promise.all([
      db.select().from(s.contratantes).where(eq(s.contratantes.id, sin.contratanteId)).then((r) => r[0]),
      sin.polizaId ? db.select().from(s.polizas).where(eq(s.polizas.id, sin.polizaId)).then((r) => r[0] ?? null) : null,
      db.select().from(s.aseguradoras).where(eq(s.aseguradoras.id, sin.aseguradoraId)).then((r) => r[0]),
      db.select({ id: s.users.id, nombre: s.users.nombre }).from(s.users).where(eq(s.users.id, sin.ejecutivoId)).then((r) => r[0] ?? null),
      db.select().from(s.documentos).where(eq(s.documentos.siniestroId, sin.id)).orderBy(asc(s.documentos.orden), asc(s.documentos.id)),
      // Sin el contenido: solo la lista. El archivo se pide aparte al abrirlo.
      db
        .select({ id: s.archivos.id, documentoId: s.archivos.documentoId, nombre: s.archivos.nombre, tipo: s.archivos.tipo, tamano: s.archivos.tamano, createdAt: s.archivos.createdAt, subidoPor: autorArch.nombre })
        .from(s.archivos)
        .leftJoin(autorArch, eq(autorArch.id, s.archivos.subidoPorId))
        .where(eq(s.archivos.siniestroId, sin.id))
        .orderBy(asc(s.archivos.id)),
      db.select().from(s.conceptos).where(eq(s.conceptos.siniestroId, sin.id)).orderBy(asc(s.conceptos.id)),
      db.select().from(s.pagos).where(eq(s.pagos.siniestroId, sin.id)).orderBy(asc(s.pagos.fecha), asc(s.pagos.id)),
      db
        .select({ evento: s.eventos, autor: autor.nombre })
        .from(s.eventos)
        .leftJoin(autor, eq(autor.id, s.eventos.autorId))
        .where(eq(s.eventos.siniestroId, sin.id))
        .orderBy(desc(s.eventos.createdAt), desc(s.eventos.id)),
      db.select().from(s.terceros).where(eq(s.terceros.siniestroId, sin.id)).orderBy(asc(s.terceros.id)),
      db
        .select({ id: s.siniestros.id, folio: s.siniestros.folio, ramo: s.siniestros.ramo, tipo: s.siniestros.tipo, estado: s.siniestros.estado })
        .from(s.siniestros)
        .where(and(eq(s.siniestros.contratanteId, sin.contratanteId), ne(s.siniestros.id, sin.id)))
        .orderBy(desc(s.siniestros.fechaReporte))
        .limit(5),
    ]);
    return {
      ...sin,
      contratante: contratante!,
      poliza,
      aseguradora: aseguradora!,
      ejecutivo: ejecutivoRow,
      documentos: docs,
      archivos: archs,
      conceptos: concs,
      pagos: pags,
      pagado: pags.reduce((a, p) => a + Number(p.monto), 0),
      eventos: evts.map((e) => ({ ...e.evento, autor: e.autor })),
      terceros: ters,
      otros,
      puedeEditar: puedeEditar(ctx.user, sin),
    };
  }),

  create: editorQuery
    .input(
      z.object({
        contratanteId: z.number(),
        polizaId: z.number().nullish(),
        polizaTexto: texto(64),
        aseguradoraId: z.number(),
        ramo: z.enum(RAMOS),
        tipo: z.string().trim().min(1).max(64),
        afectado: z.string().trim().min(1).max(255),
        fechaOcurrido: fechaISO,
        descripcion: texto(5000),
        ejecutivoId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [contratante] = await db.select().from(s.contratantes).where(eq(s.contratantes.id, input.contratanteId));
      if (!contratante) throw new TRPCError({ code: "NOT_FOUND", message: "Contratante no encontrado." });
      let { aseguradoraId, ramo } = input;
      if (input.polizaId) {
        const [p] = await db.select().from(s.polizas).where(eq(s.polizas.id, input.polizaId));
        if (!p || p.contratanteId !== input.contratanteId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "La póliza no es de ese contratante." });
        }
        aseguradoraId = p.aseguradoraId;
        ramo = p.ramo;
      }
      await assertResponsable(ctx.user, input.ejecutivoId);
      const hoy = hoyISO();
      if (input.fechaOcurrido > hoy) throw new TRPCError({ code: "BAD_REQUEST", message: "La fecha de ocurrencia no puede ser futura." });
      const responsable = (await db.select({ nombre: s.users.nombre }).from(s.users).where(eq(s.users.id, input.ejecutivoId)))[0];
      const ajustes = await leerAjustes(db);
      const compromiso = hoyISO(new Date(Date.now() + ajustes.diasCompromisoInicial * 86_400_000));
      return db.transaction(async (tx) => {
        const folio = await siguienteFolio(tx);
        const [{ id }] = await tx
          .insert(s.siniestros)
          .values({
            ...input,
            polizaId: input.polizaId ?? null,
            aseguradoraId,
            ramo,
            folio,
            fechaReporte: hoy,
            proximaAccion: ajustes.accionInicial,
            fechaCompromiso: compromiso,
            creadoPorId: ctx.user.id,
          })
          .$returningId();
        const docs = await documentosDe(tx, ramo, input.tipo, aseguradoraId);
        await tx.insert(s.documentos).values(docs.map((nombre, orden) => ({ siniestroId: id, nombre, orden })));
        await registrarEvento(tx, {
          siniestroId: id,
          tipo: "alta",
          estadoNuevo: "reportado",
          nota: `Se registra el siniestro y se asigna a ${responsable?.nombre ?? "—"} como responsable.`,
          autorId: ctx.user.id,
        });
        return { id, folio };
      });
    }),

  /** Corrige datos capturados. Deja en la bitácora qué campos cambiaron. */
  actualizar: editorQuery
    .input(z.object({ id: z.number(), datos: datosInput.partial() }))
    .mutation(async ({ ctx, input }) => {
      const anterior = await assertEditable(ctx.user, input.id);
      const datos = { ...input.datos };
      if (datos.ejecutivoId !== undefined && datos.ejecutivoId !== anterior.ejecutivoId) {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Solo un administrador puede reasignar el siniestro." });
        await assertResponsable(ctx.user, datos.ejecutivoId);
      }
      if (datos.reclamado !== undefined) {
        const [c] = await getDb().select({ n: sql<number>`count(*)` }).from(s.conceptos).where(eq(s.conceptos.siniestroId, input.id));
        if (Number(c.n) > 0) delete datos.reclamado; // sale de la suma de conceptos
      }
      const num = (v: unknown) => (v === null || v === undefined || v === "" ? "" : String(Number(v)));
      const cambiados = (Object.keys(datos) as (keyof typeof datos)[]).filter((k) => {
        const nuevo = datos[k];
        if (nuevo === undefined) return false;
        const viejo = anterior[k as keyof typeof anterior];
        return ["gastado", "reclamado", "deducible", "coaseguro"].includes(k) ? num(nuevo) !== num(viejo) : String(nuevo ?? "") !== String(viejo ?? "");
      });
      if (!cambiados.length) return { id: input.id, cambiados: [] };
      await getDb().transaction(async (tx) => {
        await tx.update(s.siniestros).set(datos).where(eq(s.siniestros.id, input.id));
        await registrarEvento(tx, {
          siniestroId: input.id,
          tipo: "edicion",
          nota: `Se actualizó: ${cambiados.map((k) => CAMPO_LABEL[k] ?? k).join(", ")}.`,
          autorId: ctx.user.id,
        });
      });
      return { id: input.id, cambiados };
    }),

  cambiarEstado: editorQuery
    .input(
      z.object({
        id: z.number(),
        destino: z.enum(ESTADOS),
        folio: texto(128),
        nota: texto(5000),
        montoAutorizado: monto,
        proximaAccion: texto(500),
        fechaCompromiso: fechaISO.nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertEditable(ctx.user, input.id);
      return getDb().transaction(async (tx) => {
        // Bloquea el renglón: dos personas no pueden mover el mismo siniestro a la vez.
        const [actual] = await tx.select().from(s.siniestros).where(eq(s.siniestros.id, input.id)).for("update");
        const faltantes = await documentosFaltantes(tx, input.id);
        const problema = validarTransicion({ ...actual, documentosFaltantes: faltantes }, input.destino, input);
        if (problema) throw new TRPCError({ code: "BAD_REQUEST", message: problema });
        const cambios: Partial<typeof s.siniestros.$inferInsert> = { estado: input.destino };
        if (input.destino === "ingresado") {
          cambios.fechaIngreso = hoyISO();
          if (!actual.numeroSiniestro && input.folio) cambios.numeroSiniestro = input.folio;
        }
        if (input.destino === "autorizado") cambios.autorizado = input.montoAutorizado;
        if (input.destino === "cerrado") {
          cambios.proximaAccion = null;
          cambios.fechaCompromiso = null;
        } else if (input.proximaAccion) {
          cambios.proximaAccion = input.proximaAccion;
          cambios.fechaCompromiso = input.fechaCompromiso ?? null;
        }
        await tx.update(s.siniestros).set(cambios).where(eq(s.siniestros.id, input.id));
        const extra = input.destino === "autorizado" ? `Monto autorizado: $${Number(input.montoAutorizado).toLocaleString("es-MX", { minimumFractionDigits: 2 })}.` : null;
        await registrarEvento(tx, {
          siniestroId: input.id,
          tipo: "estatus",
          estadoAnterior: actual.estado,
          estadoNuevo: input.destino,
          folio: input.folio,
          nota: [input.nota, extra].filter(Boolean).join("\n") || null,
          autorId: ctx.user.id,
        });
        return { id: input.id, estado: input.destino, label: ESTADO_LABEL[input.destino] };
      });
    }),

  /** Próxima acción y fecha compromiso. */
  accion: editorQuery
    .input(z.object({ id: z.number(), proximaAccion: z.string().trim().min(1).max(500), fechaCompromiso: fechaISO.nullish() }))
    .mutation(async ({ ctx, input }) => {
      await assertEditable(ctx.user, input.id);
      await getDb().transaction(async (tx) => {
        await tx
          .update(s.siniestros)
          .set({ proximaAccion: input.proximaAccion, fechaCompromiso: input.fechaCompromiso ?? null })
          .where(eq(s.siniestros.id, input.id));
        await registrarEvento(tx, {
          siniestroId: input.id,
          tipo: "accion",
          nota: `Próxima acción: ${input.proximaAccion}${input.fechaCompromiso ? ` (compromiso ${input.fechaCompromiso})` : ""}.`,
          autorId: ctx.user.id,
        });
      });
      return { ok: true };
    }),

  /** Nota de seguimiento: cualquier ejecutivo o administrador. */
  agregarNota: editorQuery
    .input(z.object({ id: z.number(), nota: z.string().trim().min(1).max(5000) }))
    .mutation(async ({ ctx, input }) => {
      await assertSiniestro(input.id);
      await getDb().transaction((tx) => registrarEvento(tx, { siniestroId: input.id, tipo: "nota", nota: input.nota, autorId: ctx.user.id }));
      return { ok: true };
    }),

  agregarTercero: editorQuery
    .input(
      z.object({
        siniestroId: z.number(),
        nombre: z.string().trim().min(1).max(255),
        telefono: texto(32),
        vehiculo: texto(128),
        placas: texto(16),
        aseguradora: texto(64),
        notas: texto(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertEditable(ctx.user, input.siniestroId);
      return getDb().transaction(async (tx) => {
        const [{ id }] = await tx.insert(s.terceros).values(input).$returningId();
        await registrarEvento(tx, { siniestroId: input.siniestroId, tipo: "tercero", nota: `Se agregó al tercero ${input.nombre}.`, autorId: ctx.user.id });
        return { id };
      });
    }),

  quitarTercero: editorQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const [t] = await getDb().select().from(s.terceros).where(eq(s.terceros.id, input.id));
    if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Tercero no encontrado." });
    await assertEditable(ctx.user, t.siniestroId);
    await getDb().transaction(async (tx) => {
      await tx.delete(s.terceros).where(eq(s.terceros.id, input.id));
      await registrarEvento(tx, { siniestroId: t.siniestroId, tipo: "tercero", nota: `Se quitó al tercero ${t.nombre}.`, autorId: ctx.user.id });
    });
    return { ok: true };
  }),
});
