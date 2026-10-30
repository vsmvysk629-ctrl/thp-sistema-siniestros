import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@db/schema";
import { getDb } from "../api/queries/connection";
import { baseLimpia, callerDe, crearUsuario } from "./helpers";
import app from "../api/boot";
import { asegurarAseguradoras } from "../api/auth-router";
import { asegurarCatalogos } from "../api/queries/configuracion";

// Datos ficticios: ningún nombre, póliza ni número es real.
let admin: s.User, ej1: s.User, ej2: s.User, consulta: s.User;
let contratante: number, polizaAutos: number, polizaGmm: number;
const ase: Record<string, number> = {};
const anio = String(new Date().getFullYear()).slice(-2);

beforeAll(async () => {
  await baseLimpia();
  await asegurarAseguradoras();
  await asegurarCatalogos();
  for (const a of await getDb().select().from(s.aseguradoras)) ase[a.nombre] = a.id;
  admin = await crearUsuario("admin", "admin");
  ej1 = await crearUsuario("ej1", "ejecutivo");
  ej2 = await crearUsuario("ej2", "ejecutivo");
  consulta = await crearUsuario("consulta", "consulta");
  const c = callerDe(ej1);
  contratante = (await c.catalogos.crearContratante({ nombre: "Transportes Ficticios SA", tipoPersona: "moral", ejecutivoId: ej1.id })).id;
  polizaAutos = (await c.catalogos.crearPoliza({ numero: "PRB-AUT-1", aseguradoraId: ase["Quálitas"], contratanteId: contratante, ramo: "flot", descripcion: "5 unidades" })).id;
  polizaGmm = (await c.catalogos.crearPoliza({ numero: "PRB-GMM-1", aseguradoraId: ase["Atlas"], contratanteId: contratante, ramo: "gmmc" })).id;
});

const alta = (extra: Record<string, unknown> = {}) => ({
  contratanteId: contratante,
  polizaId: polizaAutos,
  aseguradoraId: ase["Potosí"], // se ignora: manda la póliza
  ramo: "gmmi" as const, // se ignora: manda la póliza
  tipo: "Colisión",
  afectado: "Unidad 01 · Camión ficticio",
  fechaOcurrido: "2026-10-20",
  ejecutivoId: ej1.id,
  ...extra,
});

async function docsValidados(id: number) {
  await getDb().update(s.documentos).set({ estado: "validado" }).where(eq(s.documentos.siniestroId, id));
}

describe("alta y expediente", () => {
  it("da folio consecutivo, toma ramo y compañía de la póliza y arma la documentación", async () => {
    const a = await callerDe(ej1).siniestros.create(alta());
    const b = await callerDe(ej1).siniestros.create(alta({ polizaId: polizaGmm, tipo: "Reembolso", afectado: "Empleado ficticio" }));
    expect(a.folio).toBe(`THP-S-${anio}-0001`);
    expect(b.folio).toBe(`THP-S-${anio}-0002`);
    const x = await callerDe(consulta).siniestros.get({ id: a.id });
    expect(x.ramo).toBe("flot");
    expect(x.aseguradora.nombre).toBe("Quálitas");
    expect(x.estado).toBe("reportado");
    expect(x.documentos.map((d) => d.nombre)).toContain("Declaración del conductor");
    expect(x.documentos.every((d) => d.estado === "pendiente")).toBe(true);
    expect(x.proximaAccion).toBe("Solicitar documentación al asegurado");
    expect(x.eventos[0].tipo).toBe("alta");
    expect(x.puedeEditar).toBe(false); // consulta solo ve
    const y = await callerDe(ej1).siniestros.get({ id: b.id });
    expect(y.documentos.map((d) => d.nombre)).toContain("Informe médico");
  });

  it("también acepta siniestros sin póliza en catálogo", async () => {
    const r = await callerDe(ej1).siniestros.create(alta({ polizaId: null, polizaTexto: "POR-CAPTURAR", aseguradoraId: ase["Potosí"], ramo: "autos" }));
    const x = await callerDe(ej1).siniestros.get({ id: r.id });
    expect(x.aseguradora.nombre).toBe("Potosí");
    expect(x.ramo).toBe("autos");
  });

  it("un ejecutivo no asigna siniestros a otro; el admin sí", async () => {
    await expect(callerDe(ej1).siniestros.create(alta({ ejecutivoId: ej2.id }))).rejects.toThrow(/administrador/);
    const r = await callerDe(admin).siniestros.create(alta({ ejecutivoId: ej2.id }));
    expect((await callerDe(admin).siniestros.get({ id: r.id })).ejecutivoId).toBe(ej2.id);
    await expect(callerDe(admin).siniestros.create(alta({ ejecutivoId: consulta.id }))).rejects.toThrow(/responsable/);
  });

  it("rechaza fecha de ocurrencia futura", async () => {
    await expect(callerDe(ej1).siniestros.create(alta({ fechaOcurrido: "2099-01-01" }))).rejects.toThrow(/futura/);
  });
});

