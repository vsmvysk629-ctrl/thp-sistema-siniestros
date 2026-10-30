/**
 * Datos FICTICIOS para probar el sistema y para la demo. Nunca cargar la cartera real aquí.
 * Los usa db/seed.ts (desarrollo) y la demo en el navegador (demo/).
 */
import { asc, eq } from "drizzle-orm";
import * as s from "./schema";
import { getDb } from "../api/queries/connection";
import { hashPassword } from "../api/auth/password";
import { asegurarAseguradoras } from "../api/auth-router";
import { asegurarCatalogos } from "../api/queries/configuracion";
import { createCallerFactory } from "../api/middleware";
import { appRouter } from "../api/router";
import type { Rol } from "../contracts/constants";
import type { Ramo } from "../contracts/catalogos";
import type { Estado } from "../contracts/flujo";

export const PASSWORD_DEMO = "Demo2026demo";

/** Siembra usuarios, contratantes, pólizas y siniestros de ejemplo en una base vacía. */
export async function sembrarDatosDemo() {
  const PASSWORD = PASSWORD_DEMO;
  const db = getDb();
  await asegurarAseguradoras();
  await asegurarCatalogos();
  const aseg = Object.fromEntries((await db.select().from(s.aseguradoras)).map((a) => [a.nombre, a.id]));

  async function usuario(username: string, nombre: string, role: Rol, puesto: string) {
    const [ya] = await db.select().from(s.users).where(eq(s.users.username, username));
    if (ya) return ya;
    await db.insert(s.users).values({ username, nombre, role, puesto, passwordHash: await hashPassword(PASSWORD) });
    return (await db.select().from(s.users).where(eq(s.users.username, username)))[0];
  }

  const admin = await usuario("admin", "Admin Demo", "admin", "Dirección");
  const laura = await usuario("laura", "Laura Demo", "ejecutivo", "Ejecutiva de siniestros");
  const oscar = await usuario("oscar", "Óscar Prueba", "ejecutivo", "Ejecutivo de siniestros");
  const marta = await usuario("marta", "Marta Ejemplo", "ejecutivo", "Ejecutiva de GMM");
  await usuario("consulta", "Consulta Demo", "consulta", "Contabilidad");

  const factory = createCallerFactory(appRouter);
  const como = (u: s.User) => factory({ req: new Request("http://localhost/"), resHeaders: new Headers(), user: u });
  const adm = como(admin);

  const dia = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

  const contratantes = [
    { nombre: "Transportes Ficticios del Bajío SA de CV", tipoPersona: "moral", rfc: "TFB000101AAA", contacto: "Jorge Ejemplo", telefono: "3300000001", ejecutivoId: oscar.id, clienteDesde: 2015 },
    { nombre: "Ana Prueba Ficticia", tipoPersona: "fisica", rfc: "PUFA800101AAA", telefono: "3300000002", ejecutivoId: laura.id, clienteDesde: 2019 },
    { nombre: "Bruno Demo Ejemplo", tipoPersona: "fisica", telefono: "3300000003", ejecutivoId: laura.id, clienteDesde: 2021 },
    { nombre: "Industrias Muestra SA de CV", tipoPersona: "moral", rfc: "IMU000101AAA", contacto: "RH Demo", telefono: "3300000004", ejecutivoId: marta.id, clienteDesde: 2012 },
    { nombre: "Carla Muestra Test", tipoPersona: "fisica", telefono: "3300000005", ejecutivoId: marta.id, clienteDesde: 2023 },
    { nombre: "Comercializadora Ejemplo SA de CV", tipoPersona: "moral", rfc: "CEJ000101AAA", contacto: "Compras Demo", telefono: "3300000006", ejecutivoId: oscar.id, clienteDesde: 2018 },
  ] as const;
  const cid: number[] = [];
  for (const c of contratantes) cid.push((await adm.catalogos.crearContratante(c)).id);

  const polizasDef: [number, string, string, Ramo, string][] = [
    [0, "DEMO-FL-1001", "Quálitas", "flot", "Flotilla 12 unidades"],
    [0, "DEMO-TR-1002", "Atlas", "trans", "Mercancía en tránsito"],
    [1, "DEMO-AU-2001", "Quálitas", "autos", "Nissan Versa 2021"],
    [1, "DEMO-CA-2002", "Potosí", "casa", "Casa habitación"],
    [2, "DEMO-AU-3001", "Atlas", "autos", "Volkswagen Jetta 2019"],
    [3, "DEMO-GC-4001", "Potosí", "gmmc", "GMM colectivo 85 asegurados"],
    [3, "DEMO-DE-4002", "Atlas", "danos", "Planta y maquinaria"],
    [4, "DEMO-GI-5001", "Potosí", "gmmi", "GMM individual familiar"],
    [4, "DEMO-VI-5002", "Atlas", "vida", "Vida individual"],
    [5, "DEMO-AU-6001", "Quálitas", "autos", "Chevrolet Aveo 2023"],
    [5, "DEMO-RC-6002", "Atlas", "rc", "RC general"],
  ];
  const pol: Record<string, number> = {};
  for (const [c, numero, a, ramo, descripcion] of polizasDef) {
    pol[numero] = (await adm.catalogos.crearPoliza({ numero, aseguradoraId: aseg[a], contratanteId: cid[c], ramo, descripcion, vigenciaInicio: "2026-01-01", vigenciaFin: "2027-01-01" })).id;
  }

  // Ejemplos de configuración (ficticios): un documento extra y días de aviso propios para una compañía.
  await adm.configuracion.guardarPlantilla({ ramo: "autos", tipo: null, aseguradoraId: aseg["Quálitas"], nombre: "Formato de declaración de la aseguradora (demo)" });
  await adm.configuracion.guardarAseguradora({ id: aseg["Quálitas"], nombre: "Quálitas", diasSinRespuesta: 10, notas: "Dato de demostración" });

  type Caso = {
    quien: s.User;
    c: number;
    poliza: string;
    tipo: string;
    afectado: string;
    descripcion: string;
    dias: number; // antigüedad del reporte
    quieto: number; // días desde el último movimiento
    docs: number; // documentos ya recibidos y validados (-1 = todos)
    conceptos?: [string, number, number][];
    hasta: Estado;
    autorizado?: number;
    pagos?: number[];
    autos?: Partial<{ numeroReporte: string; ajustadorNombre: string; ajustadorTelefono: string; tallerNombre: string; lugar: string; conductorNombre: string; deducible: string; responsabilidad: "asegurado" | "tercero" | "compartida" }>;
    accion?: [string, number];
  };

  const AUTOS = { ajustadorNombre: "Ajustador Demo", ajustadorTelefono: "3300000099", lugar: "Av. Ficticia 123, Guadalajara" };
  const casos: Caso[] = [
    { quien: laura, c: 1, poliza: "DEMO-AU-2001", tipo: "Colisión", afectado: "Nissan Versa 2021", descripcion: "Alcance en crucero, daño en defensa trasera (demo).", dias: 1, quieto: 1, docs: 0, hasta: "reportado", autos: { ...AUTOS, numeroReporte: "REP-DEMO-01", conductorNombre: "Ana Prueba Ficticia" } },
    { quien: oscar, c: 0, poliza: "DEMO-FL-1001", tipo: "Robo total", afectado: "Unidad 07 · Kenworth 2020", descripcion: "Robo de unidad en carretera (demo).", dias: 9, quieto: 5, docs: 3, hasta: "recopilacion", autos: { ...AUTOS, numeroReporte: "REP-DEMO-02", conductorNombre: "Chofer Demo" }, accion: ["Pedir baja de placas y duplicado de llaves", -2] },
    { quien: laura, c: 2, poliza: "DEMO-AU-3001", tipo: "Colisión", afectado: "Volkswagen Jetta 2019", descripcion: "Choque lateral, responsabilidad del tercero (demo).", dias: 14, quieto: 3, docs: -1, hasta: "documentacion_completa", autos: { ...AUTOS, numeroReporte: "REP-DEMO-03", tallerNombre: "Taller Demo", responsabilidad: "tercero", deducible: "0" }, accion: ["Ingresar expediente en portal de Atlas", 1] },
    { quien: oscar, c: 5, poliza: "DEMO-AU-6001", tipo: "Rotura de cristales", afectado: "Chevrolet Aveo 2023", descripcion: "Parabrisas estrellado (demo).", dias: 30, quieto: 21, docs: -1, hasta: "en_revision", autos: { ...AUTOS, numeroReporte: "REP-DEMO-04", tallerNombre: "Cristales Demo" }, accion: ["Llamar a Quálitas por la valuación", 3] },
    { quien: marta, c: 3, poliza: "DEMO-GC-4001", tipo: "Reembolso", afectado: "Empleado Demo Uno", descripcion: "Reembolso por cirugía de rodilla (demo).", dias: 40, quieto: 4, docs: -1, conceptos: [["Honorarios médicos", 45000, 5000], ["Hospital", 62000, 6500], ["Farmacia", 4950, 2650]], hasta: "info_adicional", accion: ["Enviar estudios faltantes a Potosí", 2] },
    { quien: marta, c: 4, poliza: "DEMO-GI-5001", tipo: "Reembolso", afectado: "Carla Muestra Test", descripcion: "Reembolso por consulta y estudios (demo).", dias: 55, quieto: 6, docs: -1, conceptos: [["Consultas", 6000, 0], ["Laboratorio", 9500, 1500]], hasta: "autorizado", autorizado: 14000, pagos: [8000], accion: ["Confirmar segundo pago con Potosí", 4] },
    { quien: oscar, c: 0, poliza: "DEMO-TR-1002", tipo: "Mercancía dañada", afectado: "Embarque Demo 445", descripcion: "Mercancía mojada en traslado (demo).", dias: 70, quieto: 10, docs: -1, conceptos: [["Mercancía dañada", 185000, 25000]], hasta: "autorizado", autorizado: 150000, accion: ["Dar seguimiento al pago de Atlas", 5] },
    { quien: laura, c: 1, poliza: "DEMO-CA-2002", tipo: "Daño por agua", afectado: "Casa habitación", descripcion: "Fuga de tinaco con daño en plafones (demo).", dias: 80, quieto: 12, docs: -1, conceptos: [["Reparación de plafones", 28000, 0]], hasta: "autorizado", autorizado: 26000, pagos: [26000], accion: ["Confirmar con la asegurada que recibió el pago y cerrar", 3] },
    { quien: oscar, c: 5, poliza: "DEMO-RC-6002", tipo: "Daños a terceros", afectado: "Tercero Demo", descripcion: "Daño a vehículo de cliente en estacionamiento (demo).", dias: 50, quieto: 8, docs: -1, hasta: "rechazado", accion: ["Preparar apelación con fotos adicionales", 6] },
    { quien: marta, c: 3, poliza: "DEMO-DE-4002", tipo: "Rotura de maquinaria", afectado: "Compresor línea 2", descripcion: "Falla eléctrica de compresor (demo).", dias: 120, quieto: 30, docs: -1, conceptos: [["Reparación de compresor", 98000, 0]], hasta: "cerrado", autorizado: 90000, pagos: [90000] },
    { quien: laura, c: 2, poliza: "DEMO-AU-3001", tipo: "Robo parcial", afectado: "Volkswagen Jetta 2019", descripcion: "Robo de espejos (demo). El cliente desistió.", dias: 150, quieto: 140, docs: 0, hasta: "cerrado" },
  ];

  const RUTA: Estado[] = ["recopilacion", "documentacion_completa", "ingresado", "en_revision"];

  for (const [i, k] of casos.entries()) {
    const call = como(k.quien);
    const { id, folio } = await call.siniestros.create({
      contratanteId: cid[k.c], polizaId: pol[k.poliza], aseguradoraId: 0, ramo: "autos", tipo: k.tipo, afectado: k.afectado,
      fechaOcurrido: dia(k.dias + 1), descripcion: k.descripcion, ejecutivoId: k.quien.id,
    });
    if (k.autos) await call.siniestros.actualizar({ id, datos: k.autos });
    const docs = await db.select().from(s.documentos).where(eq(s.documentos.siniestroId, id)).orderBy(asc(s.documentos.orden));
    const recibidos = k.docs === -1 ? docs.length : k.docs;
    for (const d of docs.slice(0, recibidos)) await call.expediente.documentoEstado({ id: d.id, estado: "validado" });
    for (const [concepto, importe, np] of k.conceptos ?? []) {
      await call.expediente.guardarConcepto({ siniestroId: id, concepto, importe: String(importe), noProcedente: String(np), dictamen: np ? "parcial" : "procedente" });
    }
    const mover = (destino: Estado, extra: { folio?: string; nota?: string; montoAutorizado?: string } = {}) =>
      call.siniestros.cambiarEstado({ id, destino, ...extra });
    const meta = k.hasta === "cerrado" && !k.autorizado ? 0 : ESTADOS_ORDEN(k.hasta);
    for (const e of RUTA.slice(0, meta)) await mover(e, e === "ingresado" ? { folio: `SIN-DEMO-${1000 + i}` } : {});
    if (k.hasta === "info_adicional") await mover("info_adicional", { nota: "La aseguradora pide estudios de imagen y receta original (demo)." });
    if (k.hasta === "rechazado") await mover("rechazado", { nota: "La aseguradora considera que no hay responsabilidad del asegurado (demo)." });
    if (k.autorizado) {
      await mover("autorizado", { folio: `DICT-DEMO-${1000 + i}`, montoAutorizado: String(k.autorizado) });
      for (const [j, m] of (k.pagos ?? []).entries()) {
        await call.expediente.registrarPago({ siniestroId: id, concepto: j ? "Segundo pago" : "Pago de indemnización", fecha: dia(Math.max(k.quieto, 1)), monto: String(m), forma: "transferencia", referencia: `TRF-DEMO-${1000 + i}-${j + 1}` });
      }
    }
    if (k.hasta === "cerrado") {
      await mover("cerrado", k.autorizado ? {} : { nota: "El asegurado desistió del trámite (demo)." });
    } else if (k.accion) {
      await call.siniestros.accion({ id, proximaAccion: k.accion[0], fechaCompromiso: dia(-k.accion[1]) });
    }
    // Antigüedad simulada: fechas del reporte, bitácora repartida y último movimiento.
    await db.update(s.siniestros).set({ fechaOcurrido: dia(k.dias + 1), fechaReporte: dia(k.dias), ultimoMovimiento: new Date(Date.now() - k.quieto * 86_400_000) }).where(eq(s.siniestros.id, id));
    const evs = await db.select({ id: s.eventos.id }).from(s.eventos).where(eq(s.eventos.siniestroId, id)).orderBy(asc(s.eventos.id));
    for (const [j, e] of evs.entries()) {
      const hace = k.dias - ((k.dias - k.quieto) * j) / Math.max(evs.length - 1, 1);
      await db.update(s.eventos).set({ createdAt: new Date(Date.now() - hace * 86_400_000) }).where(eq(s.eventos.id, e.id));
    }
    if (["ingresado", "en_revision", "info_adicional", "autorizado", "rechazado"].includes(k.hasta) || k.autorizado) {
      await db.update(s.siniestros).set({ fechaIngreso: dia(Math.round(k.dias * 0.6)) }).where(eq(s.siniestros.id, id));
    }
    console.log(`  ${folio} · ${k.tipo} · ${k.hasta}`);
  }
}

function ESTADOS_ORDEN(e: Estado) {
  if (e === "reportado") return 0;
  if (e === "recopilacion") return 1;
  if (e === "documentacion_completa") return 2;
  return 4; // ingresado y en revisión antes de cualquier dictamen
}
