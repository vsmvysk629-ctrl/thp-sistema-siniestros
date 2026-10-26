import { useState, type FormEvent } from "react"
import { Navigate, NavLink, Route, Routes } from "react-router"
import { CarFront, FilePlus2, LogOut, Users, BookUser } from "lucide-react"
import clsx from "clsx"
import { ROL_LABEL } from "@contracts/constants"
import { trpc } from "@/providers/trpc"
import { Button, Card, ErrorBox, Field, Input } from "@/components/ui"
import { errorMsg } from "@/lib/format"
import SiniestrosLista from "@/pages/SiniestrosLista"
import SiniestroNuevo from "@/pages/SiniestroNuevo"
import SiniestroDetalle from "@/pages/SiniestroDetalle"
import Catalogos from "@/pages/Catalogos"
import Usuarios from "@/pages/Usuarios"

export default function App() {
  const me = trpc.auth.me.useQuery(undefined, { retry: false })
  if (me.isLoading) return <p className="p-8 text-sm text-ink-400">Cargando…</p>
  if (!me.data) return <Login />
  if (me.data.debeCambiarPassword) return <CambiarPassword />
  const u = me.data
  const oficina = u.role !== "vendedor"
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-line bg-surface md:min-h-screen md:w-56 md:border-b-0 md:border-r">
        <div className="px-4 py-4">
          <p className="text-sm font-semibold text-brand-700">THP · Siniestros</p>
          <p className="text-xs text-ink-400">{u.nombre} · {ROL_LABEL[u.role]}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col">
          <Item to="/siniestros" icon={<CarFront size={16} />}>Siniestros</Item>
          <Item to="/siniestros/nuevo" icon={<FilePlus2 size={16} />}>Nuevo siniestro</Item>
          {oficina && <Item to="/catalogos" icon={<BookUser size={16} />}>Clientes y pólizas</Item>}
          {u.role === "admin" && <Item to="/usuarios" icon={<Users size={16} />}>Usuarios</Item>}
          <Salir />
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/siniestros" replace />} />
          <Route path="/siniestros" element={<SiniestrosLista />} />
          <Route path="/siniestros/nuevo" element={<SiniestroNuevo />} />
          <Route path="/siniestros/:id" element={<SiniestroDetalle puedeOperar={oficina} />} />
          {oficina && <Route path="/catalogos" element={<Catalogos />} />}
          {u.role === "admin" && <Route path="/usuarios" element={<Usuarios />} />}
          <Route path="*" element={<Navigate to="/siniestros" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function Item({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        clsx("flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm", isActive ? "bg-brand-100 font-medium text-brand-700" : "text-ink-600 hover:bg-subtle")
      }
    >
      {icon}
      {children}
    </NavLink>
  )
}

function Salir() {
  const utils = trpc.useUtils()
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => utils.invalidate() })
  return (
    <button onClick={() => logout.mutate()} className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-subtle">
      <LogOut size={16} /> Salir
    </button>
  )
}

function Login() {
  const utils = trpc.useUtils()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const login = trpc.auth.login.useMutation({ onSuccess: () => utils.auth.me.invalidate() })
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    login.mutate({ username, password })
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card title="THP · Siniestros" className="w-full max-w-sm">
        <form onSubmit={enviar} className="space-y-3">
          <Field label="Usuario"><Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" /></Field>
          <Field label="Contraseña"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
          <ErrorBox error={login.error && errorMsg(login.error)} />
          <Button className="w-full" disabled={login.isPending}>Entrar</Button>
        </form>
      </Card>
    </div>
  )
}

function CambiarPassword() {
  const utils = trpc.useUtils()
  const [actual, setActual] = useState("")
  const [nueva, setNueva] = useState("")
  const cambiar = trpc.auth.cambiarPassword.useMutation({ onSuccess: () => utils.auth.me.invalidate() })
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card title="Cambia tu contraseña temporal" className="w-full max-w-sm">
        <form onSubmit={(e) => { e.preventDefault(); cambiar.mutate({ actual, nueva }) }} className="space-y-3">
          <Field label="Contraseña temporal"><Input type="password" value={actual} onChange={(e) => setActual(e.target.value)} /></Field>
          <Field label="Nueva contraseña" hint="Mínimo 10 caracteres, con letras y números."><Input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" /></Field>
          <ErrorBox error={cambiar.error && errorMsg(cambiar.error)} />
          <Button className="w-full" disabled={cambiar.isPending}>Guardar</Button>
        </form>
      </Card>
    </div>
  )
}
