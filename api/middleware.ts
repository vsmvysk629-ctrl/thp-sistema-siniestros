import { ErrorMessages, type Rol } from "@contracts/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicQuery = t.procedure;

/** Solo exige sesión (sirve para cambiar la contraseña temporal). */
export const sesionQuery = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: ErrorMessages.unauthenticated });
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);

/** Procedimiento para los roles dados. "admin" pasa siempre. */
export function roleQuery(...roles: Rol[]) {
  return t.procedure.use(
    t.middleware(async ({ ctx, next }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: ErrorMessages.unauthenticated });
      }
      if (ctx.user.debeCambiarPassword) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Debes cambiar tu contraseña temporal antes de continuar." });
      }
      if (ctx.user.role === "admin" || roles.includes(ctx.user.role)) {
        return next({ ctx: { ...ctx, user: ctx.user } });
      }
      throw new TRPCError({ code: "FORBIDDEN", message: ErrorMessages.insufficientRole });
    }),
  );
}

/** Ver, reportes y exportar: todos los roles. */
export const authedQuery = roleQuery("ejecutivo", "consulta");
/** Crear y editar (el ejecutivo, solo lo suyo: ver api/auth/alcance.ts). */
export const editorQuery = roleQuery("ejecutivo");
export const adminQuery = roleQuery();
