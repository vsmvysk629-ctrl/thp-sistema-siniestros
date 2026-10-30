import {
  bigint,
  boolean,
  date,
  decimal,
  index,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { ROLES } from "../contracts/constants";
import { DICTAMENES, DOC_ESTADOS, RAMOS, RESPONSABILIDADES } from "../contracts/catalogos";
import { ESTADOS } from "../contracts/flujo";
import { BORRADOR_ESTADOS, DESTINOS, MOTIVOS } from "../contracts/borradores";

const id = () => bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey();
const ref = (name: string) => bigint(name, { mode: "number", unsigned: true });
const refReq = (name: string) => ref(name).notNull();
const dinero = (name: string) => decimal(name, { precision: 14, scale: 2 });
const fecha = (name: string) => date(name, { mode: "string" });
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
  puesto: varchar("puesto", { length: 128 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ROLES).default("ejecutivo").notNull(),
  activo: boolean("activo").default(true).notNull(),
  debeCambiarPassword: boolean("debeCambiarPassword").default(false).notNull(),
  intentosFallidos: int("intentosFallidos").default(0).notNull(),
  bloqueadoHasta: timestamp("bloqueadoHasta"),
  ultimoAcceso: timestamp("ultimoAcceso"),
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
  /** Días sin respuesta de esta compañía antes de avisar. Vacío = el valor general. */
  diasSinRespuesta: int("diasSinRespuesta"),
  notas: varchar("notas", { length: 500 }),
  activa: boolean("activa").default(true).notNull(),
});
export type Aseguradora = typeof aseguradoras.$inferSelect;

export const contratantes = mysqlTable(
  "contratantes",
  {
    id: id(),
    nombre: varchar("nombre", { length: 255 }).notNull(),
    tipoPersona: mysqlEnum("tipoPersona", ["fisica", "moral"]).default("fisica").notNull(),
    rfc: varchar("rfc", { length: 16 }),
    contacto: varchar("contacto", { length: 255 }),
    telefono: varchar("telefono", { length: 32 }),
    email: varchar("email", { length: 255 }),
    ejecutivoId: ref("ejecutivoId"),
    clienteDesde: int("clienteDesde"),
    createdAt: creado(),
    updatedAt: actualizado(),
  },
  (t) => [index("con_nombre_idx").on(t.nombre)],
);
export type Contratante = typeof contratantes.$inferSelect;

export const polizas = mysqlTable(
  "polizas",
  {
    id: id(),
    numero: varchar("numero", { length: 64 }).notNull(),
    aseguradoraId: refReq("aseguradoraId"),
    contratanteId: refReq("contratanteId"),
    ramo: mysqlEnum("ramo", RAMOS).notNull(),
    /** Detalle libre, p. ej. "22 unidades" o "48 asegurados". */
    descripcion: varchar("descripcion", { length: 255 }),
    vigenciaInicio: fecha("vigenciaInicio"),
    vigenciaFin: fecha("vigenciaFin"),
    createdAt: creado(),
    updatedAt: actualizado(),
  },
  (t) => [index("pol_con_idx").on(t.contratanteId), index("pol_num_idx").on(t.numero)],
);
export type Poliza = typeof polizas.$inferSelect;

