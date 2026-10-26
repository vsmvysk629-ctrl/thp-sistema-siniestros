import { useState } from "react"
import { useNavigate } from "react-router"
import { trpc } from "@/providers/trpc"
import { Button, Card, ErrorBox, Field, Input, Textarea } from "@/components/ui"
import { DatosForm, aApi, datosVacios } from "@/components/DatosForm"
import { errorMsg } from "@/lib/format"

export default function SiniestroNuevo() {
  const nav = useNavigate()
  const me = trpc.auth.me.useQuery()
  const [busqueda, setBusqueda] = useState("")
  const [polizaId, setPolizaId] = useState<number | null>(null)
  const [datos, setDatos] = useState(datosVacios)
  const [nota, setNota] = useState("")
  const polizas = trpc.catalogos.polizas.useQuery({ busqueda: busqueda || undefined })
  const elegida = polizas.data?.find((p) => p.poliza.id === polizaId)
  const crear = trpc.siniestros.create.useMutation({ onSuccess: (r) => nav(`/siniestros/${r.id}`) })
  const oficina = me.data?.role !== "vendedor"

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold">Nuevo siniestro de autos</h1>
      <Card title="1. Póliza">
        {elegida ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <p className="font-medium">{elegida.cliente.nombre} · {elegida.aseguradora.nombre} · Póliza {elegida.poliza.numero}</p>
              <p className="text-ink-600">{[elegida.poliza.vehiculoMarca, elegida.poliza.vehiculoModelo, elegida.poliza.vehiculoAnio, elegida.poliza.vehiculoPlacas].filter(Boolean).join(" · ")}</p>
            </div>
            <Button variant="secondary" onClick={() => setPolizaId(null)}>Cambiar</Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input placeholder="Busca por cliente, número de póliza, placas o serie" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} autoFocus />
            <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line">
              {polizas.data?.length === 0 && <li className="px-3 py-3 text-sm text-ink-400">Sin resultados. Da de alta la póliza en "Clientes y pólizas".</li>}
              {polizas.data?.map((p) => (
                <li key={p.poliza.id}>
                  <button onClick={() => setPolizaId(p.poliza.id)} className="w-full px-3 py-2 text-left text-sm hover:bg-subtle">
                    <span className="font-medium">{p.cliente.nombre}</span> · {p.aseguradora.nombre} · {p.poliza.numero}
                    <span className="block text-xs text-ink-400">{[p.poliza.vehiculoMarca, p.poliza.vehiculoModelo, p.poliza.vehiculoAnio, p.poliza.vehiculoPlacas].filter(Boolean).join(" · ") || "Sin vehículo capturado"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      <Card title="2. Datos del siniestro">
        <DatosForm datos={datos} onChange={setDatos} conResponsable={oficina} />
        <Field label="Nota inicial (opcional)" className="mt-4"><Textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} /></Field>
      </Card>
      <ErrorBox error={crear.error && errorMsg(crear.error)} />
      <div className="flex justify-end">
        <Button disabled={!polizaId || crear.isPending} onClick={() => polizaId && crear.mutate({ ...aApi(datos), polizaId, nota: nota || null })}>
          Registrar siniestro
        </Button>
      </div>
    </div>
  )
}
