import { useState, type FormEvent, type ReactNode } from "react"
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router"
import { Bell, ChartColumn, FileText, LayoutGrid, Lock, LogOut, Plus, Search, Users } from "lucide-react"
import clsx from "clsx"
import { ROL_LABEL } from "@contracts/constants"
import { trpc } from "@/providers/trpc"
import { Avatar, Button, ErrorBox, Field, Input } from "@/components/ui"
import { errorMsg } from "@/lib/format"
import { SesionContext, esEditor, useSesion } from "@/lib/sesion"
import NuevoSiniestro from "@/components/NuevoSiniestro"
import Tablero from "@/pages/Tablero"
import Siniestros from "@/pages/Siniestros"
import Expediente from "@/pages/Expediente"
import Contratantes from "@/pages/Contratantes"
import Contratante from "@/pages/Contratante"
import Reportes from "@/pages/Reportes"
import Usuarios from "@/pages/Usuarios"

export default function App() {
  const me = trpc.auth.me.useQuery(undefined, { retry: false })
  const [nuevo, setNuevo] = useState<{ contratanteId?: number } | null>(null)
  if (me.isLoading) return <p className="p-8 text-sm text-ink-400">Cargando…</p>
  if (!me.data) return <Login />
  if (me.data.debeCambiarPassword) return <CambiarPassword />
  const u = me.data
  return (
    <SesionContext.Provider value={{ usuario: u, nuevoSiniestro: (contratanteId) => setNuevo({ contratanteId }) }}>
      <div className="min-h-screen lg:flex lg:bg-[linear-gradient(to_right,#1F3B63_220px,transparent_220px)] print:bg-none">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Topbar />
          <main className="mx-auto max-w-[1240px] px-4 py-6 lg:px-8">
            <Routes>
              <Route path="/" element={<Tablero />} />
              <Route path="/siniestros" element={<Siniestros />} />
              <Route path="/siniestros/:id" element={<Expediente />} />
              <Route path="/contratantes" element={<Contratantes />} />
              <Route path="/contratantes/:id" element={<Contratante />} />
              <Route path="/reportes" element={<Reportes />} />
              {u.role === "admin" && <Route path="/usuarios" element={<Usuarios />} />}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
      {nuevo && esEditor(u) && <NuevoSiniestro contratanteId={nuevo.contratanteId} onClose={() => setNuevo(null)} />}
    </SesionContext.Provider>
  )
}

function Sidebar() {
  const me = trpc.auth.me.useQuery()
  const u = me.data!
  const t = trpc.tablero.resumen.useQuery()
  return (
    <aside className="no-print flex flex-col bg-navy-900 text-navy-200 lg:sticky lg:top-0 lg:h-screen lg:w-[220px] lg:shrink-0">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-white text-sm font-bold text-navy-900">THP</span>
        <div>
          <p className="font-semibold text-white">THP Siniestros</p>
          <p className="text-xs">Sistema integral</p>
        </div>
      </div>
      {esEditor(u) && <BotonNuevo />}
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col">
        <Item to="/" icon={<LayoutGrid size={18} />} n={t.data?.alertas.length}>Tablero</Item>
        <Item to="/siniestros" icon={<FileText size={18} />} n={t.data?.kpis.abiertos}>Siniestros</Item>
        <Item to="/contratantes" icon={<Users size={18} />}>Contratantes</Item>
        <Item to="/reportes" icon={<ChartColumn size={18} />}>Reportes</Item>
        {u.role === "admin" && <Item to="/usuarios" icon={<Lock size={18} />}>Usuarios y permisos</Item>}
      </nav>
      <div className="mt-auto hidden border-t border-navy-800 px-5 py-4 text-xs lg:block">Datos de prueba ficticios mientras no se cargue la cartera real.</div>
    </aside>
  )
}

function BotonNuevo() {
  const { nuevoSiniestro } = useSesion()
  return (
    <div className="px-3 pb-4">
      <button onClick={() => nuevoSiniestro()} className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-white py-2.5 text-sm font-semibold text-navy-900 hover:bg-tone-blueBg">
        <Plus size={16} /> Nuevo siniestro
      </button>
    </div>
  )
}

