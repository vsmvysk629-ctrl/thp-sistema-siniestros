/**
 * Borradores de seguimiento (etapa 1C). El sistema los propone; un administrador los aprueba
 * y la persona los envía por su cuenta. El sistema nunca envía nada al cliente ni a la aseguradora.
 * Sin dependencias: se prueba en tests/borradores.test.ts.
 */

export const MOTIVOS = ["documentos", "info_adicional", "sin_respuesta", "pago"] as const;
export type Motivo = (typeof MOTIVOS)[number];
export const MOTIVO_LABEL: Record<Motivo, string> = {
  documentos: "Documentos pendientes",
  info_adicional: "Información que pide la aseguradora",
  sin_respuesta: "Aseguradora sin respuesta",
  pago: "Pago pendiente",
};

export const DESTINOS = ["cliente", "aseguradora"] as const;
export type Destino = (typeof DESTINOS)[number];
export const DESTINO_DE: Record<Motivo, Destino> = {
  documentos: "cliente",
  info_adicional: "cliente",
  sin_respuesta: "aseguradora",
  pago: "aseguradora",
};

export const BORRADOR_ESTADOS = ["pendiente", "aprobado", "enviado", "descartado"] as const;
export type BorradorEstado = (typeof BORRADOR_ESTADOS)[number];

/** Días que se espera antes de volver a proponer un mensaje por el mismo motivo. */
export const DIAS_ENTRE_BORRADORES = 3;

export type DatosBorrador = {
  folio: string;
  afectado: string;
  contacto: string | null;
  contratante: string;
  aseguradora: string;
  numeroSiniestro: string | null;
  ejecutivo: string | null;
  faltantes: string[];
  proximaAccion: string | null;
  diasSinRespuesta: number;
  saldo: number | null;
};

const pesos = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Texto propuesto para cada motivo. Solo usa lo que está capturado en el sistema: no afirma
 * autorizaciones ni pagos que la aseguradora no haya confirmado.
 */
export function textoBorrador(m: Motivo, d: DatosBorrador): string {
  const firma = `Saludos,\n${d.ejecutivo ?? "Equipo de siniestros"}\nTHP Seguros`;
  const ref = d.numeroSiniestro ? `siniestro ${d.numeroSiniestro}` : `nuestro folio ${d.folio}`;
  // Solo el nombre de pila; siglas como "RH" no se usan para saludar.
  const nombre = d.contacto?.trim().split(/\s+/).find((w) => /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(w));
  const hola = `Hola${nombre ? ` ${nombre}` : ""}`;
  switch (m) {
    case "documentos":
      return `${hola}, le escribimos de THP Seguros por el siniestro ${d.folio} (${d.afectado}).\n\nPara poder avanzar con la aseguradora nos faltan estos documentos:\n${d.faltantes.map((f) => `• ${f}`).join("\n")}\n\n¿Nos los puede enviar por este medio? Con gusto le ayudamos si tiene dudas.\n\n${firma}`;
    case "info_adicional":
      return `${hola}, le escribimos de THP Seguros por el siniestro ${d.folio} (${d.afectado}).\n\n${d.aseguradora} nos pide información adicional para continuar${d.proximaAccion ? `: ${d.proximaAccion}` : "."}\n\n¿Nos ayuda a reunirla? Así evitamos que el trámite se detenga.\n\n${firma}`;
    case "sin_respuesta":
      return `Buen día. Les escribimos de THP Seguros para solicitar el estatus del ${ref} (${d.afectado}, asegurado ${d.contratante}).\n\nLlevamos ${d.diasSinRespuesta} días sin novedad. ¿Nos pueden indicar en qué etapa se encuentra y si hace falta algo de nuestra parte?\n\n${firma}`;
    case "pago":
      return `Buen día. Les escribimos de THP Seguros por el ${ref} (${d.afectado}, asegurado ${d.contratante}).\n\nSegún lo autorizado por ustedes, queda un saldo de ${pesos(d.saldo ?? 0)} por pagar. ¿Nos pueden confirmar la fecha programada de pago?\n\n${firma}`;
  }
}

/** Liga para abrir WhatsApp con el texto listo; la persona revisa y envía desde su teléfono. */
export function ligaWhatsApp(telefono: string, texto: string) {
  const digitos = telefono.replace(/\D/g, "");
  const numero = digitos.length === 10 ? `52${digitos}` : digitos;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
