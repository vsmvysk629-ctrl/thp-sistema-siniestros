import { Link, useNavigate } from "react-router"
import clsx from "clsx"
import { ArrowRight } from "lucide-react"
import { RAMO_LABEL } from "@contracts/catalogos"
import { ESTADO_LABEL } from "@contracts/flujo"
import { trpc } from "@/providers/trpc"
import { Avatar, Badge, Button, Card, EstadoBadge, Folio, Kpi, PageHeader, Tabla } from "@/components/ui"
import { corto, descargarCSV, fechaLarga, fmtFecha, hoyISO, monedaCorta, saludo } from "@/lib/format"
import { esEditor, useSesion } from "@/lib/sesion"

const SEV = { alta: "bg-sev-alta", media: "bg-sev-media", baja: "bg-sev-baja" }

export default function Tablero() {
  const { usuario, nuevoSiniestro } = useSesion()
  const nav = useNavigate()
  const t = trpc.tablero.resumen.useQuery()
  const lista = trpc.siniestros.list.useQuery({ grupoEstado: "todos" })
  if (!t.data) return <p className="text-sm text-ink-400">Cargando…</p>
  const { kpis, alertas, porGrupo, compromisos } = t.data
  const maxGrupo = Math.max(1, ...porGrupo.map((g) => g.n))
  const hoy = hoyISO()

  const exportar = () =>
    descargarCSV(
      `siniestros-${hoy}`,
      ["Folio", "Contratante", "Afectado", "Ramo", "Tipo", "Compañía", "No. siniestro", "Estatus", "Ocurrió", "Reporte", "Ejecutivo", "Próxima acción", "Compromiso", "Reclamado", "Autorizado", "Pagado"],
      (lista.data ?? []).map((r) => [r.folio, r.contratante, r.afectado, RAMO_LABEL[r.ramo], r.tipo, r.aseguradora, r.numeroSiniestro, ESTADO_LABEL[r.estado], r.fechaOcurrido, r.fechaReporte, r.ejecutivo, r.proximaAccion, r.fechaCompromiso, r.reclamado, r.autorizado, r.pagado]),
    )

  return (
    <>
      <PageHeader
        arriba={fechaLarga()}
        titulo={`${saludo()}, ${corto(usuario.nombre)}`}
        acciones={
          <>
            <Button variant="secondary" onClick={exportar}>Exportar a Excel</Button>
            {esEditor(usuario) && <Button onClick={() => nuevoSiniestro()}>+ Nuevo siniestro</Button>}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Siniestros registrados" valor={kpis.registrados} nota="Histórico del despacho" />
        <Kpi label="Abiertos" valor={kpis.abiertos} nota="En seguimiento" />
        <Kpi label="Cerrados" valor={kpis.cerrados} nota="Concluidos" />
        <Kpi label="Pendientes de documentación" valor={kpis.pendientesDoc} nota="Incluye info. adicional" />
        <Kpi label="Ingresados a aseguradora" valor={kpis.ingresados} nota="En revisión" />
        <Kpi label="Pendientes de pago" valor={kpis.pendientesPago} nota="Autorizados o pago parcial" />
        <Kpi label="Monto reclamado" valor={monedaCorta(kpis.reclamado)} nota="MXN" />
        <Kpi label="Monto indemnizado" valor={monedaCorta(kpis.pagado)} nota={`${kpis.pctPagado}% de lo reclamado`} />
        <Kpi label="Pendiente de indemnizar" valor={monedaCorta(kpis.pendienteIndemnizar)} nota="Autorizado sin pagar" />
        <Kpi label="Tiempo promedio" valor={kpis.tiempoPromedio === null ? "—" : `${kpis.tiempoPromedio} días`} nota="Del reporte al pago" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Alertas y pendientes" actions={alertas.length > 0 && <Badge tono="red">{alertas.length} requieren atención</Badge>}>
          {alertas.length === 0 && <p className="py-6 text-center text-sm text-ink-400">Sin pendientes. Todo al día.</p>}
          <ul className="divide-y divide-line-soft border-t border-line-soft">
            {alertas.map((a, i) => (
              <li key={i}>
                <Link to={`/siniestros/${a.siniestroId}`} className="flex gap-3 px-2 py-3 hover:bg-subtle">
                  <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", SEV[a.sev])} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px]"><span className="font-semibold">{a.titulo}</span> · <Folio>{a.folio}</Folio></p>
                    <p className="text-sm text-ink-600">{a.detalle}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-ink-600">
                    <p className="font-semibold text-ink-900">{corto(a.quien)}</p>
                    <p>{a.cuando && /^\d{4}-/.test(a.cuando) ? fmtFecha(a.cuando) : a.cuando?.replace(/(\d{4}-\d{2}-\d{2})/, (m) => fmtFecha(m))}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Abiertos por ramo" className="flex flex-col">
          <div className="space-y-4">
            {porGrupo.map((g) => (
              <button key={g.grupo} className="block w-full text-left" onClick={() => nav(`/siniestros?ramo=${g.grupo}`)}>
                <div className="flex justify-between text-sm"><span>{g.nombre}</span><span className="font-semibold">{g.n}</span></div>
                <div className="mt-1.5 h-2 rounded-full bg-line-soft"><div className="h-2 rounded-full bg-navy-900" style={{ width: `${Math.max(g.n ? 4 : 0, (g.n / maxGrupo) * 100)}%` }} /></div>
              </button>
            ))}
          </div>
          <div className="mt-auto flex justify-between border-t border-line-soft pt-4 text-sm">
            <span className="text-ink-600">Indemnizado vs reclamado</span>
            <span className="font-semibold">{kpis.pctPagado}%</span>
          </div>
        </Card>
      </div>

      <Card title="Próximos compromisos" className="mt-5" actions={<Link to="/siniestros" className="flex items-center gap-1 text-sm font-semibold text-navy-900">Ver todos los siniestros <ArrowRight size={14} /></Link>}>
        <Tabla cols={["Folio", "Contratante / asegurado", "Estatus", "Próxima acción", "Responsable"]} vacio={!compromisos.length && "Sin compromisos."}>
          {compromisos.map((r) => (
            <tr key={r.id} className="cursor-pointer align-top hover:bg-subtle" onClick={() => nav(`/siniestros/${r.id}`)}>
              <td className="px-2.5 py-3"><Folio>{r.folio}</Folio></td>
              <td className="px-2.5 py-3"><p className="font-semibold">{r.contratante}</p><p className="text-ink-600">{r.afectado}</p></td>
              <td className="px-2.5 py-3"><EstadoBadge estado={r.estado} /></td>
              <td className="px-2.5 py-3">
                <p>{r.proximaAccion}</p>
                <Compromiso fecha={r.fechaCompromiso} hoy={hoy} />
              </td>
              <td className="px-2.5 py-3"><span className="flex items-center gap-2"><Avatar nombre={r.ejecutivo} id={r.ejecutivoId} />{corto(r.ejecutivo)}</span></td>
            </tr>
          ))}
        </Tabla>
      </Card>
    </>
  )
}

export function Compromiso({ fecha, hoy }: { fecha: string | null; hoy: string }) {
  if (!fecha) return null
  return fecha < hoy ? <p className="font-semibold text-tone-red">Vencido: {fmtFecha(fecha)}</p> : <p className="text-ink-600">Compromiso: {fmtFecha(fecha)}</p>
}
