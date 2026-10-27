import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import * as s from "@db/schema";
import { RAMOS } from "@contracts/catalogos";
import { authedQuery, createRouter, editorQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { TRPCError } from "@trpc/server";

const texto = (max = 255) => z.string().trim().max(max).nullish().transform((v) => v || null);
const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().transform((v) => v || null);

const contratanteInput = z.object({
  nombre: z.string().trim().min(1).max(255),
  tipoPersona: z.enum(["fisica", "moral"]),
  rfc: texto(16),
  contacto: texto(255),
  telefono: texto(32),
  email: texto(255),
  ejecutivoId: z.number().nullish(),
  clienteDesde: z.number().int().min(1950).max(2100).nullish(),
});

const polizaInput = z.object({
  numero: z.string().trim().min(1).max(64),
  aseguradoraId: z.number(),
  contratanteId: z.number(),
  ramo: z.enum(RAMOS),
  descripcion: texto(255),
  vigenciaInicio: fechaISO,
  vigenciaFin: fechaISO,
});

const sumaPagos = sql<string>`coalesce((select sum(p.monto) from siniestro_pagos p where p.siniestroId = ${s.siniestros.id}), 0)`;

export const catalogosRouter = createRouter({
  aseguradoras: authedQuery.query(() =>
    getDb().select().from(s.aseguradoras).where(eq(s.aseguradoras.activa, true)).orderBy(asc(s.aseguradoras.nombre)),
  ),

  /** Usuarios activos, para elegir ejecutivo. */
  usuarios: authedQuery.query(() =>
    getDb()
      .select({ id: s.users.id, nombre: s.users.nombre, role: s.users.role })
      .from(s.users)
      .where(eq(s.users.activo, true))
      .orderBy(asc(s.users.nombre)),
  ),

  /** Contratantes con sus totales de siniestros. */
  contratantes: authedQuery.input(z.object({ busqueda: z.string().trim().max(100).optional() })).query(async ({ input }) => {
    const db = getDb();
    const lista = await db
      .select()
      .from(s.contratantes)
      .where(input.busqueda ? like(s.contratantes.nombre, `%${input.busqueda}%`) : undefined)
      .orderBy(asc(s.contratantes.nombre))
      .limit(500);
    const tot = await db
      .select({
        contratanteId: s.siniestros.contratanteId,
        n: sql<number>`count(*)`,
        abiertos: sql<number>`sum(${s.siniestros.estado} <> 'cerrado')`,
        reclamado: sql<string | null>`sum(${s.siniestros.reclamado})`,
        pagado: sql<string | null>`sum(${sumaPagos})`,
      })
      .from(s.siniestros)
      .groupBy(s.siniestros.contratanteId);
    const ramos = await db
      .select({ contratanteId: s.polizas.contratanteId, ramo: s.polizas.ramo })
      .from(s.polizas)
      .groupBy(s.polizas.contratanteId, s.polizas.ramo);
    const porId = new Map(tot.map((t) => [t.contratanteId, t]));
    return lista.map((c) => {
      const t = porId.get(c.id);
      return {
        ...c,
        ramos: ramos.filter((r) => r.contratanteId === c.id).map((r) => r.ramo),
        siniestros: Number(t?.n ?? 0),
        abiertos: Number(t?.abiertos ?? 0),
        reclamado: Number(t?.reclamado ?? 0),
        pagado: Number(t?.pagado ?? 0),
      };
    });
  }),

  contratante: authedQuery.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = getDb();
    const [c] = await db.select().from(s.contratantes).where(eq(s.contratantes.id, input.id));
    if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Contratante no encontrado." });
    const pols = await db
      .select({ poliza: s.polizas, aseguradora: s.aseguradoras.nombre })
      .from(s.polizas)
      .innerJoin(s.aseguradoras, eq(s.aseguradoras.id, s.polizas.aseguradoraId))
      .where(eq(s.polizas.contratanteId, c.id))
      .orderBy(asc(s.polizas.numero));
    return { ...c, polizas: pols.map((p) => ({ ...p.poliza, aseguradora: p.aseguradora })) };
  }),

  crearContratante: editorQuery.input(contratanteInput).mutation(async ({ input }) => {
    const [{ id }] = await getDb().insert(s.contratantes).values(input).$returningId();
    return { id };
  }),

  editarContratante: editorQuery
    .input(z.object({ id: z.number(), datos: contratanteInput.partial() }))
    .mutation(async ({ input }) => {
      await getDb().update(s.contratantes).set(input.datos).where(eq(s.contratantes.id, input.id));
      return { id: input.id };
    }),

  polizas: authedQuery
    .input(z.object({ contratanteId: z.number().optional(), busqueda: z.string().trim().max(100).optional() }))
    .query(({ input }) => {
      const conds = [
        input.contratanteId ? eq(s.polizas.contratanteId, input.contratanteId) : undefined,
        input.busqueda ? or(like(s.polizas.numero, `%${input.busqueda}%`), like(s.contratantes.nombre, `%${input.busqueda}%`)) : undefined,
      ].filter((c) => c !== undefined);
      return getDb()
        .select({
          id: s.polizas.id,
          numero: s.polizas.numero,
          ramo: s.polizas.ramo,
          descripcion: s.polizas.descripcion,
          vigenciaInicio: s.polizas.vigenciaInicio,
          vigenciaFin: s.polizas.vigenciaFin,
          aseguradoraId: s.polizas.aseguradoraId,
          aseguradora: s.aseguradoras.nombre,
          contratanteId: s.polizas.contratanteId,
          contratante: s.contratantes.nombre,
        })
        .from(s.polizas)
        .innerJoin(s.aseguradoras, eq(s.aseguradoras.id, s.polizas.aseguradoraId))
        .innerJoin(s.contratantes, eq(s.contratantes.id, s.polizas.contratanteId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(s.polizas.id))
        .limit(300);
    }),

  crearPoliza: editorQuery.input(polizaInput).mutation(async ({ input }) => {
    const [{ id }] = await getDb().insert(s.polizas).values(input).$returningId();
    return { id };
  }),

  editarPoliza: editorQuery
    .input(z.object({ id: z.number(), datos: polizaInput.partial() }))
    .mutation(async ({ input }) => {
      await getDb().update(s.polizas).set(input.datos).where(eq(s.polizas.id, input.id));
      return { id: input.id };
    }),
});
