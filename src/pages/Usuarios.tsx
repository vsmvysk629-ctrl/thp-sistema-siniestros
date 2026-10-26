import { useState } from "react"
import { ROLES, ROL_LABEL, type Rol } from "@contracts/constants"
import { trpc } from "@/providers/trpc"
import { Badge, Button, Card, ErrorBox, Field, Input, Select } from "@/components/ui"
import { errorMsg } from "@/lib/format"

export default function Usuarios() {
  const utils = trpc.useUtils()
  const lista = trpc.usuarios.list.useQuery()
  const [f, setF] = useState({ username: "", nombre: "", role: "siniestros" as Rol })
  const [temporal, setTemporal] = useState<{ username: string; password: string } | null>(null)
  const crear = trpc.usuarios.crear.useMutation({
    onSuccess: (r) => {
      setTemporal({ username: f.username, password: r.passwordTemporal })
      setF({ username: "", nombre: "", role: "siniestros" })
      utils.usuarios.invalidate()
    },
  })
  const activar = trpc.usuarios.activar.useMutation({ onSuccess: () => utils.usuarios.invalidate() })
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold">Usuarios</h1>
      <Card title="Nuevo usuario">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Usuario"><Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
          <Field label="Nombre"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Field>
          <Field label="Rol">
            <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Rol })}>
              {ROLES.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
            </Select>
          </Field>
        </div>
        <div className="mt-3"><ErrorBox error={crear.error && errorMsg(crear.error)} /></div>
        {temporal && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Contraseña temporal de <b>{temporal.username}</b>: <code className="font-mono">{temporal.password}</code>. Se muestra una sola vez; deberá cambiarla al entrar.
          </p>
        )}
        <div className="mt-3 flex justify-end">
          <Button disabled={!f.username || !f.nombre || crear.isPending} onClick={() => crear.mutate(f)}>Crear</Button>
        </div>
      </Card>
      <Card title="Usuarios">
        <ul className="divide-y divide-line">
          {lista.data?.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div>
                <p className="font-medium">{u.nombre} <span className="text-ink-400">@{u.username}</span></p>
                <p className="text-xs text-ink-600">{ROL_LABEL[u.role]}</p>
              </div>
              <div className="flex items-center gap-2">
                {!u.activo && <Badge className="bg-slate-100 text-slate-600">Inactivo</Badge>}
                <Button variant="secondary" onClick={() => activar.mutate({ id: u.id, activo: !u.activo })}>{u.activo ? "Desactivar" : "Activar"}</Button>
              </div>
            </li>
          ))}
        </ul>
        <ErrorBox error={activar.error && errorMsg(activar.error)} />
      </Card>
    </div>
  )
}
