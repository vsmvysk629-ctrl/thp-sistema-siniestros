import { useState } from "react"
import { leerSesion, reiniciarDemo } from "./db"

const USUARIOS = [
  ["admin", "Administrador"],
  ["laura", "Ejecutiva"],
  ["oscar", "Ejecutivo"],
  ["marta", "Ejecutiva GMM"],
  ["consulta", "Solo consulta"],
] as const
const PASSWORD = "Demo2026demo"

/** Llena el formulario de entrada (si está en pantalla) y entra. */
function entrar(usuario: string) {
  const campos = document.querySelectorAll<HTMLInputElement>("form input")
  if (campos.length < 2) return
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
  for (const [campo, valor] of [[campos[0], usuario], [campos[1], PASSWORD]] as const) {
    set.call(campo, valor)
    campo.dispatchEvent(new Event("input", { bubbles: true }))
  }
  setTimeout(() => campos[0].form?.requestSubmit(), 0)
}

/** Aviso fijo de la demo con los usuarios de prueba. */
export function Accesos() {
  const [abierto, setAbierto] = useState(!leerSesion())
  return (
    <div className="no-print fixed bottom-3 right-3 z-40 w-[260px] rounded-card border border-line bg-surface/95 text-[12px] text-ink-600 shadow-flota backdrop-blur">
      <div className="flex items-center justify-between gap-2 py-1.5 pl-3 pr-1.5">
        <button onClick={() => setAbierto(!abierto)} className="flex items-center gap-1.5 font-medium text-ink-900">
          <span className="h-1.5 w-1.5 rounded-full bg-thp" /> Demo · datos ficticios
        </button>
        <button onClick={reiniciarDemo} className="rounded-full px-2.5 py-1 text-ink-600 hover:bg-subtle hover:text-ink-900" title="Borra los cambios y vuelve a los datos de ejemplo">
          Reiniciar
        </button>
      </div>
      {abierto && (
        <div className="border-t border-line-soft px-3 pb-3 pt-2">
          <p className="mb-1.5">Toca un usuario para entrar (contraseña <span className="font-mono text-ink-900">{PASSWORD}</span>):</p>
          <div className="grid grid-cols-1 gap-0.5">
            {USUARIOS.map(([u, rol]) => (
              <button key={u} onClick={() => { entrar(u); setAbierto(false) }} className="flex justify-between rounded-[8px] px-2 py-1 text-left hover:bg-subtle">
                <span className="font-mono text-ink-900">{u}</span>
                <span className="text-ink-400">{rol}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-ink-400">Los cambios se guardan solo en este navegador.</p>
          <button onClick={() => setAbierto(false)} className="mt-1 text-thp hover:underline">Ocultar</button>
        </div>
      )}
    </div>
  )
}
