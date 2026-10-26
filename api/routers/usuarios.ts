import { asc, eq } from "drizzle-orm";
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
    const rows = await getDb().select().from(s.users).orderBy(asc(s.users.nombre));
    return rows.map((u) => ({ ...usuarioPublico(u), activo: u.activo }));
  }),

  /** Crea el usuario con una contraseña temporal que se muestra una sola vez. */
  crear: adminQuery
    .input(
      z.object({
        username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,64}$/, "Usuario: 3+ letras, números, punto o guion."),
        nombre: z.string().trim().min(1).max(128),
        role: z.enum(ROLES),
      }),
    )
    .mutation(async ({ input }) => {
      const existe = await getDb().query.users.findFirst({ where: eq(s.users.username, input.username) });
      if (existe) throw new TRPCError({ code: "CONFLICT", message: "Ese usuario ya existe." });
      const temporal = passwordTemporal();
      const [{ id }] = await getDb()
        .insert(s.users)
        .values({ ...input, passwordHash: await hashPassword(temporal), debeCambiarPassword: true })
        .$returningId();
      return { id, passwordTemporal: temporal };
    }),

  activar: adminQuery.input(z.object({ id: z.number(), activo: z.boolean() })).mutation(async ({ ctx, input }) => {
    if (input.id === ctx.user.id && !input.activo) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes desactivarte a ti mismo." });
    }
    await getDb().update(s.users).set({ activo: input.activo }).where(eq(s.users.id, input.id));
    return { ok: true };
  }),
});
