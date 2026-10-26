import {
  bigint,
  boolean,
  date,
  datetime,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { ROLES } from "../contracts/constants";
import { ESTADOS, RESPONSABILIDADES, TIPOS } from "../contracts/flujo";

const id = () => bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey();
const ref = (name: string) => bigint(name, { mode: "number", unsigned: true });
const refReq = (name: string) => ref(name).notNull();
const creado = () => timestamp("createdAt").defaultNow().notNull();
const actualizado = () =>
  timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------
export const users = mysqlTable("users", {
  id: id(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  nombre: varchar("nombre", { length: 128 }).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ROLES).default("vendedor").notNull(),
  activo: boolean("activo").default(true).notNull(),
  debeCambiarPassword: boolean("debeCambiarPassword").default(false).notNull(),
  intentosFallidos: int("intentosFallidos").default(0).notNull(),
  bloqueadoHasta: timestamp("bloqueadoHasta"),
  createdAt: creado(),
  updatedAt: actualizado(),
});
export type User = typeof users.$inferSelect;

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------
export const aseguradoras = mysqlTable("aseguradoras", {
  id: id(),
  nombre: varchar("nombre", { length: 64 }).notNull().unique(),
  telefonoCabina: varchar("telefonoCabina", { length: 32 }),
  activa: boolean("activa").default(true).notNull(),
});
export type Aseguradora = typeof aseguradoras.$inferSelect;

export const clientes = mysqlTable(
  "clientes",
  {
    id: id(),
    nombre: varchar("nombre", { length: 255 }).notNull(),
    telefono: varchar("telefono", { length: 32 }),
    email: varchar("email", { length: 255 }),
    vendedorId: ref("vendedorId"),
    createdAt: creado(),
    updatedAt: actualizado(),
  },
  (t) => [index("cli_vend_idx").on(t.vendedorId)],
);
export type Cliente = typeof clientes.$inferSelect;

/** Póliza de autos: el vehículo asegurado vive en la póliza. */
export const polizas = mysqlTable(
  "polizas",
  {
    id: id(),
    numero: varchar("numero", { length: 64 }).notNull(),
    aseguradoraId: refReq("aseguradoraId"),
    clienteId: refReq("clienteId"),
    vigenciaInicio: date("vigenciaInicio", { mode: "string" }),
    vigenciaFin: date("vigenciaFin", { mode: "string" }),
    cobertura: mysqlEnum("cobertura", ["amplia", "limitada", "rc"]).default("amplia").notNull(),
    vehiculoMarca: varchar("vehiculoMarca", { length: 64 }),
    vehiculoModelo: varchar("vehiculoModelo", { length: 64 }),
    vehiculoAnio: int("vehiculoAnio"),
    vehiculoPlacas: varchar("vehiculoPlacas", { length: 16 }),
    vehiculoSerie: varchar("vehiculoSerie", { length: 32 }),
    createdAt: creado(),
    updatedAt: actualizado(),
  },
  (t) => [index("pol_cli_idx").on(t.clienteId), index("pol_num_idx").on(t.aseguradoraId, t.numero)],
);
export type Poliza = typeof polizas.$inferSelect;

// ---------------------------------------------------------------------------
// Siniestros
// ---------------------------------------------------------------------------
export const siniestros = mysqlTable(
  "siniestros",
  {
    id: id(),
    /** Folio interno de THP, p. ej. SIN-2026-0001. */
    folio: varchar("folio", { length: 32 }).notNull().unique(),
    polizaId: refReq("polizaId"),
    clienteId: refReq("clienteId"),
    aseguradoraId: refReq("aseguradoraId"),
    // Lo que da la aseguradora
    numeroReporte: varchar("numeroReporte", { length: 64 }),
    numeroSiniestro: varchar("numeroSiniestro", { length: 64 }),
    ajustadorNombre: varchar("ajustadorNombre", { length: 128 }),
    ajustadorTelefono: varchar("ajustadorTelefono", { length: 32 }),
    // El hecho
    tipo: mysqlEnum("tipo", TIPOS).notNull(),
    fechaOcurrido: datetime("fechaOcurrido", { mode: "string" }).notNull(),
    lugar: varchar("lugar", { length: 255 }),
    descripcion: text("descripcion"),
    conductorNombre: varchar("conductorNombre", { length: 128 }),
    responsabilidad: mysqlEnum("responsabilidad", RESPONSABILIDADES).default("por_definir").notNull(),
    // Reparación y montos (montoAutorizado solo cambia con folio de la aseguradora)
    tallerNombre: varchar("tallerNombre", { length: 128 }),
    deducible: decimal("deducible", { precision: 12, scale: 2 }),
    montoEstimado: decimal("montoEstimado", { precision: 12, scale: 2 }),
    montoAutorizado: decimal("montoAutorizado", { precision: 12, scale: 2 }),
    estado: mysqlEnum("estado", ESTADOS).default("reportado").notNull(),
    responsableId: ref("responsableId"),
    creadoPorId: ref("creadoPorId"),
    ultimoMovimiento: timestamp("ultimoMovimiento").defaultNow().notNull(),
    createdAt: creado(),
    updatedAt: actualizado(),
  },
  (t) => [
    index("sin_pol_idx").on(t.polizaId),
    index("sin_cli_idx").on(t.clienteId),
    index("sin_aseg_estado_idx").on(t.aseguradoraId, t.estado),
  ],
);
export type Siniestro = typeof siniestros.$inferSelect;

/** Historial: cada alta, cambio de estado, edición y nota. Nunca se borra ni se edita. */
export const siniestroEventos = mysqlTable(
  "siniestro_eventos",
  {
    id: id(),
    siniestroId: refReq("siniestroId"),
    tipo: mysqlEnum("tipo", ["alta", "cambio_estado", "edicion", "nota", "tercero"]).notNull(),
    estadoAnterior: mysqlEnum("estadoAnterior", ESTADOS),
    estadoNuevo: mysqlEnum("estadoNuevo", ESTADOS),
    /** Folio o referencia de la aseguradora que respalda el cambio. */
    folio: varchar("folio", { length: 128 }),
    nota: text("nota"),
    autorId: ref("autorId"),
    createdAt: creado(),
  },
  (t) => [index("evt_sin_idx").on(t.siniestroId)],
);
export type SiniestroEvento = typeof siniestroEventos.$inferSelect;

export const terceros = mysqlTable(
  "terceros",
  {
    id: id(),
    siniestroId: refReq("siniestroId"),
    nombre: varchar("nombre", { length: 255 }).notNull(),
    telefono: varchar("telefono", { length: 32 }),
    vehiculo: varchar("vehiculo", { length: 128 }),
    placas: varchar("placas", { length: 16 }),
    aseguradora: varchar("aseguradora", { length: 64 }),
    notas: text("notas"),
    createdAt: creado(),
  },
  (t) => [index("ter_sin_idx").on(t.siniestroId)],
);
export type Tercero = typeof terceros.$inferSelect;
