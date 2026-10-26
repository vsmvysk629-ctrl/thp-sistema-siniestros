import { and, asc, desc, eq, like, notInArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as s from "@db/schema";
import {
  ESTADOS,
  ESTADOS_FINALES,
  ESTADO_LABEL,
  REQUIERE_FOLIO,
  RESPONSABILIDADES,
  TIPOS,
  validarTransicion,
} from "@contracts/flujo";
import { authedQuery, createRouter, oficinaQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { assertPoliza, assertSiniestro, esVendedor } from "../auth/alcance";

const texto = (max = 255) => z.string().trim().max(max).nullish().transform((v) => v || null);
const monto = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, "Monto inválido (usa números, p. ej. 12500.50).")
  .nullish()
  .transform((v) => v || null);

/** Datos que la oficina captura y corrige. El estado y el monto autorizado no se editan aquí. */
const datosInput = z.object({
  numeroReporte: texto(64),
  numeroSiniestro: texto(64),
  ajustadorNombre: texto(128),
  ajustadorTelefono: texto(32),
  tipo: z.enum(TIPOS),
  fechaOcurrido: z.string().regex(/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/, "Fecha inválida."),
  lugar: texto(255),
  descripcion: texto(5000),
  conductorNombre: texto(128),
  responsabilidad: z.enum(RESPONSABILIDADES),
  tallerNombre: texto(128),
  deducible: monto,
  montoEstimado: monto,
  responsableId: z.number().nullish(),
});

const CAMPO_LABEL: Record<string, string> = {
  numeroReporte: "número de reporte",
  numeroSiniestro: "número de siniestro",
  ajustadorNombre: "ajustador",
  ajustadorTelefono: "teléfono del ajustador",
  tipo: "tipo",
  fechaOcurrido: "fecha",
  lugar: "lugar",
  descripcion: "descripción",
  conductorNombre: "conductor",
  responsabilidad: "responsabilidad",
  tallerNombre: "taller",
  deducible: "deducible",
  montoEstimado: "monto estimado",
  responsableId: "responsable",
};

const normalizaFecha = (f: string) => (f.length === 10 ? `${f} 00:00:00` : f.replace("T", " ").padEnd(19, ":00").slice(0, 19));

/** Siguiente folio interno del año: SIN-2026-0001. */
async function siguienteFolio(tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0]) {
  const anio = new Date().getFullYear();
  const prefijo = `SIN-${anio}-`;
  const [row] = await tx
    .select({ ultimo: sql<string | null>`max(${s.siniestros.folio})` })
    .from(s.siniestros)
    .where(like(s.siniestros.folio, `${prefijo}%`));
  const n = row?.ultimo ? Number(row.ultimo.slice(prefijo.length)) + 1 : 1;
  return `${prefijo}${String(n).padStart(4, "0")}`;
}

