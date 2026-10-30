import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import clsx from "clsx"
import { ArrowLeft, Printer } from "lucide-react"
import { DOC_FALTANTE, RAMO_LABEL } from "@contracts/catalogos"
import { ESTADOS, ESTADO_LABEL, type Estado } from "@contracts/flujo"
import { trpc } from "@/providers/trpc"
import { Avatar, Badge, Button, EstadoBadge, Eyebrow, Folio, Tabs } from "@/components/ui"
import { corto, diasEntre, fmtFecha, hoyISO } from "@/lib/format"
import type { Salidas } from "@/lib/sesion"
import { DatosTab } from "@/components/expediente/Datos"
import { DocumentosTab } from "@/components/expediente/Documentos"
import { FinancieroTab } from "@/components/expediente/Financiero"
import { BitacoraTab } from "@/components/expediente/Bitacora"
import { CambiarEstatus, ProximaAccion } from "@/components/expediente/Modales"

export type Exp = Salidas["siniestros"]["get"]
type Tab = "datos" | "docs" | "fin" | "log"

export default function Expediente() {
  const id = Number(useParams().id)
  const nav = useNavigate()
  const q = trpc.siniestros.get.useQuery({ id }, { enabled: Number.isFinite(id) })
  const [tab, setTab] = useState<Tab>("datos")
  const [modal, setModal] = useState<"estatus" | "accion" | null>(null)
  if (q.error) return <p className="text-sm text-tone-red">{q.error.message}</p>
  if (!q.data) return <p className="text-sm text-ink-400">Cargando…</p>
  const s = q.data
  const faltantes = s.documentos.filter((d) => DOC_FALTANTE.includes(d.estado)).length
  const poliza = s.poliza?.numero ?? s.polizaTexto
  const hoy = hoyISO()
  const vencido = !!s.fechaCompromiso && s.fechaCompromiso < hoy
  const dias = diasEntre(s.fechaReporte, hoy)

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-center gap-2 text-[13px] text-ink-400">
        <button onClick={() => nav(-1)} className="flex items-center gap-1 text-ink-600 hover:text-ink-900"><ArrowLeft size={14} strokeWidth={1.75} /> Volver</button>
        <span>/</span>
        <Link to={`/contratantes/${s.contratante.id}`} className="text-ink-600 hover:text-ink-900">{s.contratante.nombre}</Link>
        <span>/</span>
        <Folio>{s.folio}</Folio>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><Folio>{s.folio}</Folio><EstadoBadge estado={s.estado} /><Badge>{RAMO_LABEL[s.ramo]}</Badge></div>
          <h1 className="mt-2 text-[26px] font-medium leading-tight">{s.tipo} <span className="text-ink-400">·</span> {s.afectado}</h1>
          <p className="mt-1 text-[13px] text-ink-600">
            {s.aseguradora.nombre}
            {poliza && <> · Póliza <span className="font-mono text-[12px]">{poliza}</span></>}
            {" · "}Siniestro aseguradora {s.numeroSiniestro ? <span className="font-mono text-[12px]">{s.numeroSiniestro}</span> : "sin número aún"}
            {" · "}{dias} {dias === 1 ? "día" : "días"} desde el reporte
          </p>
        </div>
        <div className="no-print flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}><Printer size={14} strokeWidth={1.75} /> Exportar</Button>
          {s.puedeEditar && s.estado !== "cerrado" && <Button onClick={() => setModal("estatus")}>Cambiar estatus</Button>}
        </div>
      </div>

      <section className="mb-6 rounded-card border border-line bg-surface">
        <div className="p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <Eyebrow>Avance del trámite</Eyebrow>
            <span className="font-mono text-[11px] text-ink-400">{String(ESTADOS.indexOf(s.estado) + 1).padStart(2, "0")} / {ESTADOS.length}</span>
          </div>
          <Avance s={s} />
        </div>
        {s.estado !== "cerrado" && (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line px-5 py-4">
            <div className="min-w-0 flex-1 basis-full border-l-2 border-thp pl-3 sm:basis-auto">
              <Eyebrow>Próxima acción</Eyebrow>
              <p className="mt-0.5 text-[15px] font-medium">{s.proximaAccion ?? <span className="text-ink-400">Sin acción definida</span>}</p>
            </div>
            <div>
              <Eyebrow>Compromiso</Eyebrow>
              <p className={clsx("mt-0.5 text-[14px]", vencido && "font-medium text-tone-red")}>{fmtFecha(s.fechaCompromiso)}{vencido && " · vencido"}</p>
            </div>
            <div>
              <Eyebrow>Responsable</Eyebrow>
              <p className="mt-0.5 flex items-center gap-1.5 text-[14px]"><Avatar nombre={s.ejecutivo?.nombre} />{corto(s.ejecutivo?.nombre)}</p>
            </div>
            {s.puedeEditar && <Button variant="secondary" className="no-print" onClick={() => setModal("accion")}>Actualizar</Button>}
          </div>
        )}
      </section>

      <Tabs<Tab>
        valor={tab}
        onChange={setTab}
        tabs={[
          { id: "datos", label: "Datos generales" },
          { id: "docs", label: <>Documentación{faltantes > 0 && <span className="ml-1.5 font-mono text-[11px] opacity-70">{faltantes}</span>}</> },
          { id: "fin", label: "Financiero" },
          { id: "log", label: <>Bitácora<span className="ml-1.5 font-mono text-[11px] opacity-70">{s.eventos.length}</span></> },
        ]}
      />
      {/* Al imprimir ("Exportar") salen las cuatro secciones. */}
      <Panel on={tab === "datos"} titulo="Datos generales"><DatosTab s={s} /></Panel>
      <Panel on={tab === "docs"} titulo="Documentación"><DocumentosTab s={s} /></Panel>
      <Panel on={tab === "fin"} titulo="Financiero"><FinancieroTab s={s} /></Panel>
      <Panel on={tab === "log"} titulo="Bitácora"><BitacoraTab s={s} /></Panel>

      {modal === "estatus" && <CambiarEstatus s={s} onClose={() => setModal(null)} />}
      {modal === "accion" && <ProximaAccion s={s} onClose={() => setModal(null)} />}
    </>
  )
}

