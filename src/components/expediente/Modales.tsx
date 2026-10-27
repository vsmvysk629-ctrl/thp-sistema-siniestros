import { useState, type FormEvent } from "react"
import { ESTADO_LABEL, TRANSICIONES, type Estado } from "@contracts/flujo"
import { trpc } from "@/providers/trpc"
import { Button, ErrorBox, Field, Input, Modal, Select, Textarea } from "@/components/ui"
import { errorMsg, hoyISO, sumarDias } from "@/lib/format"
import type { Exp } from "@/pages/Expediente"

/** Invalida todo lo que depende de un siniestro tras un cambio. */
export function useRefrescar() {
  const utils = trpc.useUtils()
  return () => {
    utils.siniestros.invalidate()
    utils.tablero.invalidate()
    utils.catalogos.contratantes.invalidate()
  }
}

const NOTA_OBLIGATORIA: Partial<Record<Estado, string>> = {
  info_adicional: "¿Qué información pide la aseguradora?",
  rechazado: "Motivo del rechazo",
  cerrado: "Motivo del cierre",
}

export function CambiarEstatus({ s, onClose }: { s: Exp; onClose: () => void }) {
  const refrescar = useRefrescar()
  const opciones = TRANSICIONES[s.estado]
  const [destino, setDestino] = useState<Estado | "">(opciones[0] ?? "")
  const [folio, setFolio] = useState("")
  const [monto, setMonto] = useState("")
  const [nota, setNota] = useState("")
  const [accion, setAccion] = useState("")
  const [compromiso, setCompromiso] = useState(sumarDias(3))
  const m = trpc.siniestros.cambiarEstado.useMutation({ onSuccess: () => { refrescar(); onClose() } })
  const notaLabel = destino && (destino !== "cerrado" || s.estado !== "pagado") ? NOTA_OBLIGATORIA[destino] : undefined
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (!destino) return
    m.mutate({ id: s.id, destino, folio, nota, montoAutorizado: monto, proximaAccion: accion || null, fechaCompromiso: accion ? compromiso : null })
  }
  return (
    <Modal title="Cambiar estatus" onClose={onClose}>
      <form onSubmit={enviar} className="space-y-3">
        <p className="text-sm text-ink-600">Estatus actual: <b className="text-ink-900">{ESTADO_LABEL[s.estado]}</b></p>
        {(s.estado === "autorizado" || s.estado === "pago_parcial") && (
          <p className="rounded-[10px] bg-tone-blueBg px-3 py-2 text-sm text-tone-blue">Los pagos se registran en la pestaña Financiero, con la referencia de la aseguradora. El estatus cambia solo a Pago parcial o Pagado.</p>
        )}
        {opciones.length === 0 ? (
          <p className="text-sm text-ink-600">No hay cambios de estatus manuales desde aquí.</p>
        ) : (
          <>
            <Field label="Nuevo estatus">
              <Select value={destino} onChange={(e) => setDestino(e.target.value as Estado)}>
                {opciones.map((o) => <option key={o} value={o}>{ESTADO_LABEL[o]}</option>)}
              </Select>
            </Field>
            {destino === "ingresado" && !s.numeroSiniestro && (
              <Field label="Número de siniestro o folio de ingreso" hint="El que dio la aseguradora al recibir el trámite.">
                <Input value={folio} onChange={(e) => setFolio(e.target.value)} required />
              </Field>
            )}
            {destino === "autorizado" && (
              <>
                <Field label="Folio del dictamen o referencia de autorización" hint="Solo con confirmación de la aseguradora.">
                  <Input value={folio} onChange={(e) => setFolio(e.target.value)} required />
                </Field>
                <Field label="Monto autorizado por la aseguradora"><Input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" required /></Field>
              </>
            )}
            <Field label={notaLabel ?? "Nota (opcional)"}>
              <Textarea rows={3} value={nota} onChange={(e) => setNota(e.target.value)} required={!!notaLabel} />
            </Field>
            {destino !== "cerrado" && (
              <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                <Field label="Próxima acción (opcional)"><Input value={accion} onChange={(e) => setAccion(e.target.value)} placeholder={s.proximaAccion ?? ""} /></Field>
                <Field label="Compromiso"><Input type="date" value={compromiso} min={hoyISO()} onChange={(e) => setCompromiso(e.target.value)} disabled={!accion} /></Field>
              </div>
            )}
          </>
        )}
        <ErrorBox error={m.error && errorMsg(m.error)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          {opciones.length > 0 && <Button type="submit" disabled={m.isPending}>Guardar estatus</Button>}
        </div>
      </form>
    </Modal>
  )
}

export function ProximaAccion({ s, onClose }: { s: Exp; onClose: () => void }) {
  const refrescar = useRefrescar()
  const [accion, setAccion] = useState(s.proximaAccion ?? "")
  const [fecha, setFecha] = useState(s.fechaCompromiso ?? sumarDias(2))
  const m = trpc.siniestros.accion.useMutation({ onSuccess: () => { refrescar(); onClose() } })
  return (
    <Modal title="Próxima acción" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); m.mutate({ id: s.id, proximaAccion: accion, fechaCompromiso: fecha || null }) }} className="space-y-3">
        <Field label="¿Qué sigue?"><Textarea rows={2} value={accion} onChange={(e) => setAccion(e.target.value)} required /></Field>
        <Field label="Fecha compromiso"><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
        <ErrorBox error={m.error && errorMsg(m.error)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={m.isPending}>Guardar</Button>
        </div>
      </form>
    </Modal>
  )
}
