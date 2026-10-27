import { useState } from "react"
import { trpc } from "@/providers/trpc"
import { Button, Card, PageHeader, Tabla, Tabs } from "@/components/ui"
import { descargarCSV, hoyISO, moneda } from "@/lib/format"

type Por = "ramo" | "aseguradora" | "ejecutivo" | "tiempos"
const TITULO: Record<Por, string> = { ramo: "Por ramo", aseguradora: "Por compañía", ejecutivo: "Por ejecutivo", tiempos: "Tiempos de resolución" }

export default function Reportes() {
  const [por, setPor] = useState<Por>("ramo")
  const r = trpc.tablero.reportes.useQuery({ por })
  const filas = r.data?.filas ?? []
  const tiempos = r.data?.tiempos ?? []
  const maxDias = Math.max(1, ...tiempos.map((t) => t.dias ?? 0))

  const exportar = () => {
    if (por === "tiempos") {
      descargarCSV(`reporte-tiempos-${hoyISO()}`, ["Compañía", "Días promedio del reporte al pago", "Siniestros pagados"], tiempos.map((t) => [t.nombre, t.dias, t.n]))
    } else {
      descargarCSV(`reporte-${por}-${hoyISO()}`, [TITULO[por].replace("Por ", ""), "Siniestros", "Abiertos", "Reclamado", "Pagado", "% pagado"], filas.map((f) => [f.nombre, f.n, f.abiertos, f.reclamado, f.pagado, f.pct]))
    }
  }

  return (
    <>
      <PageHeader
        titulo="Reportes"
        sub="Indicadores del despacho con todos los siniestros registrados"
        acciones={
          <>
            <Button variant="secondary" onClick={exportar}>Exportar a Excel</Button>
            <Button variant="secondary" onClick={() => window.print()}>Exportar a PDF</Button>
          </>
        }
      />
      <Tabs<Por> valor={por} onChange={setPor} tabs={(Object.keys(TITULO) as Por[]).map((id) => ({ id, label: TITULO[id] }))} />
      <h2 className="mb-3 hidden text-lg font-semibold print:block">{TITULO[por]}</h2>
      {por !== "tiempos" ? (
        <Card pad={false} className="px-3 py-2">
          <Tabla
            cols={[TITULO[por].replace("Por ", "").replace(/^./, (c) => c.toUpperCase()), "Siniestros", "Abiertos", "Reclamado", "Pagado", "% pagado de lo reclamado"]}
            vacio={r.isLoading ? "Cargando…" : !filas.length && "Sin datos."}
          >
            {filas.map((f) => (
              <tr key={String(f.clave)}>
                <td className="px-2.5 py-3 font-semibold">{f.nombre}</td>
                <td className="px-2.5 py-3">{f.n}</td>
                <td className="px-2.5 py-3">{f.abiertos}</td>
                <td className="px-2.5 py-3">{moneda(f.reclamado)}</td>
                <td className="px-2.5 py-3">{moneda(f.pagado)}</td>
                <td className="px-2.5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-28 rounded-full bg-line-soft"><div className="h-2 rounded-full bg-tone-green" style={{ width: `${Math.min(100, f.pct)}%` }} /></div>
                    <span>{f.pct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </Tabla>
        </Card>
      ) : (
        <Card title="Días promedio del reporte al pago, por compañía">
          {!tiempos.length && <p className="text-sm text-ink-400">Aún no hay siniestros pagados para medir.</p>}
          <div className="space-y-3">
            {tiempos.map((t) => (
              <div key={t.nombre} className="grid grid-cols-[120px_1fr_120px] items-center gap-3 text-sm">
                <span className="font-semibold">{t.nombre}</span>
                <div className="h-3 rounded-full bg-line-soft"><div className="h-3 rounded-full bg-navy-900" style={{ width: `${((t.dias ?? 0) / maxDias) * 100}%` }} /></div>
                <span className="text-right">{t.dias} días · {t.n} pagado{t.n === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}