describe("trámite completo", () => {
  it("de reportado a cerrado con documentos, folio, autorización y pagos", async () => {
    const c = callerDe(ej1);
    const { id } = await c.siniestros.create(alta({ polizaId: polizaGmm, tipo: "Reembolso", afectado: "Empleado ficticio" }));
    await c.siniestros.cambiarEstado({ id, destino: "recopilacion" });
    await expect(c.siniestros.cambiarEstado({ id, destino: "documentacion_completa" })).rejects.toThrow(/Faltan 11/);

    // Documentos: uno a la vez queda en bitácora
    const x0 = await c.siniestros.get({ id });
    await c.expediente.documentoEstado({ id: x0.documentos[0].id, estado: "recibido" });
    await c.expediente.documentoEstado({ id: x0.documentos[0].id, estado: "validado" });
    await docsValidados(id);
    await c.siniestros.cambiarEstado({ id, destino: "documentacion_completa" });
    await expect(c.siniestros.cambiarEstado({ id, destino: "ingresado" })).rejects.toThrow(/número de siniestro/);
    await c.siniestros.cambiarEstado({ id, destino: "ingresado", folio: "GM-FICT-1", proximaAccion: "Esperar dictamen", fechaCompromiso: "2026-11-04" });
    await c.siniestros.cambiarEstado({ id, destino: "info_adicional", nota: "Piden desglose de la cuenta" });
    await c.siniestros.cambiarEstado({ id, destino: "en_revision" });

    // Conceptos: reclamado y no procedente salen de su suma
    await c.expediente.guardarConcepto({ siniestroId: id, concepto: "Hospital", importe: "98,400", noProcedente: "6000", dictamen: "parcial" });
    await c.expediente.guardarConcepto({ siniestroId: id, concepto: "Farmacia", importe: "13550", noProcedente: "8150", dictamen: "por_corregir" });
    await expect(c.expediente.guardarConcepto({ siniestroId: id, concepto: "X", importe: "10", noProcedente: "20", dictamen: "parcial" })).rejects.toThrow(/mayor/);

    await expect(c.expediente.registrarPago({ siniestroId: id, concepto: "Pago 1", fecha: "2026-10-20", monto: "100", forma: "transferencia", referencia: "T-1" })).rejects.toThrow(/autorizó/);
    await expect(c.siniestros.cambiarEstado({ id, destino: "autorizado", montoAutorizado: "90000" })).rejects.toThrow(/folio/);
    await c.siniestros.cambiarEstado({ id, destino: "autorizado", folio: "DICT-FICT-1", montoAutorizado: "90000" });
    await expect(c.siniestros.cambiarEstado({ id, destino: "pagado" })).rejects.toThrow(/Financiero/);

    await expect(c.expediente.registrarPago({ siniestroId: id, concepto: "Pago 1", fecha: "2026-10-20", monto: "50000", forma: "transferencia", referencia: " " })).rejects.toThrow(/referencia/);
    const p1 = await c.expediente.registrarPago({ siniestroId: id, concepto: "Pago 1 · anticipo", fecha: "2026-10-20", monto: "50000", forma: "transferencia", referencia: "TRF-FICT-1" });
    expect(p1.estado).toBe("pago_parcial");
    await expect(c.expediente.registrarPago({ siniestroId: id, concepto: "Pago 2", fecha: "2026-10-21", monto: "40000.01", forma: "transferencia", referencia: "TRF-FICT-2" })).rejects.toThrow(/excede/);
    const p2 = await c.expediente.registrarPago({ siniestroId: id, concepto: "Pago 2 · finiquito", fecha: "2026-10-21", monto: "40000", forma: "transferencia", referencia: "TRF-FICT-2" });
    expect(p2.estado).toBe("pagado");
    expect((await c.siniestros.get({ id })).proximaAccion).toMatch(/recibió el pago/);
    await c.siniestros.cambiarEstado({ id, destino: "cerrado" });
    await expect(c.siniestros.cambiarEstado({ id, destino: "en_revision" })).rejects.toThrow(/No se puede pasar/);

    const x = await c.siniestros.get({ id });
    expect(x.estado).toBe("cerrado");
    expect(x.numeroSiniestro).toBe("GM-FICT-1");
    expect(x.fechaIngreso).not.toBeNull();
    expect(Number(x.reclamado)).toBe(111950);
    expect(Number(x.noProcedente)).toBe(14150);
    expect(Number(x.autorizado)).toBe(90000);
    expect(x.pagado).toBe(90000);
    expect(x.proximaAccion).toBeNull();
    const tipos = x.eventos.map((e) => e.tipo);
    expect(tipos.filter((t) => t === "pago")).toHaveLength(2);
    expect(tipos.filter((t) => t === "documento")).toHaveLength(2);
    const pagoFinal = x.eventos.find((e) => e.tipo === "pago" && e.estadoNuevo === "pagado");
    expect(pagoFinal?.folio).toBe("TRF-FICT-2");
    expect(x.eventos.find((e) => e.estadoNuevo === "autorizado")?.folio).toBe("DICT-FICT-1");
    expect(x.eventos.every((e) => e.autor === "Usuario ej1")).toBe(true);
  });

  it("lo autorizado y el estatus no se cuelan por la edición de datos", async () => {
    const c = callerDe(ej1);
    const { id } = await c.siniestros.create(alta());
    await c.siniestros.actualizar({ id, datos: { autorizado: "999", estado: "pagado" } as never });
    const x = await c.siniestros.get({ id });
    expect(x.autorizado).toBeNull();
    expect(x.estado).toBe("reportado");
    const r = await c.siniestros.actualizar({ id, datos: { ajustadorNombre: "Ajustador Ficticio", deducible: "9,225" } });
    expect([...r.cambiados].sort()).toEqual(["ajustadorNombre", "deducible"]);
    expect((await c.siniestros.get({ id })).deducible).toBe("9225.00");
  });
});

