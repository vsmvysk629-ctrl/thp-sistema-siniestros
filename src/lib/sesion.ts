import { createContext, useContext } from "react"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../api/router"

export type Salidas = inferRouterOutputs<AppRouter>
export type Usuario = NonNullable<Salidas["auth"]["me"]>

type Sesion = { usuario: Usuario; nuevoSiniestro: (contratanteId?: number) => void }
export const SesionContext = createContext<Sesion | null>(null)

export function useSesion() {
  const s = useContext(SesionContext)
  if (!s) throw new Error("Sin sesión")
  return s
}

/** Puede capturar y mover siniestros (ejecutivo o administrador). */
export const esEditor = (u: Usuario) => u.role !== "consulta"
