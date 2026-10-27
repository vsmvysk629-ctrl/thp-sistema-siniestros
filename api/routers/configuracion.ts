import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as s from "@db/schema";
import { RAMOS } from "@contracts/catalogos";
import { adminQuery, authedQuery, createRouter } from "../middleware";
import { getDb } from "../queries/connection";
import { AJUSTES_DEFAULT, documentosDe, leerAjustes } from "../queries/configuracion";

const nombre = (max: number) => z.string().trim().min(1, "Escribe el nombre.").max(max);
const opcional = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);

/** Catálogos y ajustes que el administrador adapta a la forma de trabajar de la oficina. */
export const configuracionRouter = createRouter({
  /** Lo que necesitan las pantallas: ajustes, tipos por ramo y aseguradoras (incluidas inactivas). */
  get: authedQuery.query(async () => {
    const db = getDb();
    const [ajustes, tipos, aseguradoras] = await Promise.all([
      leerAjustes(db),
      db.select().from(s.tiposSiniestro).orderBy(asc(s.tiposSiniestro.ramo), asc(s.tiposSiniestro.orden), asc(s.tiposSiniestro.id)),
      db.select().from(s.aseguradoras).orderBy(asc(s.aseguradoras.nombre)),
    ]);
    return { ajustes, tipos, aseguradoras };
  }),

  /** Lista de documentos que se pedirá para un ramo, tipo y aseguradora. */
  documentosPreview: authedQuery
    .input(z.object({ ramo: z.enum(RAMOS), tipo: z.string().max(64), aseguradoraId: z.number().nullish() }))
    .query(({ input }) => documentosDe(getDb(), input.ramo, input.tipo, input.aseguradoraId ?? null)),

  plantillas: adminQuery.query(() =>
    getDb()
      .select()
      .from(s.plantillasDocumento)
      .orderBy(asc(s.plantillasDocumento.ramo), asc(s.plantillasDocumento.orden), asc(s.plantillasDocumento.id)),
  ),

  guardarTipo: adminQuery
    .input(z.object({ id: z.number().optional(), ramo: z.enum(RAMOS), nombre: nombre(64), activo: z.boolean().default(true) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [dup] = await db
        .select({ id: s.tiposSiniestro.id })
        .from(s.tiposSiniestro)
        .where(and(eq(s.tiposSiniestro.ramo, input.ramo), eq(s.tiposSiniestro.nombre, input.nombre), input.id ? ne(s.tiposSiniestro.id, input.id) : undefined));
      if (dup) throw new TRPCError({ code: "CONFLICT", message: "Ese tipo ya existe en el ramo." });
      if (input.id) {
        await db.update(s.tiposSiniestro).set({ nombre: input.nombre, activo: input.activo }).where(eq(s.tiposSiniestro.id, input.id));
        return { id: input.id };
      }
      const [{ id }] = await db.insert(s.tiposSiniestro).values({ ramo: input.ramo, nombre: input.nombre, orden: 999 }).$returningId();
      return { id };
    }),

  guardarPlantilla: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        ramo: z.enum(RAMOS),
        tipo: opcional(64),
        aseguradoraId: z.number().nullish(),
        nombre: nombre(255),
        activo: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...v } = input;
      const valores = { ...v, aseguradoraId: v.aseguradoraId ?? null };
      if (id) {
        await getDb().update(s.plantillasDocumento).set(valores).where(eq(s.plantillasDocumento.id, id));
        return { id };
      }
      const [r] = await getDb().insert(s.plantillasDocumento).values({ ...valores, orden: 999 }).$returningId();
      return { id: r.id };
    }),

  /** Quitar una plantilla no afecta a los expedientes ya abiertos: cada uno guarda su propia lista. */
  quitarPlantilla: adminQuery.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await getDb().delete(s.plantillasDocumento).where(eq(s.plantillasDocumento.id, input.id));
    return { ok: true };
  }),

  guardarAseguradora: adminQuery
    .input(
      z.object({
        id: z.number().optional(),
        nombre: nombre(64),
        telefonoCabina: opcional(32),
        diasSinRespuesta: z.number().int().min(1).max(365).nullish(),
        notas: opcional(500),
        activa: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...v } = input;
      const valores = { ...v, diasSinRespuesta: v.diasSinRespuesta ?? null };
      const [dup] = await db
        .select({ id: s.aseguradoras.id })
        .from(s.aseguradoras)
        .where(and(eq(s.aseguradoras.nombre, v.nombre), id ? ne(s.aseguradoras.id, id) : undefined));
      if (dup) throw new TRPCError({ code: "CONFLICT", message: "Ya existe una aseguradora con ese nombre." });
      if (id) {
        await db.update(s.aseguradoras).set(valores).where(eq(s.aseguradoras.id, id));
        return { id };
      }
      const [r] = await db.insert(s.aseguradoras).values(valores).$returningId();
      return { id: r.id };
    }),

  guardarAjustes: adminQuery
    .input(
      z.object({
        diasSinMovimiento: z.number().int().min(1).max(365),
        diasCompromisoInicial: z.number().int().min(0).max(60),
        accionInicial: nombre(500),
        nombreAgencia: nombre(128),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      for (const clave of Object.keys(AJUSTES_DEFAULT) as (keyof typeof AJUSTES_DEFAULT)[]) {
        const valor = String(input[clave]);
        await db.insert(s.ajustes).values({ clave, valor }).onDuplicateKeyUpdate({ set: { valor } });
      }
      return leerAjustes(db);
    }),
});