describe("permisos", () => {
  it("el ejecutivo solo modifica los suyos; consulta no modifica nada", async () => {
    const deEj2 = await callerDe(admin).siniestros.create(alta({ ejecutivoId: ej2.id }));
    await expect(callerDe(ej1).siniestros.cambiarEstado({ id: deEj2.id, destino: "recopilacion" })).rejects.toThrow(/responsable/);
    await expect(callerDe(ej1).siniestros.actualizar({ id: deEj2.id, datos: { lugar: "x" } })).rejects.toThrow(/responsable/);
    const doc = (await callerDe(ej1).siniestros.get({ id: deEj2.id })).documentos[0];
    await expect(callerDe(ej1).expediente.documentoEstado({ id: doc.id, estado: "recibido" })).rejects.toThrow(/responsable/);
    // Notas sí: cualquier ejecutivo
    await callerDe(ej1).siniestros.agregarNota({ id: deEj2.id, nota: "Le avisé a la compañera" });
    await callerDe(ej2).siniestros.cambiarEstado({ id: deEj2.id, destino: "recopilacion" });
    await callerDe(admin).siniestros.cambiarEstado({ id: deEj2.id, destino: "cerrado", nota: "Duplicado (prueba)" });

    await expect(callerDe(consulta).siniestros.create(alta())).rejects.toThrow(/permiso/);
    await expect(callerDe(consulta).siniestros.agregarNota({ id: deEj2.id, nota: "x" })).rejects.toThrow(/permiso/);
    expect((await callerDe(consulta).siniestros.list({})).length).toBeGreaterThan(0);
    await expect(callerDe(consulta).usuarios.list()).rejects.toThrow(/permiso/);
    await expect(callerDe(ej1).usuarios.list()).rejects.toThrow(/permiso/);
  });

  it("solo el admin reasigna", async () => {
    const { id } = await callerDe(ej1).siniestros.create(alta());
    await expect(callerDe(ej1).siniestros.actualizar({ id, datos: { ejecutivoId: ej2.id } })).rejects.toThrow(/administrador/);
    await callerDe(admin).siniestros.actualizar({ id, datos: { ejecutivoId: ej2.id } });
    expect((await callerDe(ej1).siniestros.get({ id })).puedeEditar).toBe(false);
  });

  it("sin sesión no hay acceso; el usuario nuevo debe cambiar su contraseña", async () => {
    await expect(callerDe().siniestros.list({})).rejects.toThrow(/Inicia sesión/);
    const nuevo = await callerDe(admin).usuarios.crear({ username: "nuevo.ej", nombre: "Nuevo", puesto: "Ejecutiva de autos", role: "ejecutivo" });
    expect(nuevo.passwordTemporal).toMatch(/^.{4}-.{4}-.{4}$/);
    const [u] = await getDb().select().from(s.users).where(eq(s.users.id, nuevo.id));
    await expect(callerDe(u).siniestros.list({})).rejects.toThrow(/contraseña temporal/);
  });
});

