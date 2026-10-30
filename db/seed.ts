/**
 * Datos FICTICIOS para probar el sistema en desarrollo. Nunca cargar la cartera real aquí.
 * Uso: npm run db:seed (con DATABASE_URL apuntando a una base de desarrollo).
 */
import * as s from "./schema";
import { getDb } from "../api/queries/connection";
import { PASSWORD_DEMO, sembrarDatosDemo } from "./datos-demo";

if (process.env.NODE_ENV === "production") throw new Error("El seed de demo no corre en producción.");

if ((await getDb().select({ id: s.siniestros.id }).from(s.siniestros).limit(1)).length) {
  console.log("La base ya tiene siniestros; no se siembra nada.");
  process.exit(0);
}

await sembrarDatosDemo();
console.log(`Listo. Usuarios: admin, laura, oscar, marta, consulta · contraseña ${PASSWORD_DEMO}`);
process.exit(0);
