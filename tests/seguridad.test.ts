import { describe, expect, it } from "vitest";
import { celdaCSV } from "../contracts/csv";
import { MAX_FALLOS_IP, ipBloqueada, ipDe, limpiarFallos, registrarFallo } from "../api/auth/limite";

describe("seguridad", () => {
  it("el CSV no deja pasar fórmulas de Excel", () => {
    expect(celdaCSV("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(celdaCSV("+52 33")).toBe("'+52 33");
    expect(celdaCSV("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(celdaCSV(-1500)).toBe("-1500");
    expect(celdaCSV("Ana Prueba")).toBe("Ana Prueba");
  });

  it("frena una IP después de muchos intentos fallidos y la libera al pasar la ventana", () => {
    const ip = "203.0.113.9";
    const t = 1_000_000;
    for (let i = 0; i < MAX_FALLOS_IP - 1; i++) registrarFallo(ip, t);
    expect(ipBloqueada(ip, t)).toBe(false);
    registrarFallo(ip, t);
    expect(ipBloqueada(ip, t)).toBe(true);
    expect(ipBloqueada(ip, t + 16 * 60_000)).toBe(false);
    limpiarFallos(ip);
  });

  it("toma la IP del proxy", () => {
    expect(ipDe(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("198.51.100.1");
    expect(ipDe(new Headers())).toBe("local");
  });
});
