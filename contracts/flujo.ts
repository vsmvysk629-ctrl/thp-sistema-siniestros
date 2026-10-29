/**
 * Avance del trámite de un siniestro ante la aseguradora. Lo usan la API (para validar)
 * y las pantallas (para mostrar). Sin dependencias: se prueba en tests/flujo.test.ts.
 */

export const ESTADOS = [
  "reportado",
  "recopilacion",
  "documentacion_completa",
  "ingresado",
  "en_revision",
  "info_adicional",
  "autorizado",
  "pago_parcial",
  "pagado",
  "rechazado",
  "cerrado",
] as const;
export type Estado = (typeof ESTADOS)[number];

export const ESTADO_LABEL: Record<Estado, string> = {
  reportado: "Reportado",
  recopilacion: "Recopilación de documentos",
  documentacion_completa: "Documentación completa",
  ingresado: "Ingresado a aseguradora",
  en_revision: "En revisión aseguradora",
  info_adicional: "Info. adicional solicitada",
  autorizado: "Autorizado",
  pago_parcial: "Pago parcial",
  pagado: "Pagado",
  rechazado: "Rechazado",
  cerrado: "Cerrado",
};

export type Tono = "gray" | "orange" | "green" | "blue" | "red";
export const ESTADO_TONO: Record<Estado, Tono> = {
  reportado: "gray",
  recopilacion: "orange",
  documentacion_completa: "green",
  ingresado: "blue",
  en_revision: "blue",
  info_adicional: "orange",
  autorizado: "green",
  pago_parcial: "blue",
  pagado: "green",
  rechazado: "red",
  cerrado: "gray",
};

/**
 * Cambios de estatus que se hacen a mano. "Pago parcial" y "Pagado" no están aquí:
 * solo se alcanzan registrando pagos con su referencia (ver registrarPago).
 */
export const TRANSICIONES: Record<Estado, Estado[]> = {
  reportado: ["recopilacion", "cerrado"],
  recopilacion: ["documentacion_completa", "cerrado"],
  documentacion_completa: ["ingresado", "recopilacion", "cerrado"],
  ingresado: ["en_revision", "info_adicional", "autorizado", "rechazado"],
  en_revision: ["info_adicional", "autorizado", "rechazado"],
  info_adicional: ["en_revision", "autorizado", "rechazado"],
  autorizado: ["cerrado"],
  // Si la aseguradora ya no pagará el resto, se cierra con el motivo.
  pago_parcial: ["cerrado"],
  pagado: ["cerrado"],
  // Apelación: vuelve a revisión.
  rechazado: ["en_revision", "cerrado"],
  cerrado: [],
};

export const ESTADOS_PAGO: Estado[] = ["autorizado", "pago_parcial"];
export const esAbierto = (e: Estado) => e !== "cerrado";

/** Agrupaciones del filtro de estatus y de los indicadores del tablero. */
export const GRUPOS_ESTADO = {
  abiertos: { label: "Abiertos", estados: ESTADOS.filter((e) => e !== "cerrado") },
  todos: { label: "Todos", estados: [...ESTADOS] },
  cerrados: { label: "Cerrados", estados: ["cerrado"] },
  doc: { label: "Pendientes de documentación", estados: ["recopilacion", "info_adicional"] },
  ingresados: { label: "Ingresados / en revisión", estados: ["ingresado", "en_revision"] },
  pago: { label: "Pendientes de pago", estados: ["autorizado", "pago_parcial"] },
  rechazados: { label: "Rechazados", estados: ["rechazado"] },
} satisfies Record<string, { label: string; estados: Estado[] }>;
export type GrupoEstado = keyof typeof GRUPOS_ESTADO;

export type DatosParaTransicion = {
  estado: Estado;
  numeroSiniestro: string | null;
  /** Documentos pendientes o que requieren corrección. */
  documentosFaltantes: number;
};

export type ExtraTransicion = { folio?: string | null; nota?: string | null; montoAutorizado?: string | null };

/** Devuelve el motivo por el que no se puede cambiar el estatus, o null si se puede. */
export function validarTransicion(s: DatosParaTransicion, destino: Estado, extra: ExtraTransicion): string | null {
  if (!TRANSICIONES[s.estado].includes(destino)) {
    if (destino === "pago_parcial" || destino === "pagado") {
      return "Los pagos se registran en la pestaña Financiero, con la referencia de la aseguradora.";
    }
    return `No se puede pasar de "${ESTADO_LABEL[s.estado]}" a "${ESTADO_LABEL[destino]}".`;
  }
  const nota = extra.nota?.trim();
  const folio = extra.folio?.trim();
  if (destino === "documentacion_completa" && s.documentosFaltantes > 0) {
    return `Faltan ${s.documentosFaltantes} documento(s) por recibir o corregir.`;
  }
  if (destino === "ingresado" && !s.numeroSiniestro?.trim() && !folio) {
    return "Captura el número de siniestro o folio que dio la aseguradora al ingresar el trámite.";
  }
  if (destino === "autorizado") {
    if (!folio) return "Captura el folio del dictamen o la referencia de la autorización de la aseguradora.";
    if (!extra.montoAutorizado || !(Number(extra.montoAutorizado) > 0)) return "Captura el monto autorizado por la aseguradora.";
  }
  if (destino === "info_adicional" && !nota) return "Escribe qué información pide la aseguradora.";
  if (destino === "rechazado" && !nota) return "Escribe el motivo del rechazo.";
  if (destino === "cerrado" && s.estado !== "pagado" && !nota) return "Escribe el motivo del cierre.";
  return null;
}

/** Estatus después de registrar pagos: completo si ya se cubrió lo autorizado. */
export function estadoTrasPago(autorizado: number, pagado: number): Estado {
  return pagado + 0.005 >= autorizado ? "pagado" : "pago_parcial";
}
