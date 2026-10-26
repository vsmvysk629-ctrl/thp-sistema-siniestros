import { and, asc, desc, eq, inArray, like, or } from "drizzle-orm";
import { z } from "zod";
import * as s from "@db/schema";
import { authedQuery, createRouter, oficinaQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { assertCliente, assertPoliza, esVendedor } from "../auth/alcance";

const texto = (max = 255) => z.string().trim().max(max).nullish().transform((v) => v || null);

const clienteInput = z.object({
  nombre: z.string().trim().min(1).max(255),
  telefono: texto(32),
  email: texto(255),
  vendedorId: z.number().nullish(),
});

const polizaInput = z.object({
  numero: z.string().trim().min(1).max(64),
  aseguradoraId: z.number(),
  clienteId: z.number(),
  vigenciaInicio: texto(10),
  vigenciaFin: texto(10),
  cobertura: z.enum(["amplia", "limitada", "rc"]).default("amplia"),
  vehiculoMarca: texto(64),
  vehiculoModelo: texto(64),
  vehiculoAnio: z.number().int().min(1950).max(2100).nullish(),
  vehiculoPlacas: texto(16),
  vehiculoSerie: texto(32),
});

export const catalogosRouter = createRouter({
  aseguradoras: authedQuery.query(() =>
    getDb().select().from(s.aseguradoras).where(eq(s.aseguradoras.activa, true)).orderBy(asc(s.aseguradoras.nombre)),
  ),

  clientes: authedQuery.input(z.object({ busqueda: z.string().optional() })).query(async ({ ctx, input }) => {
    const conds = [
      esVendedor(ctx.user) ? eq(s.clientes.vendedorId, ctx.user.id) : undefined,
      input.busqueda ? like(s.clientes.nombre, `%${input.busqueda}%`) : undefined,
    ].filter((c) => c !== undefined);
    return getDb()
      .select()
      .from(s.clientes)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(asc(s.clientes.nombre))
      .limit(500);
  }),

  crearCliente: oficinaQuery.input(clienteInput).mutation(async ({ input }) => {
    const [{ id }] = await getDb().insert(s.clientes).values(input).$returningId();
    return { id };
  }),

  editarCliente: oficinaQuery
    .input(z.object({ id: z.number(), datos: clienteInput.partial() }))
    .mutation(async ({ input }) => {
      await getDb().update(s.clientes).set(input.datos).where(eq(s.clientes.id, input.id));
      return { id: input.id };
    }),

  /** Pólizas con cliente y aseguradora, para buscar al dar de alta un siniestro. */
  polizas: authedQuery
    .input(z.object({ busqueda: z.string().optional(), clienteId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const b = input.busqueda?.trim();
      const conds = [
        esVendedor(ctx.user) ? eq(s.clientes.vendedorId, ctx.user.id) : undefined,
        input.clienteId ? eq(s.polizas.clienteId, input.clienteId) : undefined,
        b
          ? or(
              like(s.polizas.numero, `%${b}%`),
              like(s.clientes.nombre, `%${b}%`),
              like(s.polizas.vehiculoPlacas, `%${b}%`),
              like(s.polizas.vehiculoSerie, `%${b}%`),
            )
          : undefined,
      ].filter((c) => c !== undefined);
      return getDb()
        .select({
          poliza: s.polizas,
          cliente: { id: s.clientes.id, nombre: s.clientes.nombre },
          aseguradora: { id: s.aseguradoras.id, nombre: s.aseguradoras.nombre },
        })
        .from(s.polizas)
        .innerJoin(s.clientes, eq(s.clientes.id, s.polizas.clienteId))
        .innerJoin(s.aseguradoras, eq(s.aseguradoras.id, s.polizas.aseguradoraId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(s.polizas.id))
        .limit(200);
    }),

  poliza: authedQuery.input(z.object({ id: z.number() })).query(({ ctx, input }) => assertPoliza(ctx.user, input.id)),

  crearPoliza: oficinaQuery.input(polizaInput).mutation(async ({ ctx, input }) => {
    await assertCliente(ctx.user, input.clienteId);
    const [{ id }] = await getDb().insert(s.polizas).values(input).$returningId();
    return { id };
  }),

  editarPoliza: oficinaQuery
    .input(z.object({ id: z.number(), datos: polizaInput.partial() }))
    .mutation(async ({ input }) => {
      await getDb().update(s.polizas).set(input.datos).where(eq(s.polizas.id, input.id));
      return { id: input.id };
    }),

  /** Nombres de usuarios activos, para elegir responsable o vendedor. */
  usuarios: authedQuery.query(() =>
    getDb()
      .select({ id: s.users.id, nombre: s.users.nombre, role: s.users.role })
      .from(s.users)
      .where(and(eq(s.users.activo, true), inArray(s.users.role, ["admin", "siniestros", "vendedor"])))
      .orderBy(asc(s.users.nombre)),
  ),
});
