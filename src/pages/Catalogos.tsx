import { useState } from "react"
import { Plus } from "lucide-react"
import { trpc } from "@/providers/trpc"
import { Button, ErrorBox, Field, Input, Modal, Select } from "@/components/ui"
import { errorMsg, fmtFecha } from "@/lib/format"

export default function Catalogos() {
  const [busqueda, setBusqueda] = useState("")
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const [nuevaPoliza, setNuevaPoliza] = useState(false)
  const polizas = trpc.catalogos.polizas.useQuery({ busqueda: busqueda || undefined })
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Clientes y pólizas de autos</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setNuevoCliente(true)}><Plus size={16} /> Cliente</Button>
          <Button onClick={() => setNuevaPoliza(true)}><Plus size={16} /> Póliza</Button>
        </div>
      </div>
      <p className="text-sm text-ink-600">Captura aquí solo lo necesario para dar seguimiento a siniestros. La cartera completa sigue en SIGA.</p>
      <Input placeholder="Buscar por cliente, póliza, placas o serie" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line text-left text-xs text-ink-400">
            <tr>{["Póliza", "Aseguradora", "Cliente", "Vehículo", "Placas", "Vigencia"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {polizas.data?.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-400">Sin pólizas.</td></tr>}
            {polizas.data?.map(({ poliza: p, cliente, aseguradora }) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2 font-medium">{p.numero}</td>
                <td className="px-3 py-2">{aseguradora.nombre}</td>
                <td className="px-3 py-2">{cliente.nombre}</td>
                <td className="px-3 py-2">{[p.vehiculoMarca, p.vehiculoModelo, p.vehiculoAnio].filter(Boolean).join(" ") || "—"}</td>
                <td className="px-3 py-2">{p.vehiculoPlacas || "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{p.vigenciaFin ? `hasta ${fmtFecha(p.vigenciaFin)}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nuevoCliente && <NuevoCliente onClose={() => setNuevoCliente(false)} />}
      {nuevaPoliza && <NuevaPoliza onClose={() => setNuevaPoliza(false)} />}
    </div>
  )
}

function NuevoCliente({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils()
  const usuarios = trpc.catalogos.usuarios.useQuery()
  const [f, setF] = useState({ nombre: "", telefono: "", email: "", vendedorId: "" })
  const m = trpc.catalogos.crearCliente.useMutation({ onSuccess: () => { utils.catalogos.invalidate(); onClose() } })
  return (
    <Modal title="Nuevo cliente" onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre" className="sm:col-span-2"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoFocus /></Field>
        <Field label="Teléfono"><Input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></Field>
        <Field label="Correo"><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Vendedor" className="sm:col-span-2" hint="El vendedor solo verá los siniestros de sus clientes.">
          <Select value={f.vendedorId} onChange={(e) => setF({ ...f, vendedorId: e.target.value })}>
            <option value="">Directo (sin vendedor)</option>
            {usuarios.data?.filter((u) => u.role === "vendedor").map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </Select>
        </Field>
      </div>
      <div className="mt-3"><ErrorBox error={m.error && errorMsg(m.error)} /></div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button
          disabled={!f.nombre.trim() || m.isPending}
          onClick={() => m.mutate({ nombre: f.nombre, telefono: f.telefono, email: f.email, vendedorId: f.vendedorId ? Number(f.vendedorId) : null })}
        >
          Guardar
        </Button>
      </div>
    </Modal>
  )
}

function NuevaPoliza({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils()
  const clientes = trpc.catalogos.clientes.useQuery({})
  const aseguradoras = trpc.catalogos.aseguradoras.useQuery()
  const [f, setF] = useState({
    numero: "", aseguradoraId: "", clienteId: "", vigenciaInicio: "", vigenciaFin: "", cobertura: "amplia",
    vehiculoMarca: "", vehiculoModelo: "", vehiculoAnio: "", vehiculoPlacas: "", vehiculoSerie: "",
  })
  const m = trpc.catalogos.crearPoliza.useMutation({ onSuccess: () => { utils.catalogos.invalidate(); onClose() } })
  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) })
  const listo = f.numero.trim() && f.aseguradoraId && f.clienteId
  return (
    <Modal title="Nueva póliza de autos" onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cliente" className="sm:col-span-2">
          <Select {...campo("clienteId")}>
            <option value="">Elige…</option>
            {clientes.data?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select>
        </Field>
        <Field label="Aseguradora">
          <Select {...campo("aseguradoraId")}>
            <option value="">Elige…</option>
            {aseguradoras.data?.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </Select>
        </Field>
        <Field label="Número de póliza"><Input {...campo("numero")} /></Field>
        <Field label="Inicio de vigencia"><Input type="date" {...campo("vigenciaInicio")} /></Field>
        <Field label="Fin de vigencia"><Input type="date" {...campo("vigenciaFin")} /></Field>
        <Field label="Cobertura">
          <Select {...campo("cobertura")}>
            <option value="amplia">Amplia</option>
            <option value="limitada">Limitada</option>
            <option value="rc">Responsabilidad civil</option>
          </Select>
        </Field>
        <Field label="Marca"><Input {...campo("vehiculoMarca")} /></Field>
        <Field label="Modelo"><Input {...campo("vehiculoModelo")} /></Field>
        <Field label="Año"><Input {...campo("vehiculoAnio")} inputMode="numeric" /></Field>
        <Field label="Placas"><Input {...campo("vehiculoPlacas")} /></Field>
        <Field label="Número de serie"><Input {...campo("vehiculoSerie")} /></Field>
      </div>
      <div className="mt-3"><ErrorBox error={m.error && errorMsg(m.error)} /></div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button
          disabled={!listo || m.isPending}
          onClick={() =>
            m.mutate({
              ...f,
              aseguradoraId: Number(f.aseguradoraId),
              clienteId: Number(f.clienteId),
              cobertura: f.cobertura as "amplia" | "limitada" | "rc",
              vehiculoAnio: f.vehiculoAnio ? Number(f.vehiculoAnio) : null,
            })
          }
        >
          Guardar
        </Button>
      </div>
    </Modal>
  )
}
