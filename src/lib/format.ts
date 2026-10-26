import type { Estado } from "@contracts/flujo"

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

/** "2026-10-20 14:30:00" o Date → "20 oct 2026". */
export function fmtFecha(v: string | Date | null | undefined, conHora = false) {
  if (!v) return "—"
  const d = typeof v === "string" ? new Date(v.replace(" ", "T")) : v
  if (Number.isNaN(d.getTime())) return "—"
  const base = `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
  if (!conHora) return base
  return `${base}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function diasDesde(v: string | Date | null | undefined) {
  if (!v) return 0
  const d = typeof v === "string" ? new Date(v.replace(" ", "T")) : v
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000))
}

export function moneda(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === "") return "—"
  return Number(v).toLocaleString("es-MX", { style: "currency", currency: "MXN" })
}

export function colorEstado(e: Estado) {
  if (e === "cerrado") return "bg-slate-100 text-slate-600"
  if (e === "rechazado" || e === "cancelado") return "bg-red-50 text-red-700"
  if (e === "pago_confirmado" || e === "entregado") return "bg-emerald-50 text-emerald-700"
  if (e === "perdida_total" || e === "documentos_indemnizacion" || e === "finiquito") return "bg-amber-50 text-amber-800"
  return "bg-brand-100 text-brand-700"
}

/** Días sin movimiento a partir de los cuales un siniestro abierto se marca como atorado (Etapa 1C lo hará configurable). */
export const DIAS_ATORADO = 7

export const errorMsg = (e: unknown) => (e instanceof Error ? e.message : "Ocurrió un error.")
