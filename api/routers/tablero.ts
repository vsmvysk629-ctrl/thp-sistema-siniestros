import { sql } from "drizzle-orm";
import { z } from "zod";
import * as s from "@db/schema";
import { GRUPOS, GRUPO_DE, GRUPO_LABEL } from "@contracts/catalogos";
import { esAbierto } from "@contracts/flujo";
import { authedQuery, createRouter } from "../middleware";
import { getDb } from "../queries/connection";
import { hoyISO } from "../queries/siniestros";
import { AJUSTES_DEFAULT, leerAjustes } from "../queries/configuracion";
import { listarSiniestros, type FilaSiniestro } from "./siniestros";

/** Días sin respuesta de la aseguradora a partir de los cuales se avisa (valor de fábrica). */
export const DIAS_SIN_MOVIMIENTO = AJUSTES_DEFAULT.diasSinMovimiento;

const dias = (desde: string, hasta: string) => Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000);

/** Fecha del último pago de cada siniestro, para medir del reporte al pago. */
async function ultimosPagos() {
  const rows = await getDb()
    .select({ siniestroId: s.pagos.siniestroId, ultimo: sql<string>`max(${s.pagos.fecha})` })
    .from(s.pagos)
    .groupBy(s.pagos.siniestroId);
  return new Map(rows.map((r) => [r.siniestroId, String(r.ultimo).slice(0, 10)]));
}

function tiempoResolucion(rows: FilaSiniestro[], pagos: Map<number, string>) {
  const ds = rows
    .filter((r) => (r.estado === "pagado" || r.estado === "cerrado") && pagos.has(r.id))
    .map((r) => dias(r.fechaReporte, pagos.get(r.id)!));
  return ds.length ? Math.round(ds.reduce((a, b) => a + b, 0) / ds.length) : null;
}

/** Días sin respuesta por aseguradora; las que no tienen el suyo usan el ajuste general. */
async function limitesSinRespuesta() {
  const db = getDb();
  const [ajustes, ases] = await Promise.all([leerAjustes(db), db.select({ id: s.aseguradoras.id, dias: s.aseguradoras.diasSinRespuesta }).from(s.aseguradoras)]);
  const porId = new Map(ases.map((a) => [a.id, a.dias]));
  return (id: number) => porId.get(id) ?? ajustes.diasSinMovimiento;
}

export type Alerta = {
  sev: "alta" | "media" | "baja";
  titulo: string;
  siniestroId: number;
  folio: string;
  detalle: string;
  quien: string | null;
  cuando: string | null;
};

export function alertasDe(rows: FilaSiniestro[], hoy: string, limite: (aseguradoraId: number) => number = () => DIAS_SIN_MOVIMIENTO): Alerta[] {
  const out: Alerta[] = [];
  for (const r of rows.filter((x) => esAbierto(x.estado))) {
    const base = { siniestroId: r.id, folio: r.folio, quien: r.ejecutivo };
    const det = (t: string | null) => [t, r.contratante].filter(Boolean).join(" · ");
    const vencido = r.fechaCompromiso !== null && r.fechaCompromiso < hoy;
    if (vencido) out.push({ ...base, sev: "alta", titulo: "Compromiso vencido", detalle: det(r.proximaAccion), cuando: `Venció ${r.fechaCompromiso}` });
    if (r.estado === "info_adicional") out.push({ ...base, sev: "alta", titulo: "La aseguradora pide información", detalle: det(r.proximaAccion), cuando: r.fechaCompromiso && `Plazo: ${r.fechaCompromiso}` });
    if (r.estado === "rechazado") out.push({ ...base, sev: "alta", titulo: "Siniestro rechazado", detalle: det(r.proximaAccion), cuando: r.fechaCompromiso });
    if ((r.estado === "reportado" || r.estado === "recopilacion") && !vencido) out.push({ ...base, sev: "media", titulo: "Documentos pendientes", detalle: det(r.proximaAccion), cuando: r.fechaCompromiso });
    if (r.estado === "documentacion_completa") out.push({ ...base, sev: "media", titulo: "Listo para ingresar", detalle: det("Documentación completa"), cuando: r.fechaCompromiso });
    if (r.estado === "ingresado" || r.estado === "en_revision") {
      const d = dias(hoyISO(r.ultimoMovimiento), hoy);
      if (d >= limite(r.aseguradoraId)) {
        out.push({ ...base, sev: "media", titulo: `Sin movimiento hace ${d} días`, detalle: det(`${r.aseguradora} no ha respondido`), cuando: `Desde ${hoyISO(r.ultimoMovimiento)}` });
      }
    }
    if ((r.estado === "autorizado" || r.estado === "pago_parcial") && r.autorizado !== null) {
      const saldo = r.autorizado - r.pagado;
      out.push({ ...base, sev: "baja", titulo: "Pago pendiente", detalle: det(`Saldo por cobrar $${saldo.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`), cuando: r.fechaCompromiso });
    }
  }
  const orden = { alta: 0, media: 1, baja: 2 };
  return out.sort((a, b) => orden[a.sev] - orden[b.sev]);
}

