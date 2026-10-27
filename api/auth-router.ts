import * as cookie from "cookie";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as s from "@db/schema";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, publicQuery, sesionQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { hashPassword, passwordProblema, verifyPassword } from "./auth/password";
import { huellaPassword, sessionCookie, signSessionToken } from "./auth/session";

const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;
const HASH_FALSO = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

/** Datos del usuario que sí puede ver el navegador (nunca el hash). */
export function usuarioPublico(u: s.User) {
  return {
    id: u.id,
    nombre: u.nombre,
    puesto: u.puesto,
    username: u.username,
    role: u.role,
    debeCambiarPassword: u.debeCambiarPassword,
  };
}

const credencialInvalida = () =>
  new TRPCError({ code: "UNAUTHORIZED", message: "Usuario o contraseña incorrectos." });

export const authRouter = createRouter({
  me: publicQuery.query(({ ctx }) => (ctx.user ? usuarioPublico(ctx.user) : null)),

  login: publicQuery
    .input(z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [user] = await db.select().from(s.users).where(eq(s.users.username, input.username.toLowerCase()));
      if (!user || !user.passwordHash || !user.activo) {
        await verifyPassword(input.password, HASH_FALSO);
        throw credencialInvalida();
      }
      if (user.bloqueadoHasta && user.bloqueadoHasta > new Date()) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Demasiados intentos. Intenta de nuevo en unos minutos." });
      }
      if (!(await verifyPassword(input.password, user.passwordHash))) {
        const intentos = user.intentosFallidos + 1;
        await db
          .update(s.users)
          .set({
            intentosFallidos: intentos >= MAX_INTENTOS ? 0 : intentos,
            bloqueadoHasta: intentos >= MAX_INTENTOS ? new Date(Date.now() + BLOQUEO_MIN * 60_000) : null,
          })
          .where(eq(s.users.id, user.id));
        throw credencialInvalida();
      }
      await db.update(s.users).set({ intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() }).where(eq(s.users.id, user.id));
      const token = await signSessionToken({ uid: user.id, pv: huellaPassword(user.passwordHash) });
      ctx.resHeaders.append("set-cookie", sessionCookie(ctx.req.headers, token, Math.floor(Session.maxAgeMs / 1000)));
      return usuarioPublico(user);
    }),

  cambiarPassword: sesionQuery
    .input(z.object({ actual: z.string().min(1).max(200), nueva: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      if (!(await verifyPassword(input.actual, ctx.user.passwordHash))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La contraseña actual no es correcta." });
      }
      const problema = passwordProblema(input.nueva);
      if (problema) throw new TRPCError({ code: "BAD_REQUEST", message: problema });
      if (input.nueva === input.actual) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La nueva contraseña debe ser distinta." });
      }
      const hash = await hashPassword(input.nueva);
      await getDb().update(s.users).set({ passwordHash: hash, debeCambiarPassword: false }).where(eq(s.users.id, ctx.user.id));
      const token = await signSessionToken({ uid: ctx.user.id, pv: huellaPassword(hash) });
      ctx.resHeaders.append("set-cookie", sessionCookie(ctx.req.headers, token, Math.floor(Session.maxAgeMs / 1000)));
      return { ok: true };
    }),

  logout: publicQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", { httpOnly: true, path: "/", sameSite: "lax", secure: opts.secure, maxAge: 0 }),
    );
    return { ok: true };
  }),
});

/** Crea el primer administrador desde variables de entorno si no hay ninguno. */
export async function asegurarAdministrador(datos: { username: string; password: string; nombre: string }) {
  if (!datos.username || !datos.password) return;
  const db = getDb();
  const rows = await db.select({ n: sql<number>`count(*)` }).from(s.users).where(eq(s.users.role, "admin"));
  if (Number(rows[0]?.n ?? 0) > 0) return;
  const problema = passwordProblema(datos.password);
  if (problema) {
    console.error(`[auth] ADMIN_PASSWORD no es válida: ${problema}`);
    return;
  }
  await db.insert(s.users).values({
    username: datos.username.toLowerCase(),
    nombre: datos.nombre,
    role: "admin",
    passwordHash: await hashPassword(datos.password),
    debeCambiarPassword: true,
  });
}

/** Aseguradoras con las que trabaja la oficina. Se crean al arrancar si faltan. */
export const ASEGURADORAS = ["Quálitas", "Atlas", "Potosí"];

export async function asegurarAseguradoras() {
  const db = getDb();
  for (const nombre of ASEGURADORAS) {
    await db.insert(s.aseguradoras).values({ nombre }).onDuplicateKeyUpdate({ set: { nombre } });
  }
}
