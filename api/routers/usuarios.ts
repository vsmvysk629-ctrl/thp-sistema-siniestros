import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as s from "@db/schema";
import { ROLES } from "@contracts/constants";
import { adminQuery, createRouter } from "../middleware";
import { getDb } from "../queries/connection";
import { hashPassword, passwordTemporal } from "../auth/password";
import { usuarioPublico } from "../auth-router";

export const usuariosRouter = createRouter({
  list: adminQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(s.users).orderBy(asc(s.users.nombre));
    const cargas = await db
      .select({ ejecutivoId: s.siniestros.ejecutivoId, n: sql<number>`count(*)` })
      .from(s.siniestros)
      .where(sql`${s.siniestros.estado} <> 'cerrado'`)
      .groupBy(s.siniestros.ejecutivoId);
    const carga = new Map(cargas.map((c) => [c.ejecutivoId, Number(c.n)]));
    return rows.map((u) => ({ ...usuarioPublico(u), activo: u.activo, ultimoAcceso: u.ultimoAcceso, abiertos: carga.get(u.id) ?? 0 }));
  }),

  /** Crea el usuario con una contraseña temporal que se muestra una sola vez. */
  crear: adminQuery
    .input(
      z.object({
        username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,64}$/, "Usuario: 3+ letras, números, punto o guion."),
        nombre: z.string().trim().min(1).max(128),
        puesto: z.string().trim().max(128).nullish().transform((v) => v || null),
        role: z.enum(ROLES),
      }),
    )
    .mutation(async ({ input }) => {
      const [existe] = await getDb().select({ id: s.users.id }).from(s.users).where(eq(s.users.username, input.username));
      if (existe) throw new TRPCError({ code: "CONFLICT", message: "Ese usuario ya existe." });
      const temporal = passwordTemporal();
      const [{ id }] = await getDb()
        .insert(s.users)
        .values({ ...input, passwordHash: await hashPassword(temporal), debeCambiarPassword: true })
        .$returningId();
      return { id, passwordTemporal: temporal };
    }),

  editar: adminQuery
    .input(z.object({ id: z.number(), activo: z.boolean().optional(), role: z.enum(ROLES).optional(), puesto: z.string().trim().max(128).nullish() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.user.id && (input.activo === false || (input.role && input.role !== "admin"))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes quitarte a ti mismo el acceso de administrador." });
      }
      const { id, ...cambios } = input;
      await getDb().update(s.users).set(cambios).where(eq(s.users.id, id));
      return { ok: true };
    }),

  /**
   * Nueva contraseña temporal para quien olvidó la suya. Las sesiones abiertas de ese usuario
   * dejan de servir y al entrar se le pide cambiarla.
   */
  restablecer: adminQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    if (input.id === ctx.user.id) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Para tu propia contraseña usa \"Cambiar contraseña\"." });
    }
    const [u] = await getDb().select({ id: s.users.id }).from(s.users).where(eq(s.users.id, input.id));
    if (!u) throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado." });
    const temporal = passwordTemporal();
    await getDb()
      .update(s.users)
      .set({ passwordHash: await hashPassword(temporal), debeCambiarPassword: true, intentosFallidos: 0, bloqueadoHasta: null })
      .where(eq(s.users.id, input.id));
    return { passwordTemporal: temporal };
  }),
});
