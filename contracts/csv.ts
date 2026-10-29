/**
 * Celda de CSV. Un texto que empieza con = + - @ se antepone con ' para que Excel no lo ejecute
 * como fórmula (alguien podría capturar "=HYPERLINK(...)" como nombre de cliente).
 */
export function celdaCSV(v: string | number | null | undefined) {
  let t = v === null || v === undefined ? "" : String(v)
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(t)) t = "'" + t
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}
