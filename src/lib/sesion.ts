import { createContext, useContext } from "react"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../api/router"

export type Salidas = inferRouterOutputs<AppRouter>
export type Usuario = NonNullable<Salidas["auth"]["me"]>

/** "mios": tablero, bandeja y alertas muestran solo lo que está a cargo del usuario. */
export type Vista = "mios" | "todos"
type Sesion = { usuario: Usuario; nuevoSiniestro: (contratanteId?: number) => void; vista: Vista; setVista: (v: Vista) => void }
export const SesionContext = createContext<Sesion | null>(null)

export function useSesion() {
  const s = useContext(SesionContext)
  if (!s) throw new Error("Sin sesión")
  return s
}

/** Puede capturar y mover siniestros (ejecutivo o administrador). */
export const esEditor = (u: Usuario) => u.role !== "consulta"

/** Preferencias por usuario guardadas en este navegador. Si el navegador no deja guardar, no pasa nada. */
export function leerPreferencia<T>(clave: string, porDefecto: T): T {
  try {
    const v = localStorage.getItem(clave)
    return v === null ? porDefecto : (JSON.parse(v) as T)
  } catch {
    return porDefecto
  }
}
export function guardarPreferencia(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor))
  } catch {
    /* sin almacenamiento: se usa el valor por defecto */
  }
}
