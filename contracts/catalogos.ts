/** Ramos, tipos de siniestro y documentación que se pide en cada caso. */

export const RAMOS = ["autos", "flot", "gmmi", "gmmc", "ap", "vida", "danos", "casa", "rc", "trans"] as const;
export type Ramo = (typeof RAMOS)[number];

export const RAMO_LABEL: Record<Ramo, string> = {
  autos: "Autos individual",
  flot: "Flotilla autos",
  gmmi: "GMM individual",
  gmmc: "GMM colectivo",
  ap: "Accidentes personales",
  vida: "Vida",
  danos: "Daños empresariales",
  casa: "Casa habitación",
  rc: "Responsabilidad civil",
  trans: "Transportes y mercancías",
};

export const GRUPOS = ["autos", "gmm", "danos", "vida", "trans"] as const;
export type Grupo = (typeof GRUPOS)[number];
export const GRUPO_LABEL: Record<Grupo, string> = {
  autos: "Autos",
  gmm: "Gastos médicos",
  danos: "Daños, casa y RC",
  vida: "Vida y AP",
  trans: "Transportes",
};
export const GRUPO_DE: Record<Ramo, Grupo> = {
  autos: "autos", flot: "autos", gmmi: "gmm", gmmc: "gmm", ap: "vida", vida: "vida", danos: "danos", casa: "danos", rc: "danos", trans: "trans",
};
export const ramosDeGrupo = (g: Grupo) => RAMOS.filter((r) => GRUPO_DE[r] === g);
export const esAutos = (r: Ramo) => GRUPO_DE[r] === "autos";

const TIPOS_AUTOS = ["Colisión", "Robo total", "Robo parcial", "Rotura de cristales", "Responsabilidad civil", "Fenómenos naturales"];
const TIPOS_GMM = ["Reembolso", "Programación de cirugía", "Pago directo"];
export const TIPOS: Record<Ramo, string[]> = {
  autos: TIPOS_AUTOS,
  flot: TIPOS_AUTOS,
  gmmi: TIPOS_GMM,
  gmmc: TIPOS_GMM,
  ap: ["Reembolso por accidente", "Pérdida orgánica"],
  vida: ["Fallecimiento", "Invalidez total y permanente"],
  danos: ["Incendio", "Daño por agua", "Robo con violencia", "Fenómenos hidrometeorológicos", "Rotura de maquinaria"],
  casa: ["Daño por agua", "Robo", "Incendio"],
  rc: ["Daños a terceros", "Lesiones a terceros"],
  trans: ["Mercancía dañada", "Robo de mercancía", "Pérdida total del embarque"],
};

/** Documentación que se pide al abrir el expediente, según ramo y tipo. */
export function documentosPara(ramo: Ramo, tipo: string): string[] {
  if (esAutos(ramo)) {
    if (tipo === "Robo total") {
      return ["Denuncia ante el Ministerio Público", "Factura original del vehículo", "Baja de placas", "Duplicado de llaves", "Identificación del asegurado", "Estado de cuenta bancario", "Comprobante de domicilio"];
    }
    return ["Declaración del conductor", "Licencia de conducir", "Tarjeta de circulación", "Identificación del asegurado", "Fotografías del siniestro", "Valuación del taller", "Factura de grúa"];
  }
  if (ramo === "gmmi" || ramo === "gmmc" || ramo === "ap") {
    return ["Informe médico", "Aviso de accidente o enfermedad", "Estudios de laboratorio y gabinete", "Recetas médicas", "Facturas y archivos XML", "Comprobantes de pago", "Identificación del asegurado", "Estado de cuenta bancario", "Carta de autorización", "Dictamen de la aseguradora", "Documentación adicional"];
  }
  if (ramo === "vida") {
    return ["Acta de defunción", "Certificado médico de defunción", "Identificación de beneficiarios", "Actas de nacimiento de beneficiarios", "Designación de beneficiarios", "Estado de cuenta de beneficiarios", "Constancia laboral (colectivo)"];
  }
  if (ramo === "rc") {
    return ["Carta reclamación del tercero", "Informe del ajustador", "Fotografías", "Presupuestos o facturas del daño", "Identificación del tercero", "Convenio o finiquito"];
  }
  if (ramo === "trans") {
    return ["Carta porte / CFDI con complemento", "Factura de la mercancía", "Reporte de daños con fotografías", "Carta reclamación al transportista", "Certificado de seguro del embarque", "Inventario de pérdida"];
  }
  return ["Carta reclamación", "Informe del ajustador", "Fotografías", "Presupuestos de reparación", "Facturas de bienes dañados", "Inventario de pérdidas", "Dictamen de Protección Civil o bomberos", "Estado de cuenta bancario"];
}

export const DOC_ESTADOS = ["pendiente", "recibido", "en_revision", "validado", "correccion"] as const;
export type DocEstado = (typeof DOC_ESTADOS)[number];
export const DOC_LABEL: Record<DocEstado, string> = {
  pendiente: "Pendiente",
  recibido: "Recibido",
  en_revision: "En revisión",
  validado: "Validado",
  correccion: "Requiere corrección",
};
/** Documentos que impiden marcar la documentación como completa. */
export const DOC_FALTANTE: DocEstado[] = ["pendiente", "correccion"];

export const DICTAMENES = ["pendiente", "procedente", "parcial", "no_procedente", "por_corregir"] as const;
export type Dictamen = (typeof DICTAMENES)[number];
export const DICTAMEN_LABEL: Record<Dictamen, string> = {
  pendiente: "Pendiente",
  procedente: "Procedente",
  parcial: "Parcial",
  no_procedente: "No procedente",
  por_corregir: "Por corregir",
};

export const RESPONSABILIDADES = ["por_definir", "asegurado", "tercero", "compartida"] as const;
export type Responsabilidad = (typeof RESPONSABILIDADES)[number];
export const RESPONSABILIDAD_LABEL: Record<Responsabilidad, string> = {
  por_definir: "Por definir",
  asegurado: "Del asegurado",
  tercero: "Del tercero",
  compartida: "Compartida",
};