// ---------------------------------------------------------------------------
// Siniestros
// ---------------------------------------------------------------------------
export const siniestros = mysqlTable(
  "siniestros",
  {
    id: id(),
    /** Folio interno THP, p. ej. THP-S-26-0001. */
    folio: varchar("folio", { length: 32 }).notNull().unique(),
    contratanteId: refReq("contratanteId"),
    polizaId: ref("polizaId"),
    /** Número de póliza cuando aún no está dada de alta en el catálogo. */
    polizaTexto: varchar("polizaTexto", { length: 64 }),
    aseguradoraId: refReq("aseguradoraId"),
    ramo: mysqlEnum("ramo", RAMOS).notNull(),
    tipo: varchar("tipo", { length: 64 }).notNull(),
    /** Asegurado o afectado: persona, unidad o bien. */
    afectado: varchar("afectado", { length: 255 }).notNull(),
    descripcion: text("descripcion"),
    numeroSiniestro: varchar("numeroSiniestro", { length: 64 }),
    fechaOcurrido: fecha("fechaOcurrido").notNull(),
    fechaReporte: fecha("fechaReporte").notNull(),
    fechaIngreso: fecha("fechaIngreso"),
    estado: mysqlEnum("estado", ESTADOS).default("reportado").notNull(),
    ejecutivoId: refReq("ejecutivoId"),
    proximaAccion: varchar("proximaAccion", { length: 500 }),
    fechaCompromiso: fecha("fechaCompromiso"),
    // Financiero. "autorizado" solo cambia con la autorización de la aseguradora; lo pagado sale de siniestro_pagos.
    gastado: dinero("gastado"),
    reclamado: dinero("reclamado"),
    noProcedente: dinero("noProcedente"),
    deducible: dinero("deducible"),
    coaseguro: dinero("coaseguro"),
    autorizado: dinero("autorizado"),
    // Autos
    numeroReporte: varchar("numeroReporte", { length: 64 }),
    ajustadorNombre: varchar("ajustadorNombre", { length: 128 }),
    ajustadorTelefono: varchar("ajustadorTelefono", { length: 32 }),
    tallerNombre: varchar("tallerNombre", { length: 128 }),
    lugar: varchar("lugar", { length: 255 }),
    conductorNombre: varchar("conductorNombre", { length: 128 }),
    responsabilidad: mysqlEnum("responsabilidad", RESPONSABILIDADES).default("por_definir").notNull(),
    ultimoMovimiento: timestamp("ultimoMovimiento").defaultNow().notNull(),
    creadoPorId: ref("creadoPorId"),
    createdAt: creado(),
    updatedAt: actualizado(),
  },
  (t) => [
    index("sin_con_idx").on(t.contratanteId),
    index("sin_pol_idx").on(t.polizaId),
    index("sin_estado_idx").on(t.estado),
    index("sin_ejec_idx").on(t.ejecutivoId),
  ],
);
export type Siniestro = typeof siniestros.$inferSelect;

export const documentos = mysqlTable(
  "siniestro_documentos",
  {
    id: id(),
    siniestroId: refReq("siniestroId"),
    nombre: varchar("nombre", { length: 255 }).notNull(),
    estado: mysqlEnum("estado", DOC_ESTADOS).default("pendiente").notNull(),
    orden: int("orden").default(0).notNull(),
    nota: varchar("nota", { length: 500 }),
    actualizadoPorId: ref("actualizadoPorId"),
    updatedAt: actualizado(),
  },
  (t) => [index("doc_sin_idx").on(t.siniestroId)],
);
export type Documento = typeof documentos.$inferSelect;

/**
 * Archivos del expediente (PDF, fotos, formatos). Se guardan en la base, en base64, para que
 * el respaldo de MySQL los incluya. Pueden ir ligados a un documento del checklist o sueltos.
 */
export const archivos = mysqlTable(
  "siniestro_archivos",
  {
    id: id(),
    siniestroId: refReq("siniestroId"),
    documentoId: ref("documentoId"),
    nombre: varchar("nombre", { length: 255 }).notNull(),
    tipo: varchar("tipo", { length: 128 }).notNull(),
    tamano: int("tamano").notNull(),
    contenido: longtext("contenido").notNull(),
    subidoPorId: refReq("subidoPorId"),
    createdAt: creado(),
  },
  (t) => [index("arch_sin_idx").on(t.siniestroId)],
);
export type Archivo = typeof archivos.$inferSelect;

/** Facturas y conceptos reclamados, con el dictamen de la aseguradora. */
export const conceptos = mysqlTable(
  "siniestro_conceptos",
  {
    id: id(),
    siniestroId: refReq("siniestroId"),
    concepto: varchar("concepto", { length: 255 }).notNull(),
    importe: dinero("importe").notNull(),
    noProcedente: dinero("noProcedente").default("0").notNull(),
    dictamen: mysqlEnum("dictamen", DICTAMENES).default("pendiente").notNull(),
    createdAt: creado(),
  },
  (t) => [index("con_sin_idx").on(t.siniestroId)],
);
export type Concepto = typeof conceptos.$inferSelect;

