import { useState, type FormEvent } from "react"
import { DICTAMENES, DICTAMEN_LABEL, type Dictamen } from "@contracts/catalogos"
import { ESTADOS_PAGO, type Tono } from "@contracts/flujo"
import { trpc } from "@/providers/trpc"
import { Badge, Button, Card, ErrorBox, Field, Input, Kpi, Modal, Select, Tabla } from "@/components/ui"
import { errorMsg, fmtFecha, hoyISO, moneda } from "@/lib/format"
import type { Exp } from "@/pages/Expediente"
import { useRefrescar } from "./Modales"

const DICT_TONO: Record<Dictamen, Tono> = { pendiente: "gray", procedente: "green", parcial: "orange", no_procedente: "red", por_corregir: "red" }
const FORMA_LABEL = { transferencia: "transferencia", cheque: "cheque", pago_directo: "pago directo", otro: "otro" } as const
type Concepto = Exp["conceptos"][number]

export function FinancieroTab({ s }: { s: Exp }) {
  const refrescar = useRefrescar()
  const [concepto, setConcepto] = useState<Concepto | "nuevo" | null>(null)
  const [pago, setPago] = useState(false)
  const quitar = trpc.expediente.quitarConcepto.useMutation({ onSuccess: refrescar })
  const n = (v: string | null) => Number(v ?? 0)
  const autorizado = s.autorizado === null ? null : n(s.autorizado)
  const saldo = autorizado === null ? null : autorizado - s.pagado
  const barras = [
    { label: "Gastado por el asegurado", v: n(s.gastado), color: "bg-ink-400" },
    { label: "Reclamado", v: n(s.reclamado), color: "bg-navy-900" },
    { label: "Autorizado", v: autorizado ?? 0, color: "bg-thp" },
    { label: "Pagado", v: s.pagado, color: "bg-[#2F9E68]" },
  ]
  const max = Math.max(1, ...barras.map((b) => b.v))
  const puedePagar = s.puedeEditar && ESTADOS_PAGO.includes(s.estado)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Kpi label="Gastado por el asegurado" valor={moneda(n(s.gastado))} />
        <Kpi label="Reclamado a la aseguradora" valor={moneda(n(s.reclamado))} />
        <Kpi label="Gastos no procedentes" valor={moneda(n(s.noProcedente))} />
        <Kpi label="Deducible aplicado" valor={moneda(n(s.deducible))} />
        <Kpi label="Coaseguro aplicado" valor={moneda(n(s.coaseguro))} />
        <Kpi label="Autorizado por la aseguradora" valor={autorizado === null ? "—" : moneda(autorizado)} nota={autorizado === null ? "Sin autorización aún" : undefined} />
        <Kpi label="Pagado a la fecha" valor={moneda(s.pagado)} />
        <Kpi label="Saldo pendiente" valor={saldo === null ? "—" : moneda(saldo)} />
      </div>

      <Card title="Gastado vs reclamado vs autorizado vs pagado">
        <div className="space-y-2.5">
          {barras.map((b) => (
            <div key={b.label} className="grid grid-cols-[150px_1fr_100px] items-center gap-3 text-sm sm:grid-cols-[190px_1fr_110px]">
              <span>{b.label}</span>
              <div className="h-1.5 rounded-full bg-line-soft"><div className={`h-1.5 rounded-full ${b.color}`} style={{ width: `${(b.v / max) * 100}%` }} /></div>
              <span className="text-right font-medium tabular-nums">{moneda(b.v)}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Facturas y conceptos reclamados" actions={s.puedeEditar && <Button variant="secondary" className="no-print" onClick={() => setConcepto("nuevo")}>+ Concepto</Button>}>
          <Tabla cols={["Concepto", <span key="i" className="block text-right">Importe</span>, <span key="n" className="block text-right">No procedente</span>, "Dictamen", ""]} vacio={!s.conceptos.length && "Sin conceptos. El reclamado se captura en Editar datos o se suma de aquí."}>
            {s.conceptos.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-3.5">{c.concepto}</td>
                <td className="px-3 py-3.5 text-right">{moneda(c.importe)}</td>
                <td className="px-3 py-3.5 text-right">{moneda(c.noProcedente)}</td>
                <td className="px-3 py-3.5"><Badge tono={DICT_TONO[c.dictamen]}>{DICTAMEN_LABEL[c.dictamen]}</Badge></td>
                <td className="no-print whitespace-nowrap px-2.5 py-3 text-right text-xs">
                  {s.puedeEditar && (
                    <>
                      <button className="text-navy-900 hover:underline" onClick={() => setConcepto(c)}>Editar</button>
                      <button className="ml-3 text-tone-red hover:underline" onClick={() => confirm(`¿Quitar "${c.concepto}"?`) && quitar.mutate({ id: c.id })}>Quitar</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </Tabla>
        </Card>
        <Card title="Pagos de la aseguradora" actions={puedePagar && <Button variant="secondary" className="no-print" onClick={() => setPago(true)}>+ Registrar pago</Button>}>
          {!s.pagos.length && (
            <p className="py-3 text-sm text-ink-400">
              {ESTADOS_PAGO.includes(s.estado) ? "Sin pagos registrados." : "Los pagos se registran cuando la aseguradora autoriza el siniestro."}
            </p>
          )}
          <ul className="divide-y divide-line-soft">
            {s.pagos.map((p, i) => (
              <li key={p.id} className="flex justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">Pago {i + 1} · {p.concepto}</p>
                  <p className="text-ink-600">{fmtFecha(p.fecha)} · {FORMA_LABEL[p.forma]} · Ref. {p.referencia}</p>
                </div>
                <span className="font-medium">{moneda(p.monto)}</span>
              </li>
            ))}
          </ul>
          {saldo !== null && (
            <div className="mt-2 flex justify-between border-t border-line-soft pt-3 text-sm font-medium text-tone-orange">
              <span>Saldo pendiente</span><span>{moneda(saldo)}</span>
            </div>
          )}
        </Card>
      </div>
      {concepto && <ConceptoModal s={s} c={concepto === "nuevo" ? null : concepto} onClose={() => setConcepto(null)} />}
      {pago && <PagoModal s={s} saldo={saldo ?? 0} onClose={() => setPago(false)} />}
    </div>
  )
}

function ConceptoModal({ s, c, onClose }: { s: Exp; c: Concepto | null; onClose: () => void }) {
  const refrescar = useRefrescar()
  const [f, setF] = useState({ concepto: c?.concepto ?? "", importe: c?.importe ?? "", noProcedente: c?.noProcedente ?? "0", dictamen: (c?.dictamen ?? "pendiente") as Dictamen })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const m = trpc.expediente.guardarConcepto.useMutation({ onSuccess: () => { refrescar(); onClose() } })
  return (
    <Modal title={c ? "Editar concepto" : "Agregar factura o concepto"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); m.mutate({ id: c?.id, siniestroId: s.id, ...f }) }} className="grid gap-3 sm:grid-cols-2">
        <Field label="Concepto" className="sm:col-span-2"><Input value={f.concepto} onChange={set("concepto")} placeholder="Ej. Hospital · cuenta hospitalaria" required /></Field>
        <Field label="Importe"><Input inputMode="decimal" value={f.importe} onChange={set("importe")} required /></Field>
        <Field label="No procedente"><Input inputMode="decimal" value={f.noProcedente} onChange={set("noProcedente")} /></Field>
        <Field label="Dictamen de la aseguradora" className="sm:col-span-2">
          <Select value={f.dictamen} onChange={set("dictamen")}>{DICTAMENES.map((d) => <option key={d} value={d}>{DICTAMEN_LABEL[d]}</option>)}</Select>
        </Field>
        <div className="sm:col-span-2"><ErrorBox error={m.error && errorMsg(m.error)} /></div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={m.isPending}>Guardar</Button>
        </div>
      </form>
    </Modal>
  )
}

function PagoModal({ s, saldo, onClose }: { s: Exp; saldo: number; onClose: () => void }) {
  const refrescar = useRefrescar()
  const [f, setF] = useState({ concepto: s.pagos.length ? "Pago complementario" : "Pago de indemnización", fecha: hoyISO(), monto: String(saldo), forma: "transferencia" as keyof typeof FORMA_LABEL, referencia: "" })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const m = trpc.expediente.registrarPago.useMutation({ onSuccess: () => { refrescar(); onClose() } })
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    m.mutate({ siniestroId: s.id, ...f })
  }
  return (
    <Modal title="Registrar pago de la aseguradora" onClose={onClose}>
      <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
        <p className="rounded-[10px] bg-tone-blueBg px-3 py-2 text-sm text-tone-blue sm:col-span-2">
          Registra solo pagos confirmados por la aseguradora, con su referencia. Saldo autorizado por pagar: <b>{moneda(saldo)}</b>.
        </p>
        <Field label="Concepto" className="sm:col-span-2"><Input value={f.concepto} onChange={set("concepto")} required /></Field>
        <Field label="Monto"><Input inputMode="decimal" value={f.monto} onChange={set("monto")} required /></Field>
        <Field label="Fecha del pago"><Input type="date" max={hoyISO()} value={f.fecha} onChange={set("fecha")} required /></Field>
        <Field label="Forma">
          <Select value={f.forma} onChange={set("forma")}>{Object.entries(FORMA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        </Field>
        <Field label="Referencia" hint="Transferencia, cheque u oficio."><Input value={f.referencia} onChange={set("referencia")} required /></Field>
        <div className="sm:col-span-2"><ErrorBox error={m.error && errorMsg(m.error)} /></div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={m.isPending}>Registrar pago</Button>
        </div>
      </form>
    </Modal>
  )
}
