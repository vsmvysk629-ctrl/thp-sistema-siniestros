import { beforeAll, describe, expect, it } from "vitest";
import * as s from "@db/schema";
import { getDb } from "../api/queries/connection";
import { baseLimpia, callerDe, crearUsuario } from "./helpers";
import app from "../api/boot";
import { asegurarAseguradoras } from "../api/auth-router";

// Datos ficticios: ningún nombre, póliza ni placa es real.
let admin: s.User, oficina: s.User, vend1: s.User, vend2: s.User;
let polizaV1: number, polizaV2: number;

beforeAll(async () => {
  await baseLimpia();
  admin = await crearUsuario("admin", "admin");
  oficina = await crearUsuario("oficina", "siniestros");
  vend1 = await crearUsuario("vend1", "vendedor");
  vend2 = await crearUsuario("vend2", "vendedor");
  const db = getDb();
  await asegurarAseguradoras();
  const ofi = callerDe(oficina);
  const c1 = await ofi.catalogos.crearCliente({ nombre: "Cliente Ficticio Uno", vendedorId: vend1.id });
  const c2 = await ofi.catalogos.crearCliente({ nombre: "Cliente Ficticio Dos", vendedorId: vend2.id });
  polizaV1 = (await ofi.catalogos.crearPoliza({ numero: "PRB-0001", aseguradoraId: 1, clienteId: c1.id, cobertura: "amplia", vehiculoMarca: "Marca", vehiculoModelo: "Modelo", vehiculoAnio: 2022, vehiculoPlacas: "AAA000A" })).id;
  polizaV2 = (await ofi.catalogos.crearPoliza({ numero: "PRB-0002", aseguradoraId: 2, clienteId: c2.id, cobertura: "amplia" })).id;
});

const alta = (poliza: number, extra: Record<string, unknown> = {}) => ({
  polizaId: poliza,
  tipo: "colision" as const,
  fechaOcurrido: "2026-10-20 14:30",
  responsabilidad: "por_definir" as const,
  ...extra,
});

