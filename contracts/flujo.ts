/**
 * Flujo de un siniestro de autos. Lo usan la API (para validar) y las pantallas (para mostrar).
 * Sin dependencias: se prueba solo en tests/flujo.test.ts.
 */

export const ESTADOS = [
  "reportado",
  "ajustador_asignado",
  "valuacion",
  "orden_admision",
  "en_reparacion",
  "listo_entrega",
  "entregado",
  "pago_danos",
  "perdida_total",
  "documentos_indemnizacion",
  "finiquito",
  "pago_confirmado",
  "cerrado",
  "rechazado",
  "cancelado",
] as const;
export type Estado = (typeof ESTADOS)[number];

export const ESTADO_LABEL: Record<Estado, string> = {
  reportado: "Reportado a cabina",
  ajustador_asignado: "Ajustador asignado",
  valuacion: "En valuación",
  orden_admision: "Orden de admisión",
  en_reparacion: "En reparación",
  listo_entrega: "Listo para entrega",
  entregado: "Entregado",
  pago_danos: "Pago de daños autorizado",
  perdida_total: "Pérdida total dictaminada",
  documentos_indemnizacion: "Documentos para indemnización",
  finiquito: "Finiquito firmado",
  pago_confirmado: "Pago confirmado",
  cerrado: "Cerrado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
};

/** Rutas del flujo, para dibujar el avance según el camino que tomó el siniestro. */
export const RUTA_REPARACION: Estado[] = [
  "reportado", "ajustador_asignado", "valuacion", "orden_admision", "en_reparacion", "listo_entrega", "entregado", "cerrado",
];
export const RUTA_PAGO_DANOS: Estado[] = [
  "reportado", "ajustador_asignado", "valuacion", "pago_danos", "pago_confirmado", "cerrado",
];
export const RUTA_PERDIDA_TOTAL: Estado[] = [
  "reportado", "ajustador_asignado", "valuacion", "perdida_total", "documentos_indemnizacion", "finiquito", "pago_confirmado", "cerrado",
];

export function rutaDe(estado: Estado, historial: Estado[] = []): Estado[] {
  const visto = new Set([estado, ...historial]);
  if (["perdida_total", "documentos_indemnizacion", "finiquito"].some((e) => visto.has(e as Estado))) return RUTA_PERDIDA_TOTAL;
  if (visto.has("pago_danos")) return RUTA_PAGO_DANOS;
  return RUTA_REPARACION;
}

export const TRANSICIONES: Record<Estado, Estado[]> = {
  reportado: ["ajustador_asignado", "rechazado", "cancelado"],
  // Robo total no localizado: del ajustador se puede ir directo a pérdida total.
  ajustador_asignado: ["valuacion", "perdida_total", "rechazado", "cancelado"],
  valuacion: ["orden_admision", "pago_danos", "perdida_total", "rechazado", "cancelado"],
  orden_admision: ["en_reparacion", "perdida_total", "cancelado"],
  en_reparacion: ["listo_entrega", "perdida_total"],
  listo_entrega: ["entregado"],
  entregado: ["cerrado"],
  pago_danos: ["pago_confirmado"],
  perdida_total: ["documentos_indemnizacion", "rechazado"],
  documentos_indemnizacion: ["finiquito"],
  finiquito: ["pago_confirmado"],
  pago_confirmado: ["cerrado"],
  cerrado: [],
  rechazado: [],
  cancelado: [],
};

/**
 * Estados que afirman algo que solo la aseguradora puede confirmar (autorización o pago).
 * Para entrar a ellos se exige el folio o la referencia que dio la aseguradora.
 */
export const REQUIERE_FOLIO: Estado[] = ["orden_admision", "pago_danos", "perdida_total", "finiquito", "pago_confirmado"];

/** Estados que exigen explicar el motivo en la nota. */
export const REQUIERE_NOTA: Estado[] = ["rechazado", "cancelado"];

export const ESTADOS_FINALES: Estado[] = ["cerrado", "rechazado", "cancelado"];

export const esAbierto = (e: Estado) => !ESTADOS_FINALES.includes(e);

export type DatosParaTransicion = {
  estado: Estado;
  numeroReporte: string | null;
  ajustadorNombre: string | null;
  tallerNombre: string | null;
};

/** Devuelve el motivo por el que no se puede avanzar, o null si se puede. */
export function validarTransicion(
  s: DatosParaTransicion,
  destino: Estado,
  extra: { folio?: string | null; nota?: string | null },
): string | null {
  if (!TRANSICIONES[s.estado].includes(destino)) {
    return `No se puede pasar de "${ESTADO_LABEL[s.estado]}" a "${ESTADO_LABEL[destino]}".`;
  }
  if (REQUIERE_FOLIO.includes(destino) && !extra.folio?.trim()) {
    return `Para marcar "${ESTADO_LABEL[destino]}" captura el folio o referencia que dio la aseguradora.`;
  }
  if (REQUIERE_NOTA.includes(destino) && !extra.nota?.trim()) {
    return `Para marcar "${ESTADO_LABEL[destino]}" escribe el motivo en la nota.`;
  }
  const cancelando = destino === "cancelado" || destino === "rechazado";
  if (!cancelando && s.estado === "reportado" && !s.numeroReporte?.trim()) {
    return "Captura primero el número de reporte de cabina.";
  }
  if (destino === "ajustador_asignado" && !s.ajustadorNombre?.trim()) {
    return "Captura primero el nombre del ajustador.";
  }
  if (destino === "orden_admision" && !s.tallerNombre?.trim()) {
    return "Captura primero el taller o agencia donde se repara.";
  }
  return null;
}

export const TIPOS = ["colision", "robo_total", "robo_parcial", "cristales", "rc_terceros", "otro"] as const;
export type TipoSiniestro = (typeof TIPOS)[number];
export const TIPO_LABEL: Record<TipoSiniestro, string> = {
  colision: "Colisión",
  robo_total: "Robo total",
  robo_parcial: "Robo parcial",
  cristales: "Cristales",
  rc_terceros: "RC a terceros",
  otro: "Otro",
};

export const RESPONSABILIDADES = ["por_definir", "asegurado", "tercero", "compartida"] as const;
export type Responsabilidad = (typeof RESPONSABILIDADES)[number];
export const RESPONSABILIDAD_LABEL: Record<Responsabilidad, string> = {
  por_definir: "Por definir",
  asegurado: "Del asegurado",
  tercero: "Del tercero",
  compartida: "Compartida",
};
