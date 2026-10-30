import { and, eq, inArray, sql } from "drizzle-orm";
import * as s from "@db/schema";
import { DOC_FALTANTE } from "@contracts/catalogos";
import type { Tx } from "./connection";

export type NuevoEvento = Omit<typeof s.eventos.$inferInsert, "id" | "createdAt">;

/** Deja el evento en la bitácora y marca el siniestro como movido hoy. */
export async function registrarEvento(tx: Tx, e: NuevoEvento) {
  await tx.insert(s.eventos).values(e);
  await tx.update(s.siniestros).set({ ultimoMovimiento: new Date() }).where(eq(s.siniestros.id, e.siniestroId));
}

export async function documentosFaltantes(tx: Tx, siniestroId: number) {
  const [r] = await tx
    .select({ n: sql<number>`count(*)` })
    .from(s.documentos)
    .where(and(eq(s.documentos.siniestroId, siniestroId), inArray(s.documentos.estado, DOC_FALTANTE)));
  return Number(r?.n ?? 0);
}

export async function totalPagado(tx: Tx, siniestroId: number) {
  const [r] = await tx
    .select({ total: sql<string | null>`sum(${s.pagos.monto})` })
    .from(s.pagos)
    .where(eq(s.pagos.siniestroId, siniestroId));
  return Number(r?.total ?? 0);
}

/** Con conceptos capturados, lo reclamado y lo no procedente salen de su suma. */
export async function recalcularConceptos(tx: Tx, siniestroId: number) {
  const [r] = await tx
    .select({
      n: sql<number>`count(*)`,
      importe: sql<string | null>`sum(${s.conceptos.importe})`,
      np: sql<string | null>`sum(${s.conceptos.noProcedente})`,
    })
    .from(s.conceptos)
    .where(eq(s.conceptos.siniestroId, siniestroId));
  if (Number(r?.n ?? 0) === 0) return;
  await tx
    .update(s.siniestros)
    .set({ reclamado: r.importe ?? "0", noProcedente: r.np ?? "0" })
    .where(eq(s.siniestros.id, siniestroId));
}

/** Siguiente folio interno del año: THP-S-26-0001. */
export async function siguienteFolio(tx: Tx, hoy = new Date()) {
  const prefijo = `THP-S-${String(hoy.getFullYear()).slice(-2)}-`;
  const [row] = await tx
    .select({ ultimo: sql<string | null>`max(${s.siniestros.folio})` })
    .from(s.siniestros)
    .where(sql`${s.siniestros.folio} like ${prefijo + "%"}`);
  const n = row?.ultimo ? Number(row.ultimo.slice(prefijo.length)) + 1 : 1;
  return `${prefijo}${String(n).padStart(4, "0")}`;
}

/** Fecha de hoy en Guadalajara como AAAA-MM-DD. */
export function hoyISO(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(d);
}