function agrupar(rows: FilaSiniestro[], clave: (r: FilaSiniestro) => string | number, nombres: [string | number, string][]) {
  return nombres
    .map(([k, nombre]) => {
      const g = rows.filter((r) => clave(r) === k);
      const reclamado = g.reduce((a, r) => a + r.reclamado, 0);
      const pagado = g.reduce((a, r) => a + r.pagado, 0);
      return { clave: k, nombre, n: g.length, abiertos: g.filter((r) => esAbierto(r.estado)).length, reclamado, pagado, pct: reclamado ? Math.round((pagado / reclamado) * 100) : 0 };
    })
    .filter((r) => r.n > 0);
}

export const tableroRouter = createRouter({
  /** Con soloMios, el tablero se limita a los siniestros a cargo de quien lo consulta. */
  resumen: authedQuery.input(z.object({ soloMios: z.boolean().optional() }).optional()).query(async ({ ctx, input }) => {
    const rows = await listarSiniestros(input?.soloMios ? { ejecutivoId: ctx.user.id } : {});
    const hoy = hoyISO();
    const abiertos = rows.filter((r) => esAbierto(r.estado));
    const cuenta = (...es: FilaSiniestro["estado"][]) => rows.filter((r) => es.includes(r.estado)).length;
    const reclamado = rows.reduce((a, r) => a + r.reclamado, 0);
    const pagado = rows.reduce((a, r) => a + r.pagado, 0);
    const pendiente = abiertos.reduce((a, r) => a + (r.autorizado !== null ? Math.max(0, r.autorizado - r.pagado) : 0), 0);
    const alertas = alertasDe(rows, hoy, await limitesSinRespuesta());
    const porGrupo = GRUPOS.map((g) => ({ grupo: g, nombre: GRUPO_LABEL[g], n: abiertos.filter((r) => GRUPO_DE[r.ramo] === g).length }));
    const compromisos = abiertos
      .filter((r) => r.proximaAccion)
      .sort((a, b) => (a.fechaCompromiso ?? "9999").localeCompare(b.fechaCompromiso ?? "9999"))
      .slice(0, 8);
    return {
      hoy,
      kpis: {
        registrados: rows.length,
        abiertos: abiertos.length,
        cerrados: cuenta("cerrado"),
        pendientesDoc: cuenta("recopilacion", "info_adicional"),
        ingresados: cuenta("ingresado", "en_revision"),
        pendientesPago: cuenta("autorizado", "pago_parcial"),
        reclamado,
        pagado,
        pctPagado: reclamado ? Math.round((pagado / reclamado) * 1000) / 10 : 0,
        pendienteIndemnizar: pendiente,
        tiempoPromedio: tiempoResolucion(rows, await ultimosPagos()),
      },
      alertas,
      porGrupo,
      compromisos,
    };
  }),

  reportes: authedQuery.input(z.object({ por: z.enum(["ramo", "aseguradora", "ejecutivo", "tiempos"]) })).query(async ({ input }) => {
    const rows = await listarSiniestros({});
    if (input.por === "tiempos") {
      const pagos = await ultimosPagos();
      const nombres = [...new Map(rows.map((r) => [r.aseguradoraId, r.aseguradora])).entries()];
      return {
        filas: [],
        tiempos: nombres
          .map(([id, nombre]) => {
            const g = rows.filter((r) => r.aseguradoraId === id);
            return { nombre, dias: tiempoResolucion(g, pagos), n: g.filter((r) => (r.estado === "pagado" || r.estado === "cerrado") && pagos.has(r.id)).length };
          })
          .filter((t) => t.dias !== null)
          .sort((a, b) => a.dias! - b.dias!),
      };
    }
    const filas =
      input.por === "ramo"
        ? agrupar(rows, (r) => GRUPO_DE[r.ramo], GRUPOS.map((g) => [g, GRUPO_LABEL[g]]))
        : input.por === "aseguradora"
          ? agrupar(rows, (r) => r.aseguradoraId, [...new Map(rows.map((r) => [r.aseguradoraId, r.aseguradora])).entries()])
          : agrupar(rows, (r) => r.ejecutivoId, [...new Map(rows.map((r) => [r.ejecutivoId, r.ejecutivo ?? "—"])).entries()]);
    return { filas, tiempos: [] };
  }),
});