function Item({ to, icon, n, children }: { to: string; icon: ReactNode; n?: number; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        clsx("flex items-center gap-3 whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[15px]", isActive ? "bg-navy-800 font-semibold text-white" : "hover:bg-navy-800")
      }
    >
      {icon}
      <span className="flex-1">{children}</span>
      {!!n && <span className="rounded-full bg-navy-600 px-2 text-[11px] font-semibold text-white">{n}</span>}
    </NavLink>
  )
}

function Topbar() {
  const nav = useNavigate()
  const [q, setQ] = useState("")
  const me = trpc.auth.me.useQuery()
  const t = trpc.tablero.resumen.useQuery()
  const utils = trpc.useUtils()
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => utils.invalidate() })
  const u = me.data!
  const buscar = (e: FormEvent) => {
    e.preventDefault()
    nav(`/siniestros?q=${encodeURIComponent(q.trim())}`)
  }
  return (
    <header className="no-print flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:px-8">
      <form onSubmit={buscar} className="relative max-w-[520px] flex-1">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar folio, contratante o asegurado…" className="w-full rounded-[10px] border border-line-strong py-2.5 pl-10 pr-3 text-sm outline-none focus:border-navy-900" />
      </form>
      <div className="ml-auto flex items-center gap-3">
        <button onClick={() => nav("/")} className="relative rounded-[10px] border border-line p-2.5 text-ink-900 hover:bg-subtle" aria-label="Alertas">
          <Bell size={18} />
          {!!t.data?.alertas.length && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-sev-alta px-1.5 text-[10px] font-semibold text-white">{t.data.alertas.length}</span>}
        </button>
        <Avatar nombre={u.nombre} grande oscuro />
        <div className="hidden text-sm leading-tight sm:block">
          <p className="font-semibold">{u.nombre}</p>
          <p className="text-ink-600">{ROL_LABEL[u.role]}</p>
        </div>
        <button onClick={() => logout.mutate()} className="rounded-[10px] p-2 text-ink-600 hover:bg-subtle" title="Salir" aria-label="Salir"><LogOut size={18} /></button>
      </div>
    </header>
  )
}

function Pantalla({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-navy-900 text-sm font-bold text-white">THP</span>
          <div>
            <p className="font-semibold">THP Siniestros</p>
            <p className="text-xs text-ink-600">{titulo}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function Login() {
  const utils = trpc.useUtils()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const login = trpc.auth.login.useMutation({ onSuccess: () => utils.invalidate() })
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    login.mutate({ username, password })
  }
  return (
    <Pantalla titulo="Inicia sesión">
      <form onSubmit={enviar} className="space-y-3">
        <Field label="Usuario"><Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" /></Field>
        <Field label="Contraseña"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
        <ErrorBox error={login.error && errorMsg(login.error)} />
        <Button type="submit" className="w-full" disabled={login.isPending}>Entrar</Button>
      </form>
    </Pantalla>
  )
}

function CambiarPassword() {
  const utils = trpc.useUtils()
  const [actual, setActual] = useState("")
  const [nueva, setNueva] = useState("")
  const cambiar = trpc.auth.cambiarPassword.useMutation({ onSuccess: () => utils.auth.me.invalidate() })
  return (
    <Pantalla titulo="Cambia tu contraseña temporal">
      <form onSubmit={(e) => { e.preventDefault(); cambiar.mutate({ actual, nueva }) }} className="space-y-3">
        <Field label="Contraseña temporal"><Input type="password" value={actual} onChange={(e) => setActual(e.target.value)} /></Field>
        <Field label="Nueva contraseña" hint="Mínimo 10 caracteres, con letras y números."><Input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" /></Field>
        <ErrorBox error={cambiar.error && errorMsg(cambiar.error)} />
        <Button type="submit" className="w-full" disabled={cambiar.isPending}>Guardar</Button>
      </form>
    </Pantalla>
  )
}