export const siniestrosRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        estado: z.enum(ESTADOS).optional(),
        aseguradoraId: z.number().optional(),
        tipo: z.enum(TIPOS).optional(),
        soloAbiertos: z.boolean().optional(),
        responsableId: z.number().optional(),
        busqueda: z.string().trim().max(100).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const b = input.busqueda;
      const conds = [
        esVendedor(ctx.user) ? eq(s.clientes.vendedorId, ctx.user.id) : undefined,
        input.estado ? eq(s.siniestros.estado, input.estado) : undefined,
        input.aseguradoraId ? eq(s.siniestros.aseguradoraId, input.aseguradoraId) : undefined,
        input.tipo ? eq(s.siniestros.tipo, input.tipo) : undefined,
        input.responsableId ? eq(s.siniestros.responsableId, input.responsableId) : undefined,
        input.soloAbiertos ? notInArray(s.siniestros.estado, ESTADOS_FINALES) : undefined,
        b
          ? or(
              like(s.siniestros.folio, `%${b}%`),
              like(s.siniestros.numeroSiniestro, `%${b}%`),
              like(s.siniestros.numeroReporte, `%${b}%`),
              like(s.clientes.nombre, `%${b}%`),
              like(s.polizas.numero, `%${b}%`),
              like(s.polizas.vehiculoPlacas, `%${b}%`),
            )
          : undefined,
      ].filter((c) => c !== undefined);
      return getDb()
        .select({
          id: s.siniestros.id,
          folio: s.siniestros.folio,
          numeroSiniestro: s.siniestros.numeroSiniestro,
          numeroReporte: s.siniestros.numeroReporte,
          tipo: s.siniestros.tipo,
          estado: s.siniestros.estado,
          fechaOcurrido: s.siniestros.fechaOcurrido,
          ultimoMovimiento: s.siniestros.ultimoMovimiento,
          createdAt: s.siniestros.createdAt,
          responsableId: s.siniestros.responsableId,
          cliente: s.clientes.nombre,
          aseguradora: s.aseguradoras.nombre,
          poliza: s.polizas.numero,
          vehiculo: sql<string>`trim(concat_ws(' ', ${s.polizas.vehiculoMarca}, ${s.polizas.vehiculoModelo}, ${s.polizas.vehiculoAnio}))`,
          placas: s.polizas.vehiculoPlacas,
        })
        .from(s.siniestros)
        .innerJoin(s.clientes, eq(s.clientes.id, s.siniestros.clienteId))
        .innerJoin(s.polizas, eq(s.polizas.id, s.siniestros.polizaId))
        .innerJoin(s.aseguradoras, eq(s.aseguradoras.id, s.siniestros.aseguradoraId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(s.siniestros.fechaOcurrido))
        .limit(1000);
    }),

  get: authedQuery.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const sin = await assertSiniestro(ctx.user, input.id);
    const db = getDb();
    // Consultas separadas (sin subconsultas laterales) para funcionar igual en MySQL y MariaDB.
    const [poliza, cliente, aseguradora, responsable, tercerosRows, eventos] = await Promise.all([
      db.query.polizas.findFirst({ where: eq(s.polizas.id, sin.polizaId) }),
      db.query.clientes.findFirst({ where: eq(s.clientes.id, sin.clienteId) }),
      db.query.aseguradoras.findFirst({ where: eq(s.aseguradoras.id, sin.aseguradoraId) }),
      sin.responsableId
        ? db.query.users.findFirst({ where: eq(s.users.id, sin.responsableId), columns: { id: true, nombre: true } })
        : undefined,
      db.select().from(s.terceros).where(eq(s.terceros.siniestroId, sin.id)).orderBy(asc(s.terceros.id)),
      db
        .select({ evento: s.siniestroEventos, autor: { id: s.users.id, nombre: s.users.nombre } })
        .from(s.siniestroEventos)
        .leftJoin(s.users, eq(s.users.id, s.siniestroEventos.autorId))
        .where(eq(s.siniestroEventos.siniestroId, sin.id))
        .orderBy(desc(s.siniestroEventos.createdAt), desc(s.siniestroEventos.id)),
    ]);
    return {
      ...sin,
      poliza: poliza!,
      cliente: cliente!,
      aseguradora: aseguradora!,
      responsable: responsable ?? null,
      terceros: tercerosRows,
      eventos: eventos.map((e) => ({ ...e.evento, autor: e.autor })),
    };
  }),

  create: authedQuery
    .input(datosInput.extend({ polizaId: z.number(), nota: texto(5000) }))
    .mutation(async ({ ctx, input }) => {
      const poliza = await assertPoliza(ctx.user, input.polizaId);
      const { polizaId, nota, ...datos } = input;
      const responsableId = esVendedor(ctx.user) ? null : (datos.responsableId ?? ctx.user.id);
      return getDb().transaction(async (tx) => {
        const folio = await siguienteFolio(tx);
        const [{ id }] = await tx
          .insert(s.siniestros)
          .values({
            ...datos,
            fechaOcurrido: normalizaFecha(datos.fechaOcurrido),
            folio,
            polizaId,
            clienteId: poliza.clienteId,
            aseguradoraId: poliza.aseguradoraId,
            responsableId,
            creadoPorId: ctx.user.id,
          })
          .$returningId();
        await tx.insert(s.siniestroEventos).values({
          siniestroId: id,
          tipo: "alta",
          estadoNuevo: "reportado",
          nota,
          autorId: ctx.user.id,
        });
        return { id, folio };
      });
    }),

  /** Corrige datos capturados. Deja en el historial qué campos cambiaron. */
  actualizar: oficinaQuery
    .input(z.object({ id: z.number(), datos: datosInput.partial() }))
    .mutation(async ({ ctx, input }) => {
      const anterior = await assertSiniestro(ctx.user, input.id);
      const datos = { ...input.datos };
      if (datos.fechaOcurrido) datos.fechaOcurrido = normalizaFecha(datos.fechaOcurrido);
      const cambiados = (Object.keys(datos) as (keyof typeof datos)[]).filter(
        (k) => datos[k] !== undefined && String(datos[k] ?? "") !== String(anterior[k] ?? ""),
      );
      if (!cambiados.length) return { id: input.id, cambiados: [] };
      await getDb().transaction(async (tx) => {
        await tx
          .update(s.siniestros)
          .set({ ...datos, ultimoMovimiento: new Date() })
          .where(eq(s.siniestros.id, input.id));
        await tx.insert(s.siniestroEventos).values({
          siniestroId: input.id,
          tipo: "edicion",
          nota: `Se actualizó: ${cambiados.map((k) => CAMPO_LABEL[k] ?? k).join(", ")}.`,
          autorId: ctx.user.id,
        });
      });
      return { id: input.id, cambiados };
    }),

  cambiarEstado: oficinaQuery
    .input(
      z.object({
        id: z.number(),
        destino: z.enum(ESTADOS),
        folio: texto(128),
        nota: texto(5000),
        montoAutorizado: monto,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertSiniestro(ctx.user, input.id);
      if (input.montoAutorizado && !REQUIERE_FOLIO.includes(input.destino)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El monto autorizado solo se captura junto con la autorización o el pago de la aseguradora.",
        });
      }
      return getDb().transaction(async (tx) => {
        // Bloquea el renglón: dos personas no pueden mover el mismo siniestro a la vez.
        const [actual] = await tx.select().from(s.siniestros).where(eq(s.siniestros.id, input.id)).for("update");
        const problema = validarTransicion(actual, input.destino, input);
        if (problema) throw new TRPCError({ code: "BAD_REQUEST", message: problema });
        await tx
          .update(s.siniestros)
          .set({
            estado: input.destino,
            ultimoMovimiento: new Date(),
            ...(input.montoAutorizado ? { montoAutorizado: input.montoAutorizado } : {}),
          })
          .where(eq(s.siniestros.id, input.id));
        const montoNota = input.montoAutorizado ? `Monto autorizado: $${input.montoAutorizado}.` : null;
        await tx.insert(s.siniestroEventos).values({
          siniestroId: input.id,
          tipo: "cambio_estado",
          estadoAnterior: actual.estado,
          estadoNuevo: input.destino,
          folio: input.folio,
          nota: [input.nota, montoNota].filter(Boolean).join("\n") || null,
          autorId: ctx.user.id,
        });
        return { id: input.id, estado: input.destino, label: ESTADO_LABEL[input.destino] };
      });
    }),

  agregarNota: authedQuery
    .input(z.object({ id: z.number(), nota: z.string().trim().min(1).max(5000) }))
    .mutation(async ({ ctx, input }) => {
      await assertSiniestro(ctx.user, input.id);
      await getDb().transaction(async (tx) => {
        await tx.insert(s.siniestroEventos).values({ siniestroId: input.id, tipo: "nota", nota: input.nota, autorId: ctx.user.id });
        await tx.update(s.siniestros).set({ ultimoMovimiento: new Date() }).where(eq(s.siniestros.id, input.id));
      });
      return { ok: true };
    }),

  agregarTercero: oficinaQuery
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
      await assertSiniestro(ctx.user, input.siniestroId);
      return getDb().transaction(async (tx) => {
        const [{ id }] = await tx.insert(s.terceros).values(input).$returningId();
        await tx.insert(s.siniestroEventos).values({
          siniestroId: input.siniestroId,
          tipo: "tercero",
          nota: `Se agregó al tercero ${input.nombre}.`,
          autorId: ctx.user.id,
        });
        return { id };
      });
    }),

  quitarTercero: oficinaQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const t = await getDb().query.terceros.findFirst({ where: eq(s.terceros.id, input.id) });
    if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Tercero no encontrado." });
    await assertSiniestro(ctx.user, t.siniestroId);
    await getDb().transaction(async (tx) => {
      await tx.delete(s.terceros).where(eq(s.terceros.id, input.id));
      await tx.insert(s.siniestroEventos).values({
        siniestroId: t.siniestroId,
        tipo: "tercero",
        nota: `Se quitó al tercero ${t.nombre}.`,
        autorId: ctx.user.id,
      });
    });
    return { ok: true };
  }),

  /** Conteos por estado y aseguradora para el encabezado de la bandeja. */
  resumen: authedQuery.query(async ({ ctx }) => {
    const rows = await getDb()
      .select({ estado: s.siniestros.estado, aseguradoraId: s.siniestros.aseguradoraId, n: sql<number>`count(*)` })
      .from(s.siniestros)
      .innerJoin(s.clientes, eq(s.clientes.id, s.siniestros.clienteId))
      .where(esVendedor(ctx.user) ? eq(s.clientes.vendedorId, ctx.user.id) : undefined)
      .groupBy(s.siniestros.estado, s.siniestros.aseguradoraId);
    return rows.map((r) => ({ ...r, n: Number(r.n) }));
  }),
});
