import { authRouter } from "./auth-router";
import { createRouter } from "./middleware";
import { catalogosRouter } from "./routers/catalogos";
import { configuracionRouter } from "./routers/configuracion";
import { expedienteRouter } from "./routers/expediente";
import { siniestrosRouter } from "./routers/siniestros";
import { tableroRouter } from "./routers/tablero";
import { usuariosRouter } from "./routers/usuarios";
import { seguimientoRouter } from "./routers/seguimiento";

export const appRouter = createRouter({
  auth: authRouter,
  catalogos: catalogosRouter,
  configuracion: configuracionRouter,
  siniestros: siniestrosRouter,
  expediente: expedienteRouter,
  tablero: tableroRouter,
  usuarios: usuariosRouter,
  seguimiento: seguimientoRouter,
});

export type AppRouter = typeof appRouter;
