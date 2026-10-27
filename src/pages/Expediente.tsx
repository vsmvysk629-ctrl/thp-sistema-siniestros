import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import clsx from "clsx"
import { ArrowLeft } from "lucide-react"
import { RAMO_LABEL } from "@contracts/catalogos"
import { ESTADOS, ESTADO_LABEL, type Estado } from "@contracts/flujo"
import { DOC_FALTANTE } from "@contracts/catalogos"
import { trpc } from "@/providers/trpc"
import { Avatar, Badge, Button, Card, EstadoBadge, Folio, Tabs } from "@/components/ui"
import { corto, fmtFecha, hoyISO } from "@/lib/format"
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

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => nav(-1)} className="flex items-center gap-1 font-semibold text-navy-900"><ArrowLeft size={15} /> Volver</button>
        <span className="text-ink-400">·</span>
        <Link to={`/contratantes/${s.contratante.id}`} className="text-navy-900 hover:underline">{s.contratante.nombre}</Link>
        <span className="text-ink-400">/</span>
        <Folio>{s.folio}</Folio>
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2"><Folio>{s.folio}</Folio><EstadoBadge estado={s.estado} /><Badge>{RAMO_LABEL[s.ramo]}</Badge></div>
          <h1 className="mt-1 text-[28px] font-bold tracking-tight">{s.tipo} · {s.afectado}</h1>
          <p className="text-sm text-ink-600">
            {s.aseguradora.nombre}
            {poliza && ` · Póliza ${poliza}`}
            {` · Siniestro aseguradora ${s.numeroSiniestro ?? "sin número aún"}`}
          </p>
        </div>
        <div className="no-print flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}>Exportar expediente</Button>
          {s.puedeEditar && s.estado !== "cerrado" && <Button onClick={() => setModal("estatus")}>Cambiar estatus</Button>}
        </div>
      </div>

      <Card className="mb-4">
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink-600">Avance del trámite</p>
        <Avance s={s} />
      </Card>

      {s.estado !== "cerrado" && (
        <div className="mb-5 flex flex-wrap items-center gap-4 rounded-card border border-[#F4CFA6] bg-[#FFF4E8] px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-tone-orange">Próxima acción</p>
            <p className="text-[16px] font-semibold">{s.proximaAccion ?? "Sin acción definida"}</p>
          </div>
          <div className="text-sm">
            <p className="text-ink-600">Fecha compromiso</p>
            <p className={clsx("font-semibold", s.fechaCompromiso && s.fechaCompromiso < hoy && "text-tone-red")}>{fmtFecha(s.fechaCompromiso)}</p>
          </div>
          <div className="text-sm">
            <p className="text-ink-600">Responsable</p>
            <p className="flex items-center gap-1.5 font-semibold"><Avatar nombre={s.ejecutivo?.nombre} id={s.ejecutivoId} />{corto(s.ejecutivo?.nombre)}</p>
          </div>
          {s.puedeEditar && <Button variant="secondary" className="no-print" onClick={() => setModal("accion")}>Actualizar</Button>}
        </div>
      )}

      <Tabs<Tab>
        valor={tab}
        onChange={setTab}
        tabs={[
          { id: "datos", label: "Datos generales" },
          { id: "docs", label: `Documentación${faltantes ? ` (${faltantes} faltante${faltantes === 1 ? "" : "s"})` : ""}` },
          { id: "fin", label: "Financiero" },
          { id: "log", label: "Bitácora" },
        ]}
      />
      {/* Al imprimir ("Exportar expediente") salen las cuatro secciones. */}
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
    <section className={clsx(!on && "hidden print:block", "print:mb-6 print:break-inside-avoid-page")}>
      <h2 className="mb-3 hidden text-lg font-semibold print:block">{titulo}</h2>
      {children}
    </section>
  )
}

/** Pasos del trámite: verde los ya recorridos, azul el actual, rojo si hubo rechazo. */
function Avance({ s }: { s: Exp }) {
  const vistos = new Set<Estado>(s.eventos.flatMap((e) => (e.estadoNuevo ? [e.estadoNuevo] : [])))
  vistos.add("reportado")
  return (
    <div className="flex flex-wrap gap-2">
      {ESTADOS.map((e, i) => {
        const actual = e === s.estado
        const visto = vistos.has(e)
        return (
          <span
            key={e}
            className={clsx(
              "rounded-full border px-3 py-1.5 text-[13px] font-medium",
              actual
                ? "border-navy-900 bg-navy-900 text-white"
                : visto && e === "rechazado"
                  ? "border-tone-redBg bg-tone-redBg text-tone-red"
                  : visto
                    ? "border-tone-greenBg bg-tone-greenBg text-tone-green"
                    : e === "rechazado"
                      ? "border-dashed border-line-strong text-ink-600"
                      : "border-line-strong text-ink-600",
            )}
          >
            {i + 1} . {ESTADO_LABEL[e]}
          </span>
        )
      })}
    </div>
  )
}
