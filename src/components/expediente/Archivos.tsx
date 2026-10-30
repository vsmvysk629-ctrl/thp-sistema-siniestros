import { useRef, useState } from "react"
import { FileText, Paperclip, Trash2 } from "lucide-react"
import { ARCHIVO_ACEPTA, ARCHIVO_MAX_MB, ARCHIVO_TIPOS } from "@contracts/catalogos"
import { trpc } from "@/providers/trpc"
import { errorMsg } from "@/lib/format"
import type { Exp } from "@/pages/Expediente"
import { useRefrescar } from "./Modales"

export type ArchivoItem = Exp["archivos"][number]

/** Algunos navegadores no dan el tipo de .heic o de Office: se deduce de la extensión. */
const POR_EXTENSION: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
const tipoDe = (f: File) => (ARCHIVO_TIPOS[f.type] ? f.type : POR_EXTENSION[f.name.split(".").pop()?.toLowerCase() ?? ""] ?? f.type)

const leerBase64 = (f: File) =>
  new Promise<string>((ok, mal) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result).split(",")[1] ?? "")
    r.onerror = () => mal(new Error("No se pudo leer el archivo."))
    r.readAsDataURL(f)
  })

export const pesoTexto = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

/** Botón que sube uno o varios archivos al siniestro, opcionalmente ligados a un documento. */
export function SubirArchivo({ siniestroId, documentoId, texto = "Subir archivo" }: { siniestroId: number; documentoId?: number; texto?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const refrescar = useRefrescar()
  const subir = trpc.expediente.subirArchivo.useMutation()
  const [error, setError] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)

  async function elegidos(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    setSubiendo(true)
    try {
      for (const f of Array.from(files)) {
        const tipo = tipoDe(f)
        if (!ARCHIVO_TIPOS[tipo]) throw new Error(`${f.name}: formato no aceptado. Sube PDF, foto, Word o Excel.`)
        if (f.size > ARCHIVO_MAX_MB * 1024 * 1024) throw new Error(`${f.name} pesa más de ${ARCHIVO_MAX_MB} MB.`)
        await subir.mutateAsync({ siniestroId, documentoId, nombre: f.name, tipo, base64: await leerBase64(f) })
      }
    } catch (e) {
      setError(errorMsg(e))
    } finally {
      setSubiendo(false)
      if (input.current) input.current.value = ""
      refrescar()
    }
  }

  return (
    <span className="no-print inline-flex flex-col items-end">
      <input ref={input} type="file" multiple accept={ARCHIVO_ACEPTA} className="hidden" onChange={(e) => elegidos(e.target.files)} />
      <button
        type="button"
        disabled={subiendo}
        onClick={() => input.current?.click()}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium text-navy-900 hover:bg-tone-blueBg disabled:opacity-60"
      >
        <Paperclip size={13} /> {subiendo ? "Subiendo…" : texto}
      </button>
      {error && <span role="alert" className="mt-1 max-w-[260px] text-right text-xs text-tone-red">{error}</span>}
    </span>
  )
}

/** Lista de archivos: abrir (o descargar) y quitar. */
export function ListaArchivos({ archivos, puedeEditar }: { archivos: ArchivoItem[]; puedeEditar: boolean }) {
  const utils = trpc.useUtils()
  const refrescar = useRefrescar()
  const borrar = trpc.expediente.borrarArchivo.useMutation({ onSuccess: refrescar })
  const [error, setError] = useState<string | null>(null)
  if (!archivos.length) return null

  async function abrir(a: ArchivoItem) {
    setError(null)
    // La ventana se abre antes de pedir el archivo para que el navegador no la bloquee.
    const verEnLinea = a.tipo === "application/pdf" || (a.tipo.startsWith("image/") && a.tipo !== "image/heic")
    const ventana = verEnLinea ? window.open("", "_blank") : null
    try {
      const r = await utils.expediente.archivo.fetch({ id: a.id })
      const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes], { type: r.tipo }))
      if (ventana) ventana.location.href = url
      else {
        const link = document.createElement("a")
        link.href = url
        link.download = r.nombre
        link.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      ventana?.close()
      setError(errorMsg(e))
    }
  }

  return (
    <div className="mt-1.5">
      <ul className="flex flex-wrap gap-1.5">
        {archivos.map((a) => (
          <li key={a.id} className="inline-flex max-w-full items-center gap-1 rounded-md border border-line-soft bg-white py-0.5 pl-2 pr-1 text-xs">
            <FileText size={12} className="shrink-0 text-ink-600" />
            <button type="button" className="truncate text-navy-900 hover:underline" title={`${a.nombre} · ${pesoTexto(a.tamano)}${a.subidoPor ? ` · ${a.subidoPor}` : ""}`} onClick={() => abrir(a)}>
              {a.nombre}
            </button>
            <span className="shrink-0 text-ink-400">{pesoTexto(a.tamano)}</span>
            {puedeEditar && (
              <button
                type="button"
                aria-label={`Quitar ${a.nombre}`}
                className="no-print shrink-0 rounded p-0.5 text-ink-400 hover:bg-tone-redBg hover:text-tone-red"
                onClick={() => confirm(`¿Quitar el archivo ${a.nombre}?`) && borrar.mutate({ id: a.id })}
              >
                <Trash2 size={12} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {(error || borrar.error) && <p role="alert" className="mt-1 text-xs text-tone-red">{error ?? errorMsg(borrar.error)}</p>}
    </div>
  )
}
