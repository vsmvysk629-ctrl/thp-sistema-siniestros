import { useState } from "react"
import { Link, useParams } from "react-router"
import clsx from "clsx"
import { ArrowLeft, Check, Pencil, Trash2, UserPlus } from "lucide-react"
import {
  ESTADO_LABEL,
  REQUIERE_FOLIO,
  REQUIERE_NOTA,
  RESPONSABILIDAD_LABEL,
  TIPO_LABEL,
  TRANSICIONES,
  esAbierto,
  rutaDe,
  type Estado,
} from "@contracts/flujo"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../api/router"
import { trpc } from "@/providers/trpc"
import { Badge, Button, Card, Dato, ErrorBox, Field, Input, Modal, Textarea } from "@/components/ui"
import { DatosForm, aApi, type Datos } from "@/components/DatosForm"
import { DIAS_ATORADO, colorEstado, diasDesde, errorMsg, fmtFecha, moneda } from "@/lib/format"

export default function SiniestroDetalle({ puedeOperar }: { puedeOperar: boolean }) {
  const id = Number(useParams().id)
  const q = trpc.siniestros.get.useQuery({ id }, { enabled: Number.isFinite(id) })
  const [editando, setEditando] = useState(false)
  const [destino, setDestino] = useState<Estado | null>(null)
  const [tercero, setTercero] = useState(false)

  if (q.isLoading) return <p className="text-sm text-ink-400">Cargando…</p>
  if (!q.data) return <ErrorBox error={q.error ? errorMsg(q.error) : "Siniestro no encontrado."} />
  const s = q.data
  const historialEstados = s.eventos.flatMap((e) => (e.estadoNuevo ? [e.estadoNuevo] : []))
  const ruta = rutaDe(s.estado, historialEstados)
  const posicion = ruta.indexOf(s.estado)
  const sinMov = diasDesde(s.ultimoMovimiento)
  const p = s.poliza

  return (
    <div className="space-y-4">
      <Link to="/siniestros" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900"><ArrowLeft size={14} /> Siniestros</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{s.folio}</h1>
            <Badge className={colorEstado(s.estado)}>{ESTADO_LABEL[s.estado]}</Badge>
            {esAbierto(s.estado) && sinMov >= DIAS_ATORADO && <Badge className="bg-amber-50 text-amber-800">{sinMov} días sin movimiento</Badge>}
          </div>
          <p className="text-sm text-ink-600">
            {s.cliente.nombre} · {s.aseguradora.nombre} · {TIPO_LABEL[s.tipo]} · ocurrido {fmtFecha(s.fechaOcurrido, true)}
          </p>
        </div>
        {puedeOperar && TRANSICIONES[s.estado].length > 0 && (
          <div className="flex flex-wrap gap-2">
            {TRANSICIONES[s.estado].map((d) => (
              <Button key={d} variant={d === "rechazado" || d === "cancelado" ? "danger" : ruta.includes(d) ? "primary" : "secondary"} onClick={() => setDestino(d)}>
                {d === "rechazado" ? "Rechazado" : d === "cancelado" ? "Cancelar" : `→ ${ESTADO_LABEL[d]}`}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Avance según la ruta del siniestro */}
      <ol className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-3">
        {ruta.map((e, i) => {
          const hecho = posicion >= 0 && i < posicion
          const actual = e === s.estado
          return (
            <li key={e} className="flex min-w-[96px] flex-1 flex-col items-center gap-1 text-center">
              <span className={clsx("flex h-6 w-6 items-center justify-center rounded-full text-xs", actual ? "bg-brand-600 text-white" : hecho ? "bg-emerald-100 text-emerald-700" : "bg-subtle text-ink-400")}>
                {hecho ? <Check size={14} /> : i + 1}
              </span>
              <span className={clsx("text-[11px] leading-tight", actual ? "font-semibold text-ink-900" : "text-ink-600")}>{ESTADO_LABEL[e]}</span>
            </li>
          )
        })}
        {posicion < 0 && <li className="self-center px-2 text-sm font-medium text-red-700">{ESTADO_LABEL[s.estado]}</li>}
      </ol>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card
            title="Datos del siniestro"
            actions={puedeOperar && !editando && <Button variant="ghost" onClick={() => setEditando(true)}><Pencil size={14} /> Editar</Button>}
          >
            {editando ? (
              <Editar s={s} onDone={() => setEditando(false)} />
            ) : (
              <dl className="grid gap-3 sm:grid-cols-3">
                <Dato label="Nº de reporte (cabina)">{s.numeroReporte}</Dato>
                <Dato label="Nº de siniestro">{s.numeroSiniestro}</Dato>
                <Dato label="Responsabilidad">{RESPONSABILIDAD_LABEL[s.responsabilidad]}</Dato>
                <Dato label="Ajustador">{[s.ajustadorNombre, s.ajustadorTelefono].filter(Boolean).join(" · ")}</Dato>
                <Dato label="Taller o agencia">{s.tallerNombre}</Dato>
                <Dato label="Conductor">{s.conductorNombre}</Dato>
                <Dato label="Deducible">{moneda(s.deducible)}</Dato>
                <Dato label="Monto estimado">{moneda(s.montoEstimado)}</Dato>
                <Dato label="Monto autorizado (aseguradora)">{moneda(s.montoAutorizado)}</Dato>
                <Dato label="Lugar">{s.lugar}</Dato>
                <Dato label="Responsable">{s.responsable?.nombre ?? "Sin asignar"}</Dato>
                <Dato label="Último movimiento">{fmtFecha(s.ultimoMovimiento, true)}</Dato>
                <div className="sm:col-span-3"><Dato label="Descripción"><span className="whitespace-pre-line">{s.descripcion}</span></Dato></div>
              </dl>
            )}
          </Card>

          <Card
            title={`Terceros (${s.terceros.length})`}
            actions={puedeOperar && <Button variant="ghost" onClick={() => setTercero(true)}><UserPlus size={14} /> Agregar</Button>}
          >
            {s.terceros.length === 0 ? (
              <p className="text-sm text-ink-400">Sin terceros registrados.</p>
            ) : (
              <ul className="divide-y divide-line">
                {s.terceros.map((t) => <TerceroRow key={t.id} t={t} puedeOperar={puedeOperar} />)}
              </ul>
            )}
          </Card>

          <Historial s={s} />
        </div>

        <div className="space-y-4">
          <Card title="Póliza y vehículo">
            <dl className="space-y-2">
              <Dato label="Póliza">{`${p.numero} · ${s.aseguradora.nombre}`}</Dato>
              <Dato label="Cobertura">{p.cobertura === "rc" ? "Responsabilidad civil" : p.cobertura === "limitada" ? "Limitada" : "Amplia"}</Dato>
              <Dato label="Vigencia">{p.vigenciaInicio ? `${fmtFecha(p.vigenciaInicio)} – ${fmtFecha(p.vigenciaFin)}` : null}</Dato>
              <Dato label="Vehículo">{[p.vehiculoMarca, p.vehiculoModelo, p.vehiculoAnio].filter(Boolean).join(" ")}</Dato>
              <Dato label="Placas / serie">{[p.vehiculoPlacas, p.vehiculoSerie].filter(Boolean).join(" · ")}</Dato>
            </dl>
          </Card>
          <Card title="Cliente">
            <dl className="space-y-2">
              <Dato label="Nombre">{s.cliente.nombre}</Dato>
              <Dato label="Teléfono">{s.cliente.telefono}</Dato>
              <Dato label="Correo">{s.cliente.email}</Dato>
            </dl>
          </Card>
        </div>
      </div>

      {destino && <CambiarEstado id={s.id} desde={s.estado} destino={destino} onClose={() => setDestino(null)} />}
      {tercero && <NuevoTercero siniestroId={s.id} onClose={() => setTercero(false)} />}
    </div>
  )
}

type Detalle = inferRouterOutputs<AppRouter>["siniestros"]["get"]

function Editar({ s, onDone }: { s: Detalle; onDone: () => void }) {
  const utils = trpc.useUtils()
  const v = (x: string | null) => x ?? ""
  const [datos, setDatos] = useState<Datos>({
    numeroReporte: v(s.numeroReporte), numeroSiniestro: v(s.numeroSiniestro), ajustadorNombre: v(s.ajustadorNombre),
    ajustadorTelefono: v(s.ajustadorTelefono), tipo: s.tipo, fechaOcurrido: s.fechaOcurrido.replace(" ", "T").slice(0, 16),
    lugar: v(s.lugar), descripcion: v(s.descripcion), conductorNombre: v(s.conductorNombre), responsabilidad: s.responsabilidad,
    tallerNombre: v(s.tallerNombre), deducible: v(s.deducible), montoEstimado: v(s.montoEstimado), responsableId: s.responsableId,
  })
  const guardar = trpc.siniestros.actualizar.useMutation({
    onSuccess: () => { utils.siniestros.invalidate(); onDone() },
  })
  return (
    <div className="space-y-3">
      <DatosForm datos={datos} onChange={setDatos} conResponsable />
      <ErrorBox error={guardar.error && errorMsg(guardar.error)} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>Cancelar</Button>
        <Button disabled={guardar.isPending} onClick={() => guardar.mutate({ id: s.id, datos: aApi(datos) })}>Guardar</Button>
      </div>
    </div>
  )
}

function CambiarEstado({ id, desde, destino, onClose }: { id: number; desde: Estado; destino: Estado; onClose: () => void }) {
  const utils = trpc.useUtils()
  const [folio, setFolio] = useState("")
  const [nota, setNota] = useState("")
  const [monto, setMonto] = useState("")
  const pideFolio = REQUIERE_FOLIO.includes(destino)
  const pideNota = REQUIERE_NOTA.includes(destino)
  const m = trpc.siniestros.cambiarEstado.useMutation({
    onSuccess: () => { utils.siniestros.invalidate(); onClose() },
  })
  return (
    <Modal title={`${ESTADO_LABEL[desde]} → ${ESTADO_LABEL[destino]}`} onClose={onClose}>
      <div className="space-y-3">
        {pideFolio && (
          <>
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Este paso afirma algo que solo la aseguradora confirma. Captura el folio, oficio o referencia que te dio.
            </p>
            <Field label="Folio o referencia de la aseguradora"><Input value={folio} onChange={(e) => setFolio(e.target.value)} autoFocus /></Field>
            <Field label="Monto autorizado ($), si aplica"><Input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" placeholder="0.00" /></Field>
          </>
        )}
        <Field label={pideNota ? "Motivo (obligatorio)" : "Nota (opcional)"}><Textarea rows={3} value={nota} onChange={(e) => setNota(e.target.value)} /></Field>
        <ErrorBox error={m.error && errorMsg(m.error)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={m.isPending}
            onClick={() => m.mutate({ id, destino, folio: folio || null, nota: nota || null, montoAutorizado: monto.replace(/[$,\s]/g, "") || null })}
          >
            Confirmar
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function Historial({ s }: { s: Detalle }) {
  const utils = trpc.useUtils()
  const [nota, setNota] = useState("")
  const m = trpc.siniestros.agregarNota.useMutation({
    onSuccess: () => { setNota(""); utils.siniestros.invalidate() },
  })
  return (
    <Card title="Historial">
      <div className="mb-4 flex gap-2">
        <Input placeholder="Agregar nota de seguimiento…" value={nota} onChange={(e) => setNota(e.target.value)} />
        <Button disabled={!nota.trim() || m.isPending} onClick={() => m.mutate({ id: s.id, nota })}>Agregar</Button>
      </div>
      <ErrorBox error={m.error && errorMsg(m.error)} />
      <ol className="relative ml-2 space-y-4 border-l border-line pl-5">
        {s.eventos.map((e) => (
          <li key={e.id} className="relative text-sm">
            <span className={clsx("absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4", e.tipo === "cambio_estado" || e.tipo === "alta" ? "bg-brand-600 ring-brand-100" : "bg-ink-400 ring-subtle")} />
            <p className="font-medium">
              {e.tipo === "alta" && "Siniestro registrado"}
              {e.tipo === "cambio_estado" && `${ESTADO_LABEL[e.estadoAnterior!]} → ${ESTADO_LABEL[e.estadoNuevo!]}`}
              {e.tipo === "edicion" && "Datos actualizados"}
              {e.tipo === "nota" && "Nota"}
              {e.tipo === "tercero" && "Terceros"}
            </p>
            {e.folio && <p className="text-xs text-ink-600">Folio aseguradora: <span className="font-medium">{e.folio}</span></p>}
            {e.nota && <p className="whitespace-pre-line text-ink-600">{e.nota}</p>}
            <p className="text-xs text-ink-400">{fmtFecha(e.createdAt, true)} · {e.autor?.nombre ?? "—"}</p>
          </li>
        ))}
      </ol>
    </Card>
  )
}

function TerceroRow({ t, puedeOperar }: { t: Detalle["terceros"][number]; puedeOperar: boolean }) {
  const utils = trpc.useUtils()
  const quitar = trpc.siniestros.quitarTercero.useMutation({ onSuccess: () => utils.siniestros.invalidate() })
  return (
    <li className="flex items-start justify-between gap-2 py-2 text-sm">
      <div>
        <p className="font-medium">{t.nombre}</p>
        <p className="text-ink-600">{[t.telefono, t.vehiculo, t.placas, t.aseguradora].filter(Boolean).join(" · ") || "—"}</p>
        {t.notas && <p className="text-xs text-ink-400">{t.notas}</p>}
      </div>
      {puedeOperar && (
        <button
          className="text-ink-400 hover:text-red-700"
          aria-label="Quitar tercero"
          onClick={() => confirm(`¿Quitar a ${t.nombre}?`) && quitar.mutate({ id: t.id })}
        >
          <Trash2 size={15} />
        </button>
      )}
    </li>
  )
}

function NuevoTercero({ siniestroId, onClose }: { siniestroId: number; onClose: () => void }) {
  const utils = trpc.useUtils()
  const [f, setF] = useState({ nombre: "", telefono: "", vehiculo: "", placas: "", aseguradora: "", notas: "" })
  const m = trpc.siniestros.agregarTercero.useMutation({ onSuccess: () => { utils.siniestros.invalidate(); onClose() } })
  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) })
  return (
    <Modal title="Agregar tercero" onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre" className="sm:col-span-2"><Input {...campo("nombre")} autoFocus /></Field>
        <Field label="Teléfono"><Input {...campo("telefono")} /></Field>
        <Field label="Aseguradora del tercero"><Input {...campo("aseguradora")} /></Field>
        <Field label="Vehículo"><Input {...campo("vehiculo")} /></Field>
        <Field label="Placas"><Input {...campo("placas")} /></Field>
        <Field label="Notas" className="sm:col-span-2"><Textarea rows={2} {...campo("notas")} /></Field>
      </div>
      <div className="mt-3"><ErrorBox error={m.error && errorMsg(m.error)} /></div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button disabled={!f.nombre.trim() || m.isPending} onClick={() => m.mutate({ siniestroId, ...f })}>Agregar</Button>
      </div>
    </Modal>
  )
}