describe("bandeja, tablero y reportes", () => {
  it("filtra por estatus, ramo, compañía, ejecutivo y búsqueda", async () => {
    const c = callerDe(consulta);
    const todos = await c.siniestros.list({ grupoEstado: "todos" });
    const abiertos = await c.siniestros.list({ grupoEstado: "abiertos" });
    expect(abiertos.some((r) => r.estado === "cerrado")).toBe(false);
    expect(todos.length).toBeGreaterThan(abiertos.length);
    expect((await c.siniestros.list({ grupoRamo: "gmm" })).every((r) => r.ramo === "gmmc")).toBe(true);
    expect((await c.siniestros.list({ aseguradoraId: ase["Potosí"] })).every((r) => r.aseguradora === "Potosí")).toBe(true);
    expect((await c.siniestros.list({ ejecutivoId: ej2.id })).every((r) => r.ejecutivoId === ej2.id)).toBe(true);
    const porPoliza = await c.siniestros.list({ busqueda: "PRB-GMM" });
    expect(porPoliza.length).toBeGreaterThan(0);
    expect(porPoliza.every((r) => r.poliza === "PRB-GMM-1")).toBe(true);
  });

  it("el tablero cuenta y avisa", async () => {
    const t = await callerDe(consulta).tablero.resumen();
    expect(t.kpis.registrados).toBe(t.kpis.abiertos + t.kpis.cerrados);
    expect(t.kpis.pagado).toBe(90000);
    expect(t.kpis.tiempoPromedio).not.toBeNull();
    expect(t.alertas.length).toBeGreaterThan(0);
    expect(t.porGrupo.find((g) => g.grupo === "autos")!.n).toBeGreaterThan(0);
  });

  it("vencido y sin movimiento aparecen como alertas", async () => {
    const c = callerDe(ej1);
    const { id } = await c.siniestros.create(alta());
    await c.siniestros.accion({ id, proximaAccion: "Llamar al ajustador", fechaCompromiso: "2026-01-01" });
    const t = await c.tablero.resumen();
    expect(t.alertas.some((a) => a.siniestroId === id && a.titulo === "Compromiso vencido" && a.sev === "alta")).toBe(true);
  });

  it("reportes por ramo, compañía, ejecutivo y tiempos", async () => {
    const c = callerDe(consulta);
    const ramo = await c.tablero.reportes({ por: "ramo" });
    expect(ramo.filas.find((f) => f.clave === "gmm")!.pagado).toBe(90000);
    expect((await c.tablero.reportes({ por: "aseguradora" })).filas.length).toBeGreaterThan(1);
    expect((await c.tablero.reportes({ por: "ejecutivo" })).filas.length).toBeGreaterThan(1);
    expect((await c.tablero.reportes({ por: "tiempos" })).tiempos[0].nombre).toBe("Atlas");
  });

  it("contratantes con totales", async () => {
    const lista = await callerDe(consulta).catalogos.contratantes({});
    const c = lista.find((x) => x.id === contratante)!;
    expect(c.siniestros).toBeGreaterThan(3);
    expect(c.pagado).toBe(90000);
    expect(c.ramos.sort()).toEqual(["flot", "gmmc"]);
  });
});

