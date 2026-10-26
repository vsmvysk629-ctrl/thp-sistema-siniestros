import { authRouter } from "./auth-router";
import { createRouter } from "./middleware";
import { catalogosRouter } from "./routers/catalogos";
import { siniestrosRouter } from "./routers/siniestros";
import { usuariosRouter } from "./routers/usuarios";

export const appRouter = createRouter({
  auth: authRouter,
  catalogos: catalogosRouter,
  siniestros: siniestrosRouter,
  usuarios: usuariosRouter,
});

export type AppRouter = typeof appRouter;