function Panel({ on, titulo, children }: { on: boolean; titulo: string; children: React.ReactNode }) {
  return (
    <section className={clsx(!on && "hidden print:block", "print:mb-8")}>
      <h2 className="mb-3 hidden text-[16px] font-medium print:block">{titulo}</h2>
      {children}
    </section>
  )
}

/** Pasos del trámite: tinta los recorridos, azul THP el actual, rojo si hubo rechazo. */
function Avance({ s }: { s: Exp }) {
  const vistos = new Set<Estado>(s.eventos.flatMap((e) => (e.estadoNuevo ? [e.estadoNuevo] : [])))
  vistos.add("reportado")
  const tono = (e: Estado) =>
    e === s.estado ? (e === "rechazado" ? "bg-sev-alta" : "bg-thp") : vistos.has(e) ? (e === "rechazado" ? "bg-sev-alta/50" : "bg-ink-900") : "bg-line"
  return (
    <div className="grid grid-cols-11 gap-1.5">
      {ESTADOS.map((e, i) => (
        <div key={e} className="min-w-0">
          <div className={clsx("h-1 rounded-full", tono(e))} />
          <p
            className={clsx(
              "mt-2 hidden text-[10.5px] leading-tight md:block",
              e === s.estado ? "font-medium text-ink-900" : vistos.has(e) ? "text-ink-600" : "text-ink-400",
            )}
          >
            <span className="font-mono">{String(i + 1).padStart(2, "0")}</span> {ESTADO_LABEL[e]}
          </p>
        </div>
      ))}
      <p className="col-span-11 mt-2 text-[13px] font-medium md:hidden">{ESTADO_LABEL[s.estado]}</p>
    </div>
  )
}
