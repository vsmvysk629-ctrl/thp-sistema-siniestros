import { describe, expect, it } from "vitest";
import {
  ESTADOS,
  ESTADOS_FINALES,
  RUTA_PAGO_DANOS,
  RUTA_PERDIDA_TOTAL,
  RUTA_REPARACION,
  TRANSICIONES,
  rutaDe,
  validarTransicion,
  type DatosParaTransicion,
} from "@contracts/flujo";

const base: DatosParaTransicion = {
  estado: "reportado",
  numeroReporte: "R-1",
  ajustadorNombre: "Ajustador Ficticio",
  tallerNombre: "Taller Ficticio",
};

describe("flujo de autos", () => {
  it("cada ruta se puede recorrer completa con folio cuando se pide", () => {
    for (const ruta of [RUTA_REPARACION, RUTA_PAGO_DANOS, RUTA_PERDIDA_TOTAL]) {
      for (let i = 0; i < ruta.length - 1; i++) {
        const err = validarTransicion({ ...base, estado: ruta[i] }, ruta[i + 1], { folio: "F-1" });
        expect(err, `${ruta[i]} → ${ruta[i + 1]}`).toBeNull();
      }
    }
  });

  it("los estados finales no avanzan", () => {
    for (const e of ESTADOS_FINALES) expect(TRANSICIONES[e]).toEqual([]);
  });

  it("todo estado no final puede llegar a un estado final", () => {
    for (const inicio of ESTADOS) {
      const visto = new Set([inicio]);
      const cola = [inicio];
      while (cola.length) for (const d of TRANSICIONES[cola.shift()!]) if (!visto.has(d)) (visto.add(d), cola.push(d));
      expect(ESTADOS_FINALES.some((f) => visto.has(f)), inicio).toBe(true);
    }
  });

  it("rechaza saltos que no existen", () => {
    expect(validarTransicion(base, "entregado", {})).toMatch(/No se puede pasar/);
    expect(validarTransicion({ ...base, estado: "cerrado" }, "reportado", {})).toMatch(/No se puede pasar/);
  });

  it("exige folio de la aseguradora para autorizaciones y pagos", () => {
    for (const [desde, hacia] of [
      ["valuacion", "orden_admision"],
      ["valuacion", "pago_danos"],
      ["valuacion", "perdida_total"],
      ["documentos_indemnizacion", "finiquito"],
      ["finiquito", "pago_confirmado"],
      ["pago_danos", "pago_confirmado"],
    ] as const) {
      expect(validarTransicion({ ...base, estado: desde }, hacia, {}), hacia).toMatch(/folio/);
      expect(validarTransicion({ ...base, estado: desde }, hacia, { folio: "  " }), hacia).toMatch(/folio/);
    }
  });

  it("exige motivo para rechazar o cancelar", () => {
    expect(validarTransicion(base, "rechazado", {})).toMatch(/motivo/);
    expect(validarTransicion(base, "cancelado", { nota: "El cliente desistió" })).toBeNull();
  });

  it("exige datos mínimos antes de avanzar", () => {
    expect(validarTransicion({ ...base, numeroReporte: null }, "ajustador_asignado", {})).toMatch(/reporte/);
    expect(validarTransicion({ ...base, ajustadorNombre: "" }, "ajustador_asignado", {})).toMatch(/ajustador/);
    expect(validarTransicion({ ...base, estado: "valuacion", tallerNombre: null }, "orden_admision", { folio: "F" })).toMatch(/taller/);
    // Cancelar sin número de reporte sí se permite
    expect(validarTransicion({ ...base, numeroReporte: null }, "cancelado", { nota: "Duplicado" })).toBeNull();
  });

  it("dibuja la ruta según el historial", () => {
    expect(rutaDe("valuacion")).toBe(RUTA_REPARACION);
    expect(rutaDe("pago_confirmado", ["pago_danos"])).toBe(RUTA_PAGO_DANOS);
    expect(rutaDe("pago_confirmado", ["perdida_total"])).toBe(RUTA_PERDIDA_TOTAL);
  });
});
