import { useState } from "react"
import { ESTADO_LABEL, type Tono } from "@contracts/flujo"
import { trpc } from "@/providers/trpc"
import { Badge, Button, Card, ErrorBox, Textarea } from "@/components/ui"
import { errorMsg, fmtFecha } from "@/lib/format"
import { esEditor, useSesion } from "@/lib/sesion"
import type { Exp } from "@/pages/Expediente"
import { useRefrescar } from "./Modales"

type Tipo = Exp["eventos"][number]["tipo"]
const TIPO: Record<Tipo, [string, Tono]> = {
  alta: ["Alta", "blue"],
  estatus: ["Estatus", "blue"],
  nota: ["Nota", "gray"],
  documento: ["Documento", "orange"],
  pago: ["Pago", "green"],
  financiero: ["Financiero", "green"],
  edicion: ["Edición", "gray"],
  accion: ["Próxima acción", "orange"],
  tercero: ["Tercero", "gray"],
}

export function BitacoraTab({ s }: { s: Exp }) {
  const { usuario } = useSesion()
  const refrescar = useRefrescar()
  const [nota, setNota] = useState("")
  const m = trpc.siniestros.agregarNota.useMutation({ onSuccess: () => { setNota(""); refrescar() } })
  return (
    <Card title="Bitácora del siniestro">
      {esEditor(usuario) && (
        <form className="no-print mb-5 space-y-2" onSubmit={(e) => { e.preventDefault(); m.mutate({ id: s.id, nota }) }}>
          <Textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Escribe una nota de seguimiento: llamada, correo, acuerdo con la aseguradora…" />
          <ErrorBox error={m.error && errorMsg(m.error)} />
          <div className="flex justify-end"><Button type="submit" disabled={!nota.trim() || m.isPending}>Agregar nota</Button></div>
        </form>
      )}
      <ol className="relative space-y-5 border-l-2 border-line-soft pl-5">
        {s.eventos.map((e) => {
          const [label, tono] = TIPO[e.tipo]
          return (
            <li key={e.id} className="relative">
              <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-navy-900" />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tono={tono}>{label}</Badge>
                <span className="font-medium">{e.autor ?? "Sistema"}</span>
                <span className="text-ink-600">{fmtFecha(e.createdAt, true)}</span>
              </div>
              {e.estadoNuevo && e.tipo !== "alta" && (
                <p className="mt-1 text-[15px]">
                  {e.estadoAnterior ? `${ESTADO_LABEL[e.estadoAnterior]} → ` : ""}<b>{ESTADO_LABEL[e.estadoNuevo]}</b>
                </p>
              )}
              {e.folio && <p className="mt-0.5 text-sm text-ink-600">Folio / referencia: <span className="font-mono text-ink-900">{e.folio}</span></p>}
              {e.nota && <p className="mt-1 whitespace-pre-line text-[15px]">{e.nota}</p>}
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