describe("HTTP", () => {
  it("login por HTTP da cookie de sesión y con ella se consulta", async () => {
    const res = await app.request("/api/trpc/auth.login", {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost:3000" },
      body: JSON.stringify({ json: { username: "ej1", password: "Prueba12345" } }),
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
      body: JSON.stringify({ json: { username: "ej1", password: "otra" } }),
    });
    expect(res.status).toBe(401);
  });
});

describe("configuración del administrador", () => {
  it("solo el administrador cambia catálogos y ajustes", async () => {
    await expect(callerDe(ej1).configuracion.guardarTipo({ ramo: "autos", nombre: "Granizo" })).rejects.toThrow(/permiso/);
    await expect(callerDe(consulta).configuracion.plantillas()).rejects.toThrow(/permiso/);
    const cfg = await callerDe(ej1).configuracion.get();
    expect(cfg.tipos.some((t) => t.ramo === "flot" && t.nombre === "Colisión")).toBe(true);
  });

  it("los documentos de una aseguradora se suman a los del ramo", async () => {
    const a = callerDe(admin);
    await a.configuracion.guardarPlantilla({ ramo: "flot", tipo: null, aseguradoraId: ase["Quálitas"], nombre: "Formato de declaración (ficticio)" });
    const qualitas = await a.configuracion.documentosPreview({ ramo: "flot", tipo: "Colisión", aseguradoraId: ase["Quálitas"] });
    const atlas = await a.configuracion.documentosPreview({ ramo: "flot", tipo: "Colisión", aseguradoraId: ase["Atlas"] });
    expect(qualitas).toContain("Formato de declaración (ficticio)");
    expect(atlas).not.toContain("Formato de declaración (ficticio)");
    expect(qualitas.length).toBe(atlas.length + 1);
    const robo = await a.configuracion.documentosPreview({ ramo: "flot", tipo: "Robo total", aseguradoraId: null });
    expect(robo).toContain("Baja de placas");
    // El expediente nuevo (póliza de Quálitas) trae el documento extra.
    const { id } = await callerDe(ej1).siniestros.create(alta());
    const x = await callerDe(ej1).siniestros.get({ id });
    expect(x.documentos.map((d) => d.nombre)).toContain("Formato de declaración (ficticio)");
  });

  it("la primera acción y los días de aviso salen de los ajustes", async () => {
    const a = callerDe(admin);
    await a.configuracion.guardarAjustes({ diasSinMovimiento: 15, diasCompromisoInicial: 5, accionInicial: "Llamar al asegurado (ficticio)", nombreAgencia: "THP Seguros" });
    const c = callerDe(ej1);
    const { id } = await c.siniestros.create(alta());
    expect((await c.siniestros.get({ id })).proximaAccion).toBe("Llamar al asegurado (ficticio)");
    // Lo ingresamos y lo dejamos 3 días sin movimiento: con 2 días para Quálitas ya avisa.
    const db = getDb();
    await db.update(s.siniestros).set({ estado: "ingresado", ultimoMovimiento: new Date(Date.now() - 3 * 86_400_000) }).where(eq(s.siniestros.id, id));
    const sinAviso = await c.tablero.resumen();
    expect(sinAviso.alertas.some((x) => x.siniestroId === id && x.titulo.startsWith("Sin movimiento"))).toBe(false);
    await a.configuracion.guardarAseguradora({ id: ase["Quálitas"], nombre: "Quálitas", diasSinRespuesta: 2 });
    const conAviso = await c.tablero.resumen();
    expect(conAviso.alertas.some((x) => x.siniestroId === id && x.titulo.startsWith("Sin movimiento"))).toBe(true);
  });

  it("cada ejecutivo puede ver solo lo suyo en el tablero", async () => {
    await callerDe(ej2).siniestros.create(alta({ ejecutivoId: ej2.id }));
    const mios = await callerDe(ej2).tablero.resumen({ soloMios: true });
    const todo = await callerDe(ej2).tablero.resumen();
    expect(mios.kpis.registrados).toBeGreaterThan(0);
    expect(mios.kpis.registrados).toBeLessThan(todo.kpis.registrados);
    expect(mios.compromisos.every((r) => r.ejecutivoId === ej2.id)).toBe(true);
  });
});

