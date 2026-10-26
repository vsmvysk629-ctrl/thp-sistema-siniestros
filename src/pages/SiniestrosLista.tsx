import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router"
import { AlertTriangle, Plus } from "lucide-react"
import { ESTADOS, ESTADO_LABEL, TIPOS, TIPO_LABEL, esAbierto, type Estado, type TipoSiniestro } from "@contracts/flujo"
import { trpc } from "@/providers/trpc"
import { Badge, Button, Input, Select } from "@/components/ui"
import { DIAS_ATORADO, colorEstado, diasDesde, fmtFecha } from "@/lib/format"

export default function SiniestrosLista() {
  const nav = useNavigate()
  const [busqueda, setBusqueda] = useState("")
  const [estado, setEstado] = useState<Estado | "" | "abiertos">("abiertos")
  const [aseguradoraId, setAseguradoraId] = useState<number | "">("")
  const [tipo, setTipo] = useState<TipoSiniestro | "">("")
  const aseguradoras = trpc.catalogos.aseguradoras.useQuery()
  const usuarios = trpc.catalogos.usuarios.useQuery()
  const q = trpc.siniestros.list.useQuery({
    busqueda: busqueda || undefined,
    estado: estado && estado !== "abiertos" ? estado : undefined,
    soloAbiertos: estado === "abiertos" || undefined,
    aseguradoraId: aseguradoraId || undefined,
    tipo: tipo || undefined,
  })
  const nombre = useMemo(() => new Map((usuarios.data ?? []).map((u) => [u.id, u.nombre])), [usuarios.data])
  const rows = q.data ?? []
  const abiertos = rows.filter((r) => esAbierto(r.estado))
  const atorados = abiertos.filter((r) => diasDesde(r.ultimoMovimiento) >= DIAS_ATORADO)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Siniestros de autos</h1>
          <p className="text-sm text-ink-600">
            {rows.length} en la vista · {abiertos.length} abiertos ·{" "}
            <span className={atorados.length ? "font-medium text-amber-700" : ""}>{atorados.length} sin movimiento {DIAS_ATORADO}+ días</span>
          </p>
        </div>
        <Link to="/siniestros/nuevo"><Button><Plus size={16} /> Nuevo siniestro</Button></Link>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Buscar folio, nº siniestro, cliente, póliza o placas" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <Select value={estado} onChange={(e) => setEstado(e.target.value as Estado | "" | "abiertos")}>
          <option value="abiertos">Solo abiertos</option>
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
        </Select>
        <Select value={aseguradoraId} onChange={(e) => setAseguradoraId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Todas las aseguradoras</option>
          {aseguradoras.data?.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </Select>
        <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoSiniestro | "")}>
          <option value="">Todos los tipos</option>
          {TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-line text-left text-xs text-ink-400">
            <tr>
              {["Folio", "Cliente / vehículo", "Aseguradora", "Nº siniestro", "Tipo", "Estado", "Ocurrido", "Sin mov.", "Responsable"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={9} className="px-3 py-6 text-center text-ink-400">Cargando…</td></tr>}
            {!q.isLoading && rows.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-ink-400">No hay siniestros con estos filtros.</td></tr>}
            {rows.map((r) => {
              const dias = diasDesde(r.ultimoMovimiento)
              const atorado = esAbierto(r.estado) && dias >= DIAS_ATORADO
              return (
                <tr key={r.id} onClick={() => nav(`/siniestros/${r.id}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-subtle/50">
                  <td className="px-3 py-2 whitespace-nowrap font-medium text-brand-700">{r.folio}</td>
                  <td className="px-3 py-2">
                    <div>{r.cliente}</div>
                    <div className="text-xs text-ink-400">{[r.vehiculo, r.placas].filter(Boolean).join(" · ") || "—"}</div>
                  </td>
                  <td className="px-3 py-2">{r.aseguradora}</td>
                  <td className="px-3 py-2">{r.numeroSiniestro || <span className="text-ink-400">{r.numeroReporte ? `Rep. ${r.numeroReporte}` : "—"}</span>}</td>
                  <td className="px-3 py-2">{TIPO_LABEL[r.tipo]}</td>
                  <td className="px-3 py-2"><Badge className={colorEstado(r.estado)}>{ESTADO_LABEL[r.estado]}</Badge></td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtFecha(r.fechaOcurrido)}</td>
                  <td className="px-3 py-2">
                    {esAbierto(r.estado) ? (
                      <span className={atorado ? "inline-flex items-center gap-1 font-medium text-amber-700" : ""}>
                        {atorado && <AlertTriangle size={14} />}{dias} d
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2">{r.responsableId ? nombre.get(r.responsableId) ?? "—" : <span className="text-ink-400">Sin asignar</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
