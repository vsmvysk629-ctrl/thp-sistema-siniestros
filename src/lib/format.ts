import type { Tono } from "@contracts/flujo"

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

function aFecha(v: string | Date) {
  if (v instanceof Date) return v
  // "2026-10-20" se interpreta como fecha local, no UTC.
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v.replace(" ", "T"))
}

/** "2026-10-20" o Date → "20 oct 2026". */
export function fmtFecha(v: string | Date | null | undefined, conHora = false) {
  if (!v) return "—"
  const d = aFecha(v)
  if (Number.isNaN(d.getTime())) return "—"
  const base = `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
  if (!conHora) return base
  return `${base}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function fechaLarga(d = new Date()) {
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES_LARGO[d.getMonth()]} de ${d.getFullYear()}`
}

export function saludo(d = new Date()) {
  const h = d.getHours()
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"
}

/** Fecha de hoy (Ciudad de México) en formato ISO, para comparar con fechas compromiso. */
export function hoyISO(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" })
}
export const sumarDias = (n: number) => hoyISO(new Date(Date.now() + n * 86_400_000))

export function moneda(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === "") return "—"
  return Number(v).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: Number(v) % 1 ? 2 : 0 })
}

/** $2.74 M para indicadores grandes. */
export function monedaCorta(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)} M`
  return moneda(v)
}

export const TONO_CLASE: Record<Tono, string> = {
  blue: "bg-tone-blueBg text-tone-blue",
  orange: "bg-tone-orangeBg text-tone-orange",
  green: "bg-tone-greenBg text-tone-green",
  gray: "bg-tone-grayBg text-tone-gray",
  red: "bg-tone-redBg text-tone-red",
}

export function iniciales(nombre: string | null | undefined) {
  if (!nombre) return "—"
  const p = nombre.trim().split(/\s+/)
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? p[0]?.[1] ?? "")).toUpperCase()
}

/** Primer nombre, como lo muestra el prototipo en listas. */
export const corto = (nombre: string | null | undefined) => nombre?.split(" ")[0] ?? "—"

export const errorMsg = (e: unknown) => (e instanceof Error ? e.message : "Ocurrió un error.")

/** Descarga un CSV que Excel abre con acentos (UTF-8 con BOM). */
export function descargarCSV(nombre: string, encabezados: string[], filas: (string | number | null | undefined)[][]) {
  const celda = (v: string | number | null | undefined) => {
    const t = v === null || v === undefined ? "" : String(v)
    return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const csv = [encabezados, ...filas].map((f) => f.map(celda).join(",")).join("\r\n")
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = `${nombre}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** Días naturales entre dos fechas ISO. */
export function diasEntre(desde: string, hasta: string) {
  return Math.max(0, Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000))
}
