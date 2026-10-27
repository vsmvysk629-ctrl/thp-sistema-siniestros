import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { asegurarAdministrador, asegurarAseguradoras } from "./auth-router";
import { asegurarCatalogos } from "./queries/configuracion";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 10 * 1024 * 1024 }));
// Cabeceras básicas de seguridad
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  if (env.isProduction) c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
});
app.use("/api/trpc/*", async (c) =>
  fetchRequestHandler({ endpoint: "/api/trpc", req: c.req.raw, router: appRouter, createContext }),
);
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  // Aplica las migraciones pendientes antes de atender.
  const { migrate } = await import("drizzle-orm/mysql2/migrator");
  const { getDb } = await import("./queries/connection");
  const path = await import("path");
  await migrate(getDb(), { migrationsFolder: path.resolve(import.meta.dirname, "../db/migrations") });
}

if (process.env.VITEST === undefined) {
  await asegurarAseguradoras().catch((e) => console.error("[boot] No se pudieron crear las aseguradoras", e));
  await asegurarCatalogos().catch((e) => console.error("[boot] No se pudieron crear los catálogos", e));
  await asegurarAdministrador({
    username: env.adminUsername,
    password: env.adminPassword,
    nombre: env.adminName,
  }).catch((e) => console.error("[auth] No se pudo verificar el administrador inicial", e));
}

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);
  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => console.log(`Servidor en http://localhost:${port}/`));
}
