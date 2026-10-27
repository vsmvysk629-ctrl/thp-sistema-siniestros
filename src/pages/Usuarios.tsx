import { useState, type FormEvent } from "react"
import { ROLES, ROL_LABEL, type Rol } from "@contracts/constants"
import type { Tono } from "@contracts/flujo"
import { trpc } from "@/providers/trpc"
import { Avatar, Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Select, Tabla } from "@/components/ui"
import { errorMsg, fmtFecha } from "@/lib/format"
import { useSesion } from "@/lib/sesion"

/** Lo que el sistema permite a cada rol (así lo aplica la API). */
const PERMISOS: [string, string, string, string][] = [
  ["Ver siniestros, contratantes y tablero", "Sí", "Sí", "Sí"],
  ["Crear siniestros", "Sí", "Sí (a su cargo)", "No"],
  ["Editar datos y cambiar estatus", "Sí", "Solo los suyos", "No"],
  ["Documentos, conceptos y terceros", "Sí", "Solo los suyos", "No"],
  ["Registrar pagos (con referencia)", "Sí", "Solo los suyos", "No"],
  ["Agregar notas a la bitácora", "Sí", "Sí", "No"],
  ["Reasignar responsable", "Sí", "No", "No"],
  ["Contratantes y pólizas", "Sí", "Sí", "No"],
  ["Ver reportes y exportar", "Sí", "Sí", "Sí"],
  ["Administrar usuarios", "Sí", "No", "No"],
]
const tonoPermiso = (v: string): Tono => (v === "Sí" ? "green" : v === "No" ? "gray" : "blue")

export default function Usuarios() {
  const { usuario } = useSesion()
  const utils = trpc.useUtils()
  const lista = trpc.usuarios.list.useQuery()
  const [nuevo, setNuevo] = useState(false)
  const editar = trpc.usuarios.editar.useMutation({ onSuccess: () => utils.usuarios.invalidate() })
  return (
    <>
      <PageHeader titulo="Usuarios y permisos" sub="Cada siniestro tiene un responsable; todo cambio queda registrado" acciones={<Button onClick={() => setNuevo(true)}>+ Nuevo usuario</Button>} />
      <Card pad={false} className="px-3 py-2">
        <Tabla cols={["Usuario", "Puesto", "Rol", "Siniestros abiertos a cargo", "Último acceso", ""]}>
          {lista.data?.map((u) => (
            <tr key={u.id} className={u.activo ? "" : "opacity-60"}>
              <td className="px-2.5 py-3">
                <span className="flex items-center gap-2.5">
                  <Avatar nombre={u.nombre} id={u.id} oscuro={u.role === "admin"} />
                  <span><span className="font-semibold">{u.nombre}</span><span className="block text-xs text-ink-600">@{u.username}</span></span>
                </span>
              </td>
              <td className="px-2.5 py-3">{u.puesto ?? "—"}</td>
              <td className="px-2.5 py-3">
                <select
                  value={u.role}
                  disabled={u.id === usuario.id || editar.isPending}
                  onChange={(e) => editar.mutate({ id: u.id, role: e.target.value as Rol })}
                  className="rounded-full border-0 bg-tone-blueBg px-2.5 py-1 text-xs font-medium text-tone-blue"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
                </select>
              </td>
              <td className="px-2.5 py-3">{u.role === "admin" ? "Supervisa todos" : u.role === "consulta" ? "—" : u.abiertos}</td>
              <td className="px-2.5 py-3 text-ink-600">{u.ultimoAcceso ? fmtFecha(u.ultimoAcceso, true) : "Nunca"}</td>
              <td className="px-2.5 py-3 text-right">
                {u.id !== usuario.id && (
                  <button className="text-xs text-navy-900 hover:underline" onClick={() => editar.mutate({ id: u.id, activo: !u.activo })}>
                    {u.activo ? "Desactivar" : "Activar"}
                  </button>
                )}
                {!u.activo && <Badge className="ml-2">Inactivo</Badge>}
              </td>
            </tr>
          ))}
        </Tabla>
        <ErrorBox error={editar.error && errorMsg(editar.error)} />
      </Card>

      <Card title="Permisos por rol" className="mt-5">
        <Tabla cols={["Permiso", "Administrador", "Ejecutivo", "Solo consulta"]}>
          {PERMISOS.map(([p, ...vs]) => (
            <tr key={p}>
              <td className="px-2.5 py-3">{p}</td>
              {vs.map((v, i) => <td key={i} className="px-2.5 py-3"><Badge tono={tonoPermiso(v)}>{v}</Badge></td>)}
            </tr>
          ))}
        </Tabla>
      </Card>
      {nuevo && <NuevoUsuario onClose={() => setNuevo(false)} />}
    </>
  )
}

function NuevoUsuario({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils()
  const [f, setF] = useState({ username: "", nombre: "", puesto: "", role: "ejecutivo" as Rol })
  const [temporal, setTemporal] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const crear = trpc.usuarios.crear.useMutation({
    onSuccess: (r) => {
      setTemporal(r.passwordTemporal)
      utils.usuarios.invalidate()
    },
  })
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    crear.mutate(f)
  }
  return (
    <Modal title="Nuevo usuario" onClose={onClose}>
      {temporal ? (
        <div className="space-y-4">
          <p className="rounded-[10px] bg-tone-greenBg px-3 py-3 text-sm text-tone-green">
            Contraseña temporal de <b>{f.username}</b>: <code className="font-mono text-base">{temporal}</code>
            <br />Se muestra una sola vez. Al entrar, el sistema le pedirá cambiarla.
          </p>
          <div className="flex justify-end"><Button onClick={onClose}>Listo</Button></div>
        </div>
      ) : (
        <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre completo" className="sm:col-span-2"><Input value={f.nombre} onChange={set("nombre")} required /></Field>
          <Field label="Usuario" hint="Con el que inicia sesión."><Input value={f.username} onChange={set("username")} required /></Field>
          <Field label="Rol">
            <Select value={f.role} onChange={set("role")}>{ROLES.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}</Select>
          </Field>
          <Field label="Puesto" className="sm:col-span-2"><Input value={f.puesto} onChange={set("puesto")} placeholder="Ej. Ejecutiva de siniestros" /></Field>
          <div className="sm:col-span-2"><ErrorBox error={crear.error && errorMsg(crear.error)} /></div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={crear.isPending}>Crear usuario</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
