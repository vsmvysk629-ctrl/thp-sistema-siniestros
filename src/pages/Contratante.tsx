import { useState, type FormEvent } from "react"
import { Link, useParams } from "react-router"
import { ArrowLeft } from "lucide-react"
import { RAMOS, RAMO_LABEL, type Ramo } from "@contracts/catalogos"
import { esAbierto } from "@contracts/flujo"
import { trpc } from "@/providers/trpc"
import { Badge, Button, Card, ErrorBox, EstadoBadge, Field, Folio, Input, Kpi, Modal, PageHeader, Select, Tabla } from "@/components/ui"
import { errorMsg, fmtFecha, moneda } from "@/lib/format"
import { esEditor, useSesion } from "@/lib/sesion"
import { ContratanteModal } from "./Contratantes"

export default function Contratante() {
  const id = Number(useParams().id)
  const { usuario, nuevoSiniestro } = useSesion()
  const c = trpc.catalogos.contratante.useQuery({ id })
  const sins = trpc.siniestros.list.useQuery({ contratanteId: id, grupoEstado: "todos" })
  const [editar, setEditar] = useState(false)
  const [poliza, setPoliza] = useState(false)
  if (c.error) return <p className="text-sm text-tone-red">{c.error.message}</p>
  if (!c.data) return <p className="text-sm text-ink-400">Cargando…</p>
  const lista = sins.data ?? []
  const reclamado = lista.reduce((a, r) => a + r.reclamado, 0)
  const pagado = lista.reduce((a, r) => a + r.pagado, 0)
  const editor = esEditor(usuario)
  return (
    <>
      <Link to="/contratantes" className="mb-4 flex items-center gap-1 text-sm font-semibold text-navy-900"><ArrowLeft size={15} /> Contratantes</Link>
      <PageHeader
        titulo={c.data.nombre}
        sub={[c.data.tipoPersona === "moral" ? "Persona moral" : "Persona física", c.data.rfc, c.data.contacto, c.data.telefono, c.data.email].filter(Boolean).join(" · ")}
        acciones={
          editor && (
            <>
              <Button variant="secondary" onClick={() => setEditar(true)}>Editar</Button>
              <Button onClick={() => nuevoSiniestro(id)}>+ Nuevo siniestro</Button>
            </>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Siniestros" valor={lista.length} nota="Histórico" />
        <Kpi label="Abiertos" valor={lista.filter((r) => esAbierto(r.estado)).length} />
        <Kpi label="Reclamado" valor={moneda(reclamado)} />
        <Kpi label="Pagado por aseguradoras" valor={moneda(pagado)} nota={reclamado ? `${Math.round((pagado / reclamado) * 100)}% de lo reclamado` : undefined} />
      </div>

      <Card title="Pólizas" className="mt-5" actions={editor && <Button variant="secondary" onClick={() => setPoliza(true)}>+ Póliza</Button>}>
        <Tabla cols={["Póliza", "Ramo", "Compañía", "Descripción", "Vigencia"]} vacio={!c.data.polizas.length && "Sin pólizas capturadas."}>
          {c.data.polizas.map((p) => (
            <tr key={p.id}>
              <td className="px-2.5 py-3 font-mono text-[13px]">{p.numero}</td>
              <td className="px-2.5 py-3">{RAMO_LABEL[p.ramo]}</td>
              <td className="px-2.5 py-3">{p.aseguradora}</td>
              <td className="px-2.5 py-3 text-ink-600">{p.descripcion ?? "—"}</td>
              <td className="px-2.5 py-3">{p.vigenciaInicio ? `${fmtFecha(p.vigenciaInicio)} – ${fmtFecha(p.vigenciaFin)}` : "—"}</td>
            </tr>
          ))}
        </Tabla>
      </Card>

      <Card title="Historial de siniestros" className="mt-5">
        {!lista.length && <p className="text-sm text-ink-400">Sin siniestros.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {lista.map((r) => (
            <Link key={r.id} to={`/siniestros/${r.id}`} className="rounded-[12px] border border-line p-4 hover:border-line-strong">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Folio>{r.folio}</Folio>
                  <p className="font-semibold">{r.tipo} · {r.afectado}</p>
                </div>
                <EstadoBadge estado={r.estado} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-600">
                <Badge>{RAMO_LABEL[r.ramo]}</Badge>
                <span>{r.aseguradora}</span>·<span>Ocurrió {fmtFecha(r.fechaOcurrido)}</span>·<span>Reclamado {moneda(r.reclamado)}</span>
              </div>
            </Link>
          ))}
        </div>
      </Card>
      {editar && <ContratanteModal inicial={c.data} onClose={() => setEditar(false)} />}
      {poliza && <PolizaModal contratanteId={id} onClose={() => setPoliza(false)} />}
    </>
  )
}

function PolizaModal({ contratanteId, onClose }: { contratanteId: number; onClose: () => void }) {
  const utils = trpc.useUtils()
  const aseguradoras = trpc.catalogos.aseguradoras.useQuery()
  const [f, setF] = useState({ numero: "", aseguradoraId: "", ramo: "autos" as Ramo, descripcion: "", vigenciaInicio: "", vigenciaFin: "" })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const m = trpc.catalogos.crearPoliza.useMutation({ onSuccess: () => { utils.catalogos.invalidate(); onClose() } })
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    m.mutate({ ...f, contratanteId, aseguradoraId: Number(f.aseguradoraId) })
  }
  return (
    <Modal title="Nueva póliza" onClose={onClose}>
      <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
        <Field label="Número de póliza"><Input value={f.numero} onChange={set("numero")} required /></Field>
        <Field label="Compañía">
          <Select value={f.aseguradoraId} onChange={set("aseguradoraId")} required>
            <option value="">Elige…</option>
            {aseguradoras.data?.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </Select>
        </Field>
        <Field label="Ramo">
          <Select value={f.ramo} onChange={set("ramo")}>{RAMOS.map((r) => <option key={r} value={r}>{RAMO_LABEL[r]}</option>)}</Select>
        </Field>
        <Field label="Descripción" hint="Vehículo, plan o bien asegurado."><Input value={f.descripcion} onChange={set("descripcion")} /></Field>
        <Field label="Inicio de vigencia"><Input type="date" value={f.vigenciaInicio} onChange={set("vigenciaInicio")} /></Field>
        <Field label="Fin de vigencia"><Input type="date" value={f.vigenciaFin} onChange={set("vigenciaFin")} /></Field>
        <div className="sm:col-span-2"><ErrorBox error={m.error && errorMsg(m.error)} /></div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={m.isPending}>Guardar</Button>
        </div>
      </form>
    </Modal>
  )
}
