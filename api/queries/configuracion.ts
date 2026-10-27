import { asc, eq, sql } from "drizzle-orm";
import * as s from "@db/schema";
import { RAMOS, TIPOS, documentosPara, esAutos, type Ramo } from "@contracts/catalogos";
import { getDb, type Tx } from "./connection";

/** Valores de fábrica de los ajustes que puede cambiar el administrador. */
export const AJUSTES_DEFAULT = {
  /** Días sin respuesta de la aseguradora antes de avisar (si la compañía no tiene el suyo). */
  diasSinMovimiento: 15,
  /** Días para la fecha compromiso de la primera acción de un siniestro nuevo. */
  diasCompromisoInicial: 2,
  /** Primera acción que se asigna al registrar un siniestro. */
  accionInicial: "Solicitar documentación al asegurado",
  /** Nombre que aparece en los impresos. */
  nombreAgencia: "THP Seguros",
};
export type Ajustes = typeof AJUSTES_DEFAULT;

export async function leerAjustes(db: Tx = getDb()): Promise<Ajustes> {
  const filas = await db.select().from(s.ajustes);
  const a: Ajustes = { ...AJUSTES_DEFAULT };
  for (const f of filas) {
    if (f.clave === "diasSinMovimiento" || f.clave === "diasCompromisoInicial") a[f.clave] = Number(f.valor);
    else if (f.clave === "accionInicial" || f.clave === "nombreAgencia") a[f.clave] = f.valor;
  }
  return a;
}

/** Carga los tipos y documentos de fábrica la primera vez. No toca lo que el administrador ya cambió. */
export async function asegurarCatalogos() {
  const db = getDb();
  const [{ n: tipos }] = await db.select({ n: sql<number>`count(*)` }).from(s.tiposSiniestro);
  if (Number(tipos) === 0) {
    await db.insert(s.tiposSiniestro).values(RAMOS.flatMap((ramo) => TIPOS[ramo].map((nombre, orden) => ({ ramo, nombre, orden }))));
  }
  const [{ n: docs }] = await db.select({ n: sql<number>`count(*)` }).from(s.plantillasDocumento);
  if (Number(docs) === 0) {
    const filas = RAMOS.flatMap((ramo) => [
      ...documentosPara(ramo, "").map((nombre, orden) => ({ ramo, tipo: null, nombre, orden })),
      ...(esAutos(ramo) ? documentosPara(ramo, "Robo total").map((nombre, orden) => ({ ramo, tipo: "Robo total", nombre, orden })) : []),
    ]);
    await db.insert(s.plantillasDocumento).values(filas);
  }
}

/**
 * Documentos a pedir para un siniestro. Si hay documentos para el tipo exacto, reemplazan a los
 * generales del ramo; los de la aseguradora se suman al final.
 */
export async function documentosDe(db: Tx, ramo: Ramo, tipo: string, aseguradoraId: number | null): Promise<string[]> {
  const filas = await db
    .select()
    .from(s.plantillasDocumento)
    .where(eq(s.plantillasDocumento.ramo, ramo))
    .orderBy(asc(s.plantillasDocumento.orden), asc(s.plantillasDocumento.id));
  if (!filas.length) return documentosPara(ramo, tipo);
  const activas = filas.filter((f) => f.activo);
  const generales = activas.filter((f) => f.aseguradoraId === null);
  const delTipo = generales.filter((f) => f.tipo === tipo);
  const base = delTipo.length ? delTipo : generales.filter((f) => f.tipo === null);
  const deLaCompania = activas.filter((f) => f.aseguradoraId !== null && f.aseguradoraId === aseguradoraId && (f.tipo === null || f.tipo === tipo));
  return [...new Set([...base, ...deLaCompania].map((f) => f.nombre))];
}