/** Pagos de la aseguradora. Cada uno exige la referencia (transferencia, cheque, etc.). */
export const pagos = mysqlTable(
  "siniestro_pagos",
  {
    id: id(),
    siniestroId: refReq("siniestroId"),
    concepto: varchar("concepto", { length: 255 }).notNull(),
    fecha: fecha("fecha").notNull(),
    monto: dinero("monto").notNull(),
    forma: mysqlEnum("forma", ["transferencia", "cheque", "pago_directo", "otro"]).default("transferencia").notNull(),
    referencia: varchar("referencia", { length: 128 }).notNull(),
    registradoPorId: ref("registradoPorId"),
    createdAt: creado(),
  },
  (t) => [index("pag_sin_idx").on(t.siniestroId)],
);
export type Pago = typeof pagos.$inferSelect;

/** Bitácora: cada alta, estatus, documento, pago, edición y nota. Nunca se edita ni se borra. */
export const eventos = mysqlTable(
  "siniestro_eventos",
  {
    id: id(),
    siniestroId: refReq("siniestroId"),
    tipo: mysqlEnum("tipo", ["alta", "estatus", "nota", "documento", "pago", "financiero", "edicion", "accion", "tercero"]).notNull(),
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
export type Evento = typeof eventos.$inferSelect;

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

// ---------------------------------------------------------------------------
// Configuración que edita el administrador
// ---------------------------------------------------------------------------
export const tiposSiniestro = mysqlTable(
  "tipos_siniestro",
  {
    id: id(),
    ramo: mysqlEnum("ramo", RAMOS).notNull(),
    nombre: varchar("nombre", { length: 64 }).notNull(),
    orden: int("orden").default(0).notNull(),
    activo: boolean("activo").default(true).notNull(),
  },
  (t) => [uniqueIndex("tipo_ramo_nombre").on(t.ramo, t.nombre)],
);
export type TipoSiniestro = typeof tiposSiniestro.$inferSelect;

/**
 * Documentos que se piden al abrir un expediente. Aplican a un ramo; opcionalmente
 * solo a un tipo (si hay alguno para el tipo, reemplazan a los generales) y,
 * opcionalmente, solo a una aseguradora (se suman a los demás).
 */
export const plantillasDocumento = mysqlTable(
  "plantillas_documento",
  {
    id: id(),
    ramo: mysqlEnum("ramo", RAMOS).notNull(),
    tipo: varchar("tipo", { length: 64 }),
    aseguradoraId: ref("aseguradoraId"),
    nombre: varchar("nombre", { length: 255 }).notNull(),
    orden: int("orden").default(0).notNull(),
    activo: boolean("activo").default(true).notNull(),
  },
  (t) => [index("pla_ramo_idx").on(t.ramo)],
);
export type PlantillaDocumento = typeof plantillasDocumento.$inferSelect;

/** Ajustes generales (clave/valor). */
export const ajustes = mysqlTable("ajustes", {
  clave: varchar("clave", { length: 64 }).primaryKey(),
  valor: varchar("valor", { length: 500 }).notNull(),
});

// ---------------------------------------------------------------------------
// Seguimiento (1C)
// ---------------------------------------------------------------------------
/** Mensajes propuestos por el sistema. Un administrador los aprueba; se envían fuera del sistema. */
export const borradores = mysqlTable(
  "borradores",
  {
    id: id(),
    siniestroId: refReq("siniestroId"),
    motivo: mysqlEnum("motivo", MOTIVOS).notNull(),
    para: mysqlEnum("para", DESTINOS).notNull(),
    texto: text("texto").notNull(),
    estado: mysqlEnum("estado", BORRADOR_ESTADOS).default("pendiente").notNull(),
    revisadoPorId: ref("revisadoPorId"),
    revisadoAt: timestamp("revisadoAt"),
    enviadoPorId: ref("enviadoPorId"),
    enviadoAt: timestamp("enviadoAt"),
    createdAt: creado(),
  },
  (t) => [index("bor_sin_idx").on(t.siniestroId), index("bor_estado_idx").on(t.estado)],
);
export type Borrador = typeof borradores.$inferSelect;
