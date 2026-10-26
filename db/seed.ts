/**
 * Datos FICTICIOS para probar el sistema en desarrollo. Nunca cargar la cartera real aquí.
 * Uso: npm run db:seed (con DATABASE_URL apuntando a una base de desarrollo).
 */
import { eq } from "drizzle-orm";
import * as s from "./schema";
import { getDb } from "../api/queries/connection";
import { hashPassword } from "../api/auth/password";
import { asegurarAseguradoras } from "../api/auth-router";
import { createCallerFactory } from "../api/middleware";
import { appRouter } from "../api/router";
import type { Rol } from "../contracts/constants";

if (process.env.NODE_ENV === "production") throw new Error("El seed de demo no corre en producción.");

const PASSWORD = "Demo2026demo";
const db = getDb();

if ((await db.select({ id: s.siniestros.id }).from(s.siniestros).limit(1)).length) {
  console.log("La base ya tiene siniestros; no se siembra nada.");
  process.exit(0);
}

await asegurarAseguradoras();
const aseg = Object.fromEntries((await db.select().from(s.aseguradoras)).map((a) => [a.nombre, a.id]));

async function usuario(username: string, nombre: string, role: Rol) {
  const ya = await db.query.users.findFirst({ where: eq(s.users.username, username) });
  if (ya) return ya;
  await db.insert(s.users).values({ username, nombre, role, passwordHash: await hashPassword(PASSWORD) });
  return (await db.query.users.findFirst({ where: eq(s.users.username, username) }))!;
}

await usuario("admin", "Admin Demo", "admin");
const oficina = await usuario("oficina", "Oficina Demo", "siniestros");
const vendedor = await usuario("vendedor", "Vendedor Demo", "vendedor");
const call = createCallerFactory(appRouter)({ req: new Request("http://localhost/"), resHeaders: new Headers(), user: oficina });

const clientes = [
  { nombre: "Ana Prueba Ficticia", telefono: "3300000001", vendedorId: vendedor.id },
  { nombre: "Bruno Demo Ejemplo", telefono: "3300000002", vendedorId: vendedor.id },
  { nombre: "Carla Muestra Test", telefono: "3300000003", vendedorId: null },
  { nombre: "Transportes Ficticios SA de CV", telefono: "3300000004", vendedorId: null },
];
const vehiculos = [
  ["Nissan", "Versa", 2021], ["Volkswagen", "Jetta", 2019], ["Chevrolet", "Aveo", 2023], ["Toyota", "Hilux", 2022],
] as const;
const polizas: number[] = [];
for (const [i, c] of clientes.entries()) {
  const { id: clienteId } = await call.catalogos.crearCliente(c);
  const [marca, modelo, anio] = vehiculos[i];
  const { id } = await call.catalogos.crearPoliza({
    numero: `DEMO-${1000 + i}`,
    aseguradoraId: aseg[["Quálitas", "Atlas", "Potosí", "Quálitas"][i]],
    clienteId,
    cobertura: "amplia",
    vigenciaInicio: "2026-01-01",
    vigenciaFin: "2027-01-01",
    vehiculoMarca: marca,
    vehiculoModelo: modelo,
    vehiculoAnio: anio,
    vehiculoPlacas: `DEM${100 + i}X`,
  });
  polizas.push(id);
}

type Paso = Parameters<typeof call.siniestros.cambiarEstado>[0];
const casos: { poliza: number; tipo: "colision" | "robo_total" | "cristales" | "rc_terceros"; dias: number; pasos: Omit<Paso, "id">[] }[] = [
  { poliza: polizas[0], tipo: "colision", dias: 2, pasos: [] },
  { poliza: polizas[1], tipo: "colision", dias: 6, pasos: [{ destino: "ajustador_asignado" }, { destino: "valuacion" }] },
  {
    poliza: polizas[2], tipo: "colision", dias: 15,
    pasos: [{ destino: "ajustador_asignado" }, { destino: "valuacion" }, { destino: "orden_admision", folio: "OA-DEMO-1", montoAutorizado: "38500" }, { destino: "en_reparacion" }],
  },
  {
    poliza: polizas[3], tipo: "robo_total", dias: 30,
    pasos: [{ destino: "ajustador_asignado" }, { destino: "perdida_total", folio: "DICT-DEMO-1" }, { destino: "documentos_indemnizacion" }],
  },
  { poliza: polizas[0], tipo: "cristales", dias: 40, pasos: [{ destino: "ajustador_asignado" }, { destino: "valuacion" }, { destino: "pago_danos", folio: "PD-DEMO-1", montoAutorizado: "4200" }] },
  { poliza: polizas[2], tipo: "rc_terceros", dias: 60, pasos: [{ destino: "cancelado", nota: "El cliente arregló directo con el tercero (demo)." }] },
];
for (const [i, c] of casos.entries()) {
  const fecha = new Date(Date.now() - c.dias * 86_400_000).toISOString().slice(0, 16).replace("T", " ");
  const { id, folio } = await call.siniestros.create({
    polizaId: c.poliza, tipo: c.tipo, fechaOcurrido: fecha, responsabilidad: "por_definir",
    numeroReporte: `REP-DEMO-${i + 1}`, ajustadorNombre: "Ajustador Demo", ajustadorTelefono: "3300000099",
    tallerNombre: "Taller Demo", lugar: "Av. Ficticia 123, Guadalajara", descripcion: "Caso de demostración con datos ficticios.",
  });
  for (const p of c.pasos) await call.siniestros.cambiarEstado({ id, ...p });
  // Simula antigüedad para que se vean los "sin movimiento"
  await db.update(s.siniestros).set({ ultimoMovimiento: new Date(Date.now() - c.dias * 86_400_000) }).where(eq(s.siniestros.id, id));
  console.log(`  ${folio} (${c.tipo})`);
}
console.log(`Listo. Usuarios: admin / oficina / vendedor, contraseña ${PASSWORD}`);
process.exit(0);