describe("restablecer contraseña", () => {
  it("solo el administrador la restablece; la anterior deja de servir y pide cambiarla", async () => {
    const { verifyPassword } = await import("../api/auth/password");
    await expect(callerDe(ej1).usuarios.restablecer({ id: ej2.id })).rejects.toThrow();
    await expect(callerDe(admin).usuarios.restablecer({ id: admin.id })).rejects.toThrow(/propia/);
    const { passwordTemporal } = await callerDe(admin).usuarios.restablecer({ id: ej2.id });
    const [u] = await getDb().select().from(s.users).where(eq(s.users.id, ej2.id));
    expect(u.debeCambiarPassword).toBe(true);
    expect(await verifyPassword(passwordTemporal, u.passwordHash)).toBe(true);
    expect(await verifyPassword("Prueba12345", u.passwordHash)).toBe(false);
  });
});

describe("catálogo de aseguradoras", () => {
  it("las compañías disponibles se cargan inactivas y no salen en los formularios", async () => {
    const nombres = (await callerDe(ej1).catalogos.aseguradoras()).map((a) => a.nombre);
    expect(nombres).toEqual(expect.arrayContaining(["Quálitas", "Atlas", "Potosí"]));
    expect(nombres).not.toContain("GNP");
    const [gnp] = await getDb().select().from(s.aseguradoras).where(eq(s.aseguradoras.nombre, "GNP"));
    expect(gnp.activa).toBe(false);
  });
});

