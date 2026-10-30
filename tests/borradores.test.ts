import { describe, expect, it } from "vitest";
import { ligaWhatsApp, textoBorrador, type DatosBorrador } from "@contracts/borradores";

// Datos ficticios.
const d: DatosBorrador = {
  folio: "THP-S-26-0001",
  afectado: "Auto ficticio",
  contacto: "Ana Prueba",
  contratante: "Transportes Ficticios SA",
  aseguradora: "Quálitas",
  numeroSiniestro: null,
  ejecutivo: "Laura Demo",
  faltantes: ["Licencia de conducir", "Tarjeta de circulación"],
  proximaAccion: null,
  diasSinRespuesta: 9,
  saldo: 6000,
};

describe("textos de seguimiento", () => {
  it("documentos: saluda al contacto y lista lo que falta", () => {
    const t = textoBorrador("documentos", d);
    expect(t).toMatch(/^Hola Ana,/);
    expect(t).toContain("• Licencia de conducir\n• Tarjeta de circulación");
    expect(t).toContain("Laura Demo\nTHP Seguros");
  });
  it("no saluda con siglas", () => {
    expect(textoBorrador("documentos", { ...d, contacto: "RH Mariana López" })).toMatch(/^Hola Mariana,/);
    expect(textoBorrador("documentos", { ...d, contacto: "RH" })).toMatch(/^Hola,/);
  });
  it("aseguradora: usa el número de siniestro si existe y si no el folio", () => {
    expect(textoBorrador("sin_respuesta", d)).toContain("nuestro folio THP-S-26-0001");
    expect(textoBorrador("sin_respuesta", { ...d, numeroSiniestro: "QUA-1" })).toContain("siniestro QUA-1");
    expect(textoBorrador("pago", d)).toContain("$6,000.00");
  });
  it("no afirma pagos ni autorizaciones por su cuenta", () => {
    for (const m of ["documentos", "info_adicional", "sin_respuesta"] as const) expect(textoBorrador(m, d)).not.toMatch(/pagad|autorizad/i);
  });
  it("liga de WhatsApp con lada de México", () => {
    expect(ligaWhatsApp("(55) 1234-5678", "hola")).toBe("https://wa.me/525512345678?text=hola");
  });
});
