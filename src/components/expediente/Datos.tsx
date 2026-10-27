import { useState, type FormEvent } from "react"
import { Link } from "react-router"
import { RAMO_LABEL, RESPONSABILIDADES, RESPONSABILIDAD_LABEL, TIPOS, esAutos, type Responsabilidad } from "@contracts/catalogos"
import { ESTADO_LABEL } from "@contracts/flujo"
import { trpc } from "@/providers/trpc"
import { Button, Card, Dato, ErrorBox, EstadoBadge, Field, Folio, Input, Modal, Select, Textarea } from "@/components/ui"
import { errorMsg, fmtFecha, hoyISO, moneda } from "@/lib/format"
import { useSesion } from "@/lib/sesion"
import type { Exp } from "@/pages/Expediente"
import { useRefrescar } from "./Modales"

export function DatosTab({ s }: { s: Exp }) {
  const [editar, setEditar] = useState(false)
  const [tercero, setTercero] = useState(false)
  const autos = esAutos(s.ramo)
  const refrescar = useRefrescar()
  const quitar = trpc.siniestros.quitarTercero.useMutation({ onSuccess: refrescar })
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <Card actions={s.puedeEditar && <Button variant="secondary" className="no-print" onClick={() => setEditar(true)}>Editar datos</Button>} title="Datos del siniestro">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Dato label="Folio interno THP">{s.folio}</Dato>
            <Dato label="Contratante">{s.contratante.nombre}</Dato>
            <Dato label="Asegurado / afectado">{s.afectado}</Dato>
            <Dato label="Ramo y tipo">{RAMO_LABEL[s.ramo]} · {s.tipo}</Dato>
            <Dato label="Compañía">{s.aseguradora.nombre}</Dato>
            <Dato label="Póliza">{s.poliza?.numero ?? s.polizaTexto}</Dato>
            <Dato label="Vigencia de la póliza">{s.poliza?.vigenciaInicio ? `${fmtFecha(s.poliza.vigenciaInicio)} – ${fmtFecha(s.poliza.vigenciaFin)}` : null}</Dato>
            <Dato label="No. de siniestro aseguradora">{s.numeroSiniestro}</Dato>
            <Dato label="Fecha de ocurrencia">{fmtFecha(s.fechaOcurrido)}</Dato>
            <Dato label="Fecha de reporte">{fmtFecha(s.fechaReporte)}</Dato>
            <Dato label="Fecha de ingreso del trámite">{s.fechaIngreso && fmtFecha(s.fechaIngreso)}</Dato>
            <Dato label="Ejecutivo responsable">{s.ejecutivo?.nombre}</Dato>
            <Dato label="Estatus actual">{ESTADO_LABEL[s.estado]}</Dato>
            <Dato label="Monto reclamado">{moneda(s.reclamado)}</Dato>
          </dl>
          {s.descripcion && (
            <div className="mt-5 border-t border-line-soft pt-4">
              <p className="text-[13px] font-medium text-ink-600">Descripción de lo ocurrido</p>
              <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{s.descripcion}</p>
            </div>
          )}
        </Card>
        {autos && (
          <Card title="Datos del siniestro de autos">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <Dato label="No. de reporte en cabina">{s.numeroReporte}</Dato>
              <Dato label="Lugar">{s.lugar}</Dato>
              <Dato label="Conductor">{s.conductorNombre}</Dato>
              <Dato label="Ajustador">{s.ajustadorNombre}</Dato>
              <Dato label="Teléfono del ajustador">{s.ajustadorTelefono}</Dato>
              <Dato label="Taller o agencia">{s.tallerNombre}</Dato>
              <Dato label="Responsabilidad">{RESPONSABILIDAD_LABEL[s.responsabilidad]}</Dato>
              <Dato label="Deducible">{moneda(s.deducible)}</Dato>
            </dl>
          </Card>
        )}
        {(autos || s.ramo === "rc" || s.terceros.length > 0) && (
          <Card title="Terceros involucrados" actions={s.puedeEditar && <Button variant="secondary" className="no-print" onClick={() => setTercero(true)}>+ Tercero</Button>}>
            {s.terceros.length === 0 && <p className="text-sm text-ink-400">Sin terceros registrados.</p>}
            <ul className="divide-y divide-line-soft">
              {s.terceros.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{t.nombre}</p>
                    <p className="text-ink-600">{[t.vehiculo, t.placas, t.aseguradora, t.telefono].filter(Boolean).join(" · ") || "—"}</p>
                    {t.notas && <p className="text-ink-600">{t.notas}</p>}
                  </div>
                  {s.puedeEditar && <button className="no-print text-xs text-tone-red hover:underline" onClick={() => confirm(`¿Quitar a ${t.nombre}?`) && quitar.mutate({ id: t.id })}>Quitar</button>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      <Card className="h-fit print:hidden">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-600">Contratante</p>
        <p className="mt-2 text-lg font-semibold">{s.contratante.nombre}</p>
        <p className="text-sm text-ink-600">{[s.contratante.telefono, s.contratante.email].filter(Boolean).join(" · ")}</p>
        <Link to={`/contratantes/${s.contratante.id}`} className="mt-3 inline-block rounded-[10px] border border-line-strong px-3.5 py-2 text-sm font-semibold hover:bg-subtle">Ver perfil completo</Link>
        <p className="mt-5 border-t border-line-soft pt-4 text-[13px] font-semibold uppercase tracking-wide text-ink-600">Otros siniestros del contratante</p>
        {s.otros.length === 0 && <p className="mt-2 text-sm text-ink-400">Ninguno.</p>}
        <ul className="mt-2 space-y-3">
          {s.otros.map((o) => (
            <li key={o.id}>
              <Link to={`/siniestros/${o.id}`} className="flex items-center justify-between gap-2">
                <span><Folio>{o.folio}</Folio><span className="block text-sm text-ink-600">{RAMO_LABEL[o.ramo]} · {o.tipo}</span></span>
                <EstadoBadge estado={o.estado} />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      {editar && <EditarDatos s={s} onClose={() => setEditar(false)} />}
      {tercero && <NuevoTercero s={s} onClose={() => setTercero(false)} />}
    </div>
  )
}

function EditarDatos({ s, onClose }: { s: Exp; onClose: () => void }) {
  const { usuario } = useSesion()
  const refrescar = useRefrescar()
  const usuarios = trpc.catalogos.usuarios.useQuery()
  const autos = esAutos(s.ramo)
  const conConceptos = s.conceptos.length > 0
  const [f, setF] = useState({
    afectado: s.afectado, tipo: s.tipo, descripcion: s.descripcion ?? "", fechaOcurrido: s.fechaOcurrido, fechaReporte: s.fechaReporte,
    numeroSiniestro: s.numeroSiniestro ?? "", polizaTexto: s.polizaTexto ?? "", gastado: s.gastado ?? "", reclamado: s.reclamado ?? "",
    deducible: s.deducible ?? "", coaseguro: s.coaseguro ?? "", numeroReporte: s.numeroReporte ?? "", ajustadorNombre: s.ajustadorNombre ?? "",
    ajustadorTelefono: s.ajustadorTelefono ?? "", tallerNombre: s.tallerNombre ?? "", lugar: s.lugar ?? "", conductorNombre: s.conductorNombre ?? "",
    responsabilidad: s.responsabilidad as Responsabilidad, ejecutivoId: String(s.ejecutivoId),
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const m = trpc.siniestros.actualizar.useMutation({ onSuccess: () => { refrescar(); onClose() } })
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const { reclamado, ...resto } = f
    m.mutate({ id: s.id, datos: { ...resto, ...(conConceptos ? {} : { reclamado }), ejecutivoId: Number(f.ejecutivoId) } })
  }
  return (
    <Modal title="Editar datos del siniestro" onClose={onClose} ancho="max-w-3xl">
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Asegurado / afectado" className="sm:col-span-2"><Input value={f.afectado} onChange={set("afectado")} required /></Field>
          <Field label="Tipo">
            <Select value={f.tipo} onChange={set("tipo")}>{[...new Set([f.tipo, ...TIPOS[s.ramo]])].map((t) => <option key={t}>{t}</option>)}</Select>
          </Field>
          <Field label="Fecha de ocurrencia"><Input type="date" max={hoyISO()} value={f.fechaOcurrido} onChange={set("fechaOcurrido")} required /></Field>
          <Field label="Fecha de reporte"><Input type="date" max={hoyISO()} value={f.fechaReporte} onChange={set("fechaReporte")} required /></Field>
          <Field label="No. de siniestro aseguradora"><Input value={f.numeroSiniestro} onChange={set("numeroSiniestro")} /></Field>
          {!s.poliza && <Field label="Póliza"><Input value={f.polizaTexto} onChange={set("polizaTexto")} /></Field>}
          <Field label="Ejecutivo responsable" hint={usuario.role !== "admin" ? "Solo un administrador reasigna." : undefined}>
            <Select value={f.ejecutivoId} onChange={set("ejecutivoId")} disabled={usuario.role !== "admin"}>
              {usuarios.data?.filter((u) => u.role !== "consulta").map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Gastado por el asegurado"><Input inputMode="decimal" value={f.gastado} onChange={set("gastado")} /></Field>
          <Field label="Reclamado" hint={conConceptos ? "Sale de la suma de conceptos." : undefined}><Input inputMode="decimal" value={f.reclamado} onChange={set("reclamado")} disabled={conConceptos} /></Field>
          <Field label="Deducible"><Input inputMode="decimal" value={f.deducible} onChange={set("deducible")} /></Field>
          <Field label="Coaseguro"><Input inputMode="decimal" value={f.coaseguro} onChange={set("coaseguro")} /></Field>
        </div>
        {autos && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="No. de reporte en cabina"><Input value={f.numeroReporte} onChange={set("numeroReporte")} /></Field>
            <Field label="Lugar" className="sm:col-span-2"><Input value={f.lugar} onChange={set("lugar")} /></Field>
            <Field label="Conductor"><Input value={f.conductorNombre} onChange={set("conductorNombre")} /></Field>
            <Field label="Ajustador"><Input value={f.ajustadorNombre} onChange={set("ajustadorNombre")} /></Field>
            <Field label="Teléfono del ajustador"><Input value={f.ajustadorTelefono} onChange={set("ajustadorTelefono")} /></Field>
            <Field label="Taller o agencia"><Input value={f.tallerNombre} onChange={set("tallerNombre")} /></Field>
            <Field label="Responsabilidad">
              <Select value={f.responsabilidad} onChange={set("responsabilidad")}>{RESPONSABILIDADES.map((r) => <option key={r} value={r}>{RESPONSABILIDAD_LABEL[r]}</option>)}</Select>
            </Field>
          </div>
        )}
        <Field label="Descripción de lo ocurrido"><Textarea rows={3} value={f.descripcion} onChange={set("descripcion")} /></Field>
        <p className="text-xs text-ink-600">El estatus, lo autorizado y lo pagado no se editan aquí: tienen su propio registro con folio o referencia.</p>
        <ErrorBox error={m.error && errorMsg(m.error)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={m.isPending}>Guardar cambios</Button>
        </div>
      </form>
    </Modal>
  )
}

function NuevoTercero({ s, onClose }: { s: Exp; onClose: () => void }) {
  const refrescar = useRefrescar()
  const [f, setF] = useState({ nombre: "", telefono: "", vehiculo: "", placas: "", aseguradora: "", notas: "" })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const m = trpc.siniestros.agregarTercero.useMutation({ onSuccess: () => { refrescar(); onClose() } })
  return (
    <Modal title="Agregar tercero" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); m.mutate({ siniestroId: s.id, ...f }) }} className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre" className="sm:col-span-2"><Input value={f.nombre} onChange={set("nombre")} required /></Field>
        <Field label="Teléfono"><Input value={f.telefono} onChange={set("telefono")} /></Field>
        <Field label="Su aseguradora"><Input value={f.aseguradora} onChange={set("aseguradora")} /></Field>
        <Field label="Vehículo"><Input value={f.vehiculo} onChange={set("vehiculo")} /></Field>
        <Field label="Placas"><Input value={f.placas} onChange={set("placas")} /></Field>
        <Field label="Notas" className="sm:col-span-2"><Textarea rows={2} value={f.notas} onChange={set("notas")} /></Field>
        <div className="sm:col-span-2"><ErrorBox error={m.error && errorMsg(m.error)} /></div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={m.isPending}>Agregar</Button>
        </div>
      </form>
    </Modal>
  )
}
