import { useState } from "react"
import clsx from "clsx"
import { DOC_ESTADOS, DOC_FALTANTE, DOC_LABEL, type DocEstado } from "@contracts/catalogos"
import type { Tono } from "@contracts/flujo"
import { trpc } from "@/providers/trpc"
import { Badge, Barra, Button, Card, ErrorBox, Input } from "@/components/ui"
import { TONO_CLASE, errorMsg } from "@/lib/format"
import type { Exp } from "@/pages/Expediente"
import { useRefrescar } from "./Modales"

const DOC_TONO: Record<DocEstado, Tono> = { pendiente: "gray", recibido: "blue", en_revision: "orange", validado: "green", correccion: "red" }

export function DocumentosTab({ s }: { s: Exp }) {
  const refrescar = useRefrescar()
  const [nuevo, setNuevo] = useState("")
  const cambiar = trpc.expediente.documentoEstado.useMutation({ onSuccess: refrescar })
  const agregar = trpc.expediente.agregarDocumento.useMutation({ onSuccess: () => { setNuevo(""); refrescar() } })
  const total = s.documentos.length
  const listos = s.documentos.filter((d) => d.estado === "validado").length
  const faltan = s.documentos.filter((d) => DOC_FALTANTE.includes(d.estado)).length
  const pct = total ? Math.round((listos / total) * 100) : 0
  return (
    <Card title="Checklist de documentación" actions={<span className="text-sm text-ink-600">{listos} de {total} validados · {faltan} faltante{faltan === 1 ? "" : "s"}</span>}>
      <div className="mb-4"><Barra pct={pct} className="bg-thp" /></div>
      <ul className="divide-y divide-line-soft border-t border-line-soft">
        {s.documentos.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className={clsx("h-1.5 w-1.5 rounded-full", DOC_FALTANTE.includes(d.estado) ? "bg-sev-media" : "bg-[#2F9E68]")} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px]">{d.nombre}</p>
              {d.nota && <p className="text-xs text-ink-600">{d.nota}</p>}
            </div>
            {s.puedeEditar ? (
              <select
                value={d.estado}
                disabled={cambiar.isPending}
                onChange={(e) => {
                  const estado = e.target.value as DocEstado
                  const nota = estado === "correccion" ? prompt("¿Qué hay que corregir?") : null
                  if (estado === "correccion" && nota === null) return
                  cambiar.mutate({ id: d.id, estado, nota })
                }}
                className={clsx("no-print rounded-full border-0 px-3 py-1 text-xs font-medium", TONO_CLASE[DOC_TONO[d.estado]])}
              >
                {DOC_ESTADOS.map((e) => <option key={e} value={e}>{DOC_LABEL[e]}</option>)}
              </select>
            ) : null}
            <Badge tono={DOC_TONO[d.estado]} className={clsx(s.puedeEditar && "hidden print:inline-flex")}>{DOC_LABEL[d.estado]}</Badge>
          </li>
        ))}
      </ul>
      <ErrorBox error={cambiar.error && errorMsg(cambiar.error)} />
      {s.puedeEditar && (
        <form className="no-print mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); agregar.mutate({ siniestroId: s.id, nombre: nuevo }) }}>
          <Input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Pedir otro documento (p. ej. Carta de no adeudo)" />
          <Button type="submit" variant="secondary" disabled={!nuevo.trim() || agregar.isPending}>Agregar</Button>
        </form>
      )}
      <p className="no-print mt-3 text-xs text-ink-400">La carga y descarga de archivos llega en la siguiente sub-etapa (1B). Por ahora se lleva el control de qué se recibió y validó.</p>
    </Card>
  )
}
