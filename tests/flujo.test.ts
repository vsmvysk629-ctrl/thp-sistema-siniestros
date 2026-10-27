import { describe, expect, it } from "vitest";
import { ESTADOS, TRANSICIONES, estadoTrasPago, validarTransicion, type DatosParaTransicion } from "@contracts/flujo";
import { RAMOS, TIPOS, documentosPara } from "@contracts/catalogos";

const base: DatosParaTransicion = { estado: "reportado", numeroSiniestro: null, documentosFaltantes: 0 };

describe("flujo del trámite", () => {
  it("la ruta normal se recorre hasta pagado y cerrado", () => {
    const ruta = ["reportado", "recopilacion", "documentacion_completa", "ingresado", "en_revision", "autorizado"] as const;
    for (let i = 0; i < ruta.length - 1; i++) {
      const err = validarTransicion({ ...base, estado: ruta[i], numeroSiniestro: "SIN-1" }, ruta[i + 1], { folio: "F-1", montoAutorizado: "1000" });
      expect(err, `${ruta[i]} → ${ruta[i + 1]}`).toBeNull();
    }
    expect(validarTransicion({ ...base, estado: "pagado" }, "cerrado", {})).toBeNull();
  });

  it("pago parcial y pagado no se marcan a mano", () => {
    for (const e of ESTADOS) {
      expect(TRANSICIONES[e]).not.toContain("pago_parcial");
      expect(TRANSICIONES[e]).not.toContain("pagado");
    }
    expect(validarTransicion({ ...base, estado: "autorizado" }, "pagado", {})).toMatch(/Financiero/);
  });

  it("cerrado es final y todo estado puede llegar a cerrado", () => {
    expect(TRANSICIONES.cerrado).toEqual([]);
    const siguientes = (e: (typeof ESTADOS)[number]) => [...TRANSICIONES[e], ...(e === "autorizado" || e === "pago_parcial" ? (["pago_parcial", "pagado"] as const) : [])];
    for (const inicio of ESTADOS) {
      const visto = new Set([inicio]);
      const cola = [inicio];
      while (cola.length) for (const d of siguientes(cola.shift()!)) if (!visto.has(d)) (visto.add(d), cola.push(d));
      expect(visto.has("cerrado"), inicio).toBe(true);
    }
  });

  it("no se marca documentación completa con documentos faltantes", () => {
    expect(validarTransicion({ ...base, estado: "recopilacion", documentosFaltantes: 2 }, "documentacion_completa", {})).toMatch(/Faltan 2/);
  });

  it("ingresar exige el número o folio de la aseguradora", () => {
    const s = { ...base, estado: "documentacion_completa" as const };
    expect(validarTransicion(s, "ingresado", {})).toMatch(/número de siniestro/);
    expect(validarTransicion(s, "ingresado", { folio: "GM-1" })).toBeNull();
    expect(validarTransicion({ ...s, numeroSiniestro: "GM-1" }, "ingresado", {})).toBeNull();
  });

  it("autorizar exige folio del dictamen y monto", () => {
    const s = { ...base, estado: "en_revision" as const };
    expect(validarTransicion(s, "autorizado", { montoAutorizado: "100" })).toMatch(/folio/);
    expect(validarTransicion(s, "autorizado", { folio: "DIC-1" })).toMatch(/monto/);
    expect(validarTransicion(s, "autorizado", { folio: "DIC-1", montoAutorizado: "0" })).toMatch(/monto/);
  });

  it("pide motivo al rechazar, pedir información o cerrar antes de tiempo", () => {
    expect(validarTransicion({ ...base, estado: "en_revision" }, "rechazado", {})).toMatch(/motivo/);
    expect(validarTransicion({ ...base, estado: "en_revision" }, "info_adicional", {})).toMatch(/información/);
    expect(validarTransicion(base, "cerrado", {})).toMatch(/motivo/);
    expect(validarTransicion(base, "cerrado", { nota: "El cliente desistió" })).toBeNull();
  });

  it("el estatus tras un pago depende del saldo", () => {
    expect(estadoTrasPago(1000, 400)).toBe("pago_parcial");
    expect(estadoTrasPago(1000, 1000)).toBe("pagado");
  });

  it("cada ramo y tipo tiene documentación", () => {
    for (const r of RAMOS) for (const t of TIPOS[r]) expect(documentosPara(r, t).length, `${r} ${t}`).toBeGreaterThan(3);
    expect(documentosPara("autos", "Robo total")).toContain("Baja de placas");
  });
});