describe("archivos del expediente", () => {
  const pdf = Buffer.from("%PDF-1.4 archivo ficticio").toString("base64");

  it("sube un archivo ligado a un documento, lo marca recibido y solo el responsable puede subir o quitar", async () => {
    const { id } = await callerDe(ej1).siniestros.create(alta());
    const exp = await callerDe(ej1).siniestros.get({ id });
    const doc = exp.documentos[0];
    expect(doc.estado).toBe("pendiente");

    await expect(callerDe(ej2).expediente.subirArchivo({ siniestroId: id, documentoId: doc.id, nombre: "a.pdf", tipo: "application/pdf", base64: pdf })).rejects.toThrow();
    await expect(callerDe(ej1).expediente.subirArchivo({ siniestroId: id, nombre: "x.exe", tipo: "application/x-msdownload", base64: pdf })).rejects.toThrow(/Formato/);

    const subido = await callerDe(ej1).expediente.subirArchivo({ siniestroId: id, documentoId: doc.id, nombre: "Denuncia.pdf", tipo: "application/pdf", base64: pdf });
    const despues = await callerDe(consulta).siniestros.get({ id });
    expect(despues.documentos.find((d) => d.id === doc.id)?.estado).toBe("recibido");
    expect(despues.archivos).toHaveLength(1);
    expect(despues.archivos[0]).not.toHaveProperty("contenido");
    expect(despues.archivos[0].tamano).toBe(Buffer.from(pdf, "base64").length);

    // Consulta puede abrirlo, no quitarlo.
    expect((await callerDe(consulta).expediente.archivo({ id: subido.id })).base64).toBe(pdf);
    await expect(callerDe(consulta).expediente.borrarArchivo({ id: subido.id })).rejects.toThrow();
    await callerDe(ej1).expediente.borrarArchivo({ id: subido.id });
    expect((await callerDe(ej1).siniestros.get({ id })).archivos).toHaveLength(0);
  });

  it("rechaza archivos de más de 10 MB y documentos de otro siniestro", async () => {
    const a = await callerDe(ej1).siniestros.create(alta());
    const b = await callerDe(ej1).siniestros.create(alta());
    const docB = (await callerDe(ej1).siniestros.get({ id: b.id })).documentos[0];
    const grande = Buffer.alloc(10 * 1024 * 1024 + 1).toString("base64");
    await expect(callerDe(ej1).expediente.subirArchivo({ siniestroId: a.id, nombre: "g.pdf", tipo: "application/pdf", base64: grande })).rejects.toThrow(/10 MB/);
    await expect(callerDe(ej1).expediente.subirArchivo({ siniestroId: a.id, documentoId: docB.id, nombre: "a.pdf", tipo: "application/pdf", base64: pdf })).rejects.toThrow(/no encontrado/);
  });
});

describe("seguimiento (1C)", () => {
  it("propone, no repite, solo el admin aprueba y el envío queda en la bitácora", async () => {
    const { id } = await callerDe(ej1).siniestros.create(alta());
    const l1 = await callerDe(ej1).seguimiento.lista();
    const mio = l1.porAprobar.filter((b) => b.siniestroId === id);
    expect(mio.map((b) => b.motivo)).toEqual(["documentos"]);
    expect(mio[0].para).toBe("cliente");
    // No se repite al volver a abrir.
    expect((await callerDe(ej1).seguimiento.lista()).porAprobar.filter((b) => b.siniestroId === id)).toHaveLength(1);
    // Otro ejecutivo no lo ve; el ejecutivo no aprueba.
    expect((await callerDe(ej2).seguimiento.lista()).porAprobar.some((b) => b.siniestroId === id)).toBe(false);
    await expect(callerDe(ej1).seguimiento.aprobar({ id: mio[0].id, texto: "x" })).rejects.toThrow();
    await expect(callerDe(consulta).seguimiento.lista()).rejects.toThrow();
    // No se envía antes de aprobar.
    await expect(callerDe(ej1).seguimiento.marcarEnviado({ id: mio[0].id })).rejects.toThrow(/aprobado/);
    await callerDe(ej1).seguimiento.editar({ id: mio[0].id, texto: "Texto corregido por la ejecutiva" });
    await callerDe(admin).seguimiento.aprobar({ id: mio[0].id, texto: "Texto final aprobado" });
    const l2 = await callerDe(ej1).seguimiento.lista();
    expect(l2.porEnviar.find((b) => b.id === mio[0].id)?.texto).toBe("Texto final aprobado");
    expect(await callerDe(ej1).seguimiento.conteo()).toBeGreaterThan(0);
    await callerDe(ej1).seguimiento.marcarEnviado({ id: mio[0].id });
    const exp = await callerDe(ej1).siniestros.get({ id });
    expect(exp.eventos.some((e) => /Se envió mensaje al cliente/.test(e.nota ?? ""))).toBe(true);
    // Recién enviado: no se vuelve a proponer de inmediato.
    expect((await callerDe(ej1).seguimiento.lista()).porAprobar.some((b) => b.siniestroId === id)).toBe(false);
  });
});
