// Arranque de la demo: crea la base en el navegador, carga los datos ficticios y la guarda en este navegador.
import type { Database } from "sql.js"
// Versión en JavaScript puro (sin WebAssembly): funciona en cualquier página, sin descargar nada.
import initSqlJs from "sql.js/dist/sql-asm.js"
import { crearTablas, iniciarConexion } from "../api/queries/connection"

const CLAVE_DB = "thp-demo-db-v1"
const CLAVE_SESION = "thp-demo-sesion-v1"
let db: Database
let sesion = ""

const leer = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const escribir = (k: string, v: string | null) => {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* sin almacenamiento */ }
}

let pendiente: ReturnType<typeof setTimeout> | undefined
function guardarDb() {
  clearTimeout(pendiente)
  pendiente = setTimeout(() => {
    const bytes = db.export()
    let s = ""
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    escribir(CLAVE_DB, btoa(s))
  }, 300)
}

const oyentes = new Set<() => void>()
export const leerSesion = () => sesion
export function guardarSesion(c: string) {
  sesion = c
  escribir(CLAVE_SESION, c || null)
  oyentes.forEach((f) => f())
}
/** Avisa cuando alguien entra o sale. */
export function alCambiarSesion(f: () => void) {
  oyentes.add(f)
  return () => void oyentes.delete(f)
}

export async function iniciarDemo() {
  const SQL = await initSqlJs()
  const guardada = leer(CLAVE_DB)
  if (guardada) {
    db = new SQL.Database(Uint8Array.from(atob(guardada), (c) => c.charCodeAt(0)))
    iniciarConexion(db, guardarDb)
    sesion = leer(CLAVE_SESION) ?? ""
    return
  }
  db = new SQL.Database()
  crearTablas(db)
  iniciarConexion(db, guardarDb)
  const { sembrarDatosDemo } = await import("../db/datos-demo")
  await sembrarDatosDemo()
  guardarSesion("")
  guardarDb()
}

/** Borra los cambios y vuelve a los datos de ejemplo. */
export function reiniciarDemo() {
  escribir(CLAVE_DB, null)
  escribir(CLAVE_SESION, null)
  location.reload()
}