describe("siniestros", () => {
  it("da de alta con folio interno consecutivo y deja el alta en el historial", async () => {
    const a = await callerDe(oficina).siniestros.create(alta(polizaV1, { numeroReporte: "REP-1" }));
    const b = await callerDe(oficina).siniestros.create(alta(polizaV2));
    const anio = new Date().getFullYear();
    expect(a.folio).toBe(`SIN-${anio}-0001`);
    expect(b.folio).toBe(`SIN-${anio}-0002`);
    const det = await callerDe(oficina).siniestros.get({ id: a.id });
    expect(det.aseguradoraId).toBe(1);
    expect(det.estado).toBe("reportado");
    expect(det.responsableId).toBe(oficina.id);
    expect(det.eventos.map((e) => e.tipo)).toEqual(["alta"]);
  });

  it("recorre la ruta de pérdida total hasta cerrar, con folio y monto autorizado", async () => {
    const ofi = callerDe(oficina);
    const { id } = await ofi.siniestros.create(alta(polizaV1, { tipo: "robo_total", numeroReporte: "REP-RT" }));
    await expect(ofi.siniestros.cambiarEstado({ id, destino: "ajustador_asignado" })).rejects.toThrow(/ajustador/);
    await ofi.siniestros.actualizar({ id, datos: { ajustadorNombre: "Ajustador Ficticio", numeroSiniestro: "SIN-ASEG-1" } });
    await ofi.siniestros.cambiarEstado({ id, destino: "ajustador_asignado" });
    await expect(ofi.siniestros.cambiarEstado({ id, destino: "perdida_total" })).rejects.toThrow(/folio/);
    await ofi.siniestros.cambiarEstado({ id, destino: "perdida_total", folio: "DICT-1" });
    await ofi.siniestros.cambiarEstado({ id, destino: "documentos_indemnizacion" });
    await ofi.siniestros.cambiarEstado({ id, destino: "finiquito", folio: "FIN-1", montoAutorizado: "250000.00" });
    await ofi.siniestros.cambiarEstado({ id, destino: "pago_confirmado", folio: "TRANSF-1" });
    await ofi.siniestros.cambiarEstado({ id, destino: "cerrado" });
    await expect(ofi.siniestros.cambiarEstado({ id, destino: "reportado" })).rejects.toThrow(/No se puede pasar/);

    const det = await ofi.siniestros.get({ id });
    expect(det.estado).toBe("cerrado");
    expect(det.montoAutorizado).toBe("250000.00");
    const cambios = det.eventos.filter((e) => e.tipo === "cambio_estado").reverse();
    expect(cambios.map((e) => e.estadoNuevo)).toEqual([
      "ajustador_asignado", "perdida_total", "documentos_indemnizacion", "finiquito", "pago_confirmado", "cerrado",
    ]);
    expect(cambios.find((e) => e.estadoNuevo === "pago_confirmado")?.folio).toBe("TRANSF-1");
    expect(cambios.every((e) => e.autor?.nombre === "Usuario oficina")).toBe(true);
    expect(det.eventos.some((e) => e.tipo === "edicion" && /ajustador/.test(e.nota ?? ""))).toBe(true);
  });

  it("no acepta monto autorizado sin autorización de la aseguradora", async () => {
    const ofi = callerDe(oficina);
    const { id } = await ofi.siniestros.create(alta(polizaV1, { numeroReporte: "REP-M", ajustadorNombre: "Aj" }));
    await expect(
      ofi.siniestros.cambiarEstado({ id, destino: "ajustador_asignado", montoAutorizado: "1000" }),
    ).rejects.toThrow(/monto autorizado/);
    // Tampoco se cuela por la edición de datos
    await ofi.siniestros.actualizar({ id, datos: { montoAutorizado: "999" } as never });
    expect((await ofi.siniestros.get({ id })).montoAutorizado).toBeNull();
  });

  it("el vendedor solo ve y reporta siniestros de sus clientes, y no cambia estados", async () => {
    const v1 = callerDe(vend1);
    const propio = await v1.siniestros.create(alta(polizaV1));
    expect((await v1.siniestros.get({ id: propio.id })).responsableId).toBeNull();
    await expect(v1.siniestros.create(alta(polizaV2))).rejects.toThrow(/no encontrad/i);

    const ajeno = await callerDe(oficina).siniestros.create(alta(polizaV2));
    await expect(v1.siniestros.get({ id: ajeno.id })).rejects.toThrow(/no encontrado/i);
    await expect(v1.siniestros.agregarNota({ id: ajeno.id, nota: "x" })).rejects.toThrow(/no encontrado/i);
    const lista = await v1.siniestros.list({});
    expect(lista.length).toBeGreaterThan(0);
    expect(lista.every((r) => r.cliente === "Cliente Ficticio Uno")).toBe(true);

    await expect(v1.siniestros.cambiarEstado({ id: propio.id, destino: "cancelado", nota: "x" })).rejects.toThrow(/permiso/);
    await expect(v1.siniestros.actualizar({ id: propio.id, datos: { lugar: "x" } })).rejects.toThrow(/permiso/);
    await v1.siniestros.agregarNota({ id: propio.id, nota: "El cliente mandó fotos" });
    const det = await callerDe(oficina).siniestros.get({ id: propio.id });
    expect(det.eventos[0].nota).toBe("El cliente mandó fotos");
  });

  it("filtra la bandeja por aseguradora, abiertos y búsqueda", async () => {
    const ofi = callerDe(oficina);
    const atlas = await ofi.siniestros.list({ aseguradoraId: 2 });
    expect(atlas.length).toBeGreaterThan(0);
    expect(atlas.every((r) => r.aseguradora === "Atlas")).toBe(true);
    const abiertos = await ofi.siniestros.list({ soloAbiertos: true });
    expect(abiertos.some((r) => r.estado === "cerrado")).toBe(false);
    const porPlaca = await ofi.siniestros.list({ busqueda: "AAA000A" });
    expect(porPlaca.length).toBeGreaterThan(0);
    expect(porPlaca.every((r) => r.placas === "AAA000A")).toBe(true);
  });

  it("registra y quita terceros dejando rastro", async () => {
    const ofi = callerDe(oficina);
    const { id } = await ofi.siniestros.create(alta(polizaV1));
    const t = await ofi.siniestros.agregarTercero({ siniestroId: id, nombre: "Tercero Ficticio", placas: "ZZZ999Z" });
    expect((await ofi.siniestros.get({ id })).terceros).toHaveLength(1);
    await ofi.siniestros.quitarTercero({ id: t.id });
    const det = await ofi.siniestros.get({ id });
    expect(det.terceros).toHaveLength(0);
    expect(det.eventos.filter((e) => e.tipo === "tercero")).toHaveLength(2);
  });

  it("sin sesión no hay acceso", async () => {
    await expect(callerDe().siniestros.list({})).rejects.toThrow(/Inicia sesión/);
  });

  it("solo el admin administra usuarios; el nuevo usuario debe cambiar su contraseña", async () => {
    await expect(callerDe(oficina).usuarios.list()).rejects.toThrow(/permiso/);
    const nuevo = await callerDe(admin).usuarios.crear({ username: "nuevo.vendedor", nombre: "Nuevo", role: "vendedor" });
    expect(nuevo.passwordTemporal).toMatch(/^.{4}-.{4}-.{4}$/);
    const u = (await getDb().query.users.findFirst({ where: (t, { eq }) => eq(t.id, nuevo.id) }))!;
    await expect(callerDe(u).siniestros.list({})).rejects.toThrow(/contraseña temporal/);
  });
});

describe("HTTP", () => {
  it("login por HTTP da cookie de sesión y con ella se consulta", async () => {
    const res = await app.request("/api/trpc/auth.login", {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost:3000" },
      body: JSON.stringify({ json: { username: "oficina", password: "Prueba12345" } }),
    });
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!.split(";")[0];
    const lista = await app.request("/api/trpc/siniestros.list?input=" + encodeURIComponent(JSON.stringify({ json: {} })), {
      headers: { cookie, host: "localhost:3000" },
    });
    expect(lista.status).toBe(200);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("contraseña incorrecta no entra", async () => {
    const res = await app.request("/api/trpc/auth.login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: { username: "oficina", password: "otra" } }),
    });
    expect(res.status).toBe(401);
  });
});
