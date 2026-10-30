import { useState } from "react"
import { trpc } from "@/providers/trpc"
import { Barra, Button, Card, PageHeader, Tabla, Tabs } from "@/components/ui"
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
      <h2 className="mb-3 hidden text-lg font-medium print:block">{TITULO[por]}</h2>
      {por !== "tiempos" ? (
        <Card pad={false} className="px-3 py-2">
          <Tabla
            cols={[TITULO[por].replace("Por ", "").replace(/^./, (c) => c.toUpperCase()), "Siniestros", "Abiertos", "Reclamado", "Pagado", "% pagado de lo reclamado"]}
            vacio={r.isLoading ? "Cargando…" : !filas.length && "Sin datos."}
          >
            {filas.map((f) => (
              <tr key={String(f.clave)}>
                <td className="px-3 py-3.5 font-medium">{f.nombre}</td>
                <td className="px-3 py-3.5">{f.n}</td>
                <td className="px-3 py-3.5">{f.abiertos}</td>
                <td className="px-3 py-3.5">{moneda(f.reclamado)}</td>
                <td className="px-3 py-3.5">{moneda(f.pagado)}</td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-28"><Barra pct={f.pct} className="bg-thp" /></div>
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
                <span className="font-medium">{t.nombre}</span>
                <Barra pct={((t.dias ?? 0) / maxDias) * 100} />
                <span className="text-right">{t.dias} días · {t.n} pagado{t.n === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}
