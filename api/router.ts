import { authRouter } from "./auth-router";
import { createRouter } from "./middleware";
import { catalogosRouter } from "./routers/catalogos";
import { expedienteRouter } from "./routers/expediente";
import { siniestrosRouter } from "./routers/siniestros";
import { tableroRouter } from "./routers/tablero";
import { usuariosRouter } from "./routers/usuarios";

export const appRouter = createRouter({
  auth: authRouter,
  catalogos: catalogosRouter,
  siniestros: siniestrosRouter,
  expediente: expedienteRouter,
  tablero: tableroRouter,
  usuarios: usuariosRouter,
});

export type AppRouter = typeof appRouter;
