import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router"
import { Bell, ChartNoAxesColumn, FileText, LayoutGrid, LogOut, Plus, Search, Settings2, ShieldCheck, Users } from "lucide-react"
import clsx from "clsx"
import { ROL_LABEL } from "@contracts/constants"
import { trpc } from "@/providers/trpc"
import { Avatar, Button, ErrorBox, Field, Input } from "@/components/ui"
import { errorMsg } from "@/lib/format"
import { SesionContext, esEditor, guardarPreferencia, leerPreferencia, useSesion, type Usuario, type Vista } from "@/lib/sesion"
import NuevoSiniestro from "@/components/NuevoSiniestro"
import Tablero from "@/pages/Tablero"
import Siniestros from "@/pages/Siniestros"
import Expediente from "@/pages/Expediente"
import Contratantes from "@/pages/Contratantes"
import Contratante from "@/pages/Contratante"
import Reportes from "@/pages/Reportes"
import Usuarios from "@/pages/Usuarios"
import Configuracion from "@/pages/Configuracion"

const ICONO = { size: 17, strokeWidth: 1.6 }

export default function App() {
  const me = trpc.auth.me.useQuery(undefined, { retry: false })
  const [nuevo, setNuevo] = useState<{ contratanteId?: number } | null>(null)
  if (me.isLoading) return <Cargando />
  if (!me.data) return <Login />
  if (me.data.debeCambiarPassword) return <CambiarPassword />
  return <ConSesion u={me.data} nuevo={nuevo} setNuevo={setNuevo} />
}

function ConSesion({ u, nuevo, setNuevo }: { u: Usuario; nuevo: { contratanteId?: number } | null; setNuevo: (n: { contratanteId?: number } | null) => void }) {
  const clave = `thp-vista-${u.id}`
  const [vista, setVistaState] = useState<Vista>(() => leerPreferencia<Vista>(clave, u.role === "ejecutivo" ? "mios" : "todos"))
  const setVista = (v: Vista) => {
    setVistaState(v)
    guardarPreferencia(clave, v)
  }
  // Atajo: "n" abre un siniestro nuevo.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !["INPUT", "TEXTAREA", "SELECT"].includes(tag) && esEditor(u)) setNuevo({})
    }
    window.addEventListener("keydown", k)
    return () => window.removeEventListener("keydown", k)
  }, [u, setNuevo])
  return (
    <SesionContext.Provider value={{ usuario: u, nuevoSiniestro: (contratanteId) => setNuevo({ contratanteId }), vista, setVista }}>
      <div className="min-h-screen lg:flex">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Topbar />
          <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-8 lg:px-10">
            <EncabezadoImpresion />
            <Routes>
              <Route path="/" element={<Tablero />} />
              <Route path="/siniestros" element={<Siniestros />} />
              <Route path="/siniestros/:id" element={<Expediente />} />
              <Route path="/contratantes" element={<Contratantes />} />
              <Route path="/contratantes/:id" element={<Contratante />} />
              <Route path="/reportes" element={<Reportes />} />
              {u.role === "admin" && <Route path="/usuarios" element={<Usuarios />} />}
              {u.role === "admin" && <Route path="/configuracion" element={<Configuracion />} />}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
      {nuevo && esEditor(u) && <NuevoSiniestro contratanteId={nuevo.contratanteId} onClose={() => setNuevo(null)} />}
    </SesionContext.Provider>
  )
}

function Cargando() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <img src="/logo-thp-simbolo.png" alt="" className="h-10 animate-pulse opacity-70" />
    </div>
  )
}

/** Solo aparece al imprimir o exportar a PDF. */
function EncabezadoImpresion() {
  return (
    <div className="mb-6 hidden items-center justify-between border-b border-line pb-4 print:flex">
      <img src="/logo-thp.png" alt="THP Seguros" className="h-10" />
      <p className="text-[11px] text-ink-400">Sistema de siniestros · impreso el {new Date().toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}</p>
    </div>
  )
}

function Sidebar() {
  const { usuario: u, nuevoSiniestro, vista } = useSesion()
  const t = trpc.tablero.resumen.useQuery({ soloMios: vista === "mios" })
  const utils = trpc.useUtils()
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => utils.invalidate() })
  return (
    <aside className="no-print flex flex-col border-b border-line bg-surface lg:sticky lg:top-0 lg:h-screen lg:w-[232px] lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-2 px-5 pb-6 pt-6">
        <img src="/logo-thp.png" alt="THP Seguros" className="h-9 w-auto lg:h-11" />
      </div>
      {esEditor(u) && (
        <div className="px-3 pb-5">
          <button onClick={() => nuevoSiniestro()} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-ink-900 text-[13px] font-medium text-white transition-colors hover:bg-navy-800">
            <Plus size={15} strokeWidth={2} /> Nuevo siniestro
            <kbd className="ml-1 hidden rounded border border-white/20 px-1 font-mono text-[10px] text-white/60 lg:inline">N</kbd>
          </button>
        </div>
      )}
      <p className="hidden px-5 pb-2 text-[11px] font-medium uppercase tracking-[0.09em] text-ink-400 lg:block">Siniestros</p>
      <nav className="flex gap-0.5 overflow-x-auto px-3 pb-3 lg:flex-col">
        <Item to="/" icon={<LayoutGrid {...ICONO} />} n={t.data?.alertas.length}>Tablero</Item>
        <Item to="/siniestros" icon={<FileText {...ICONO} />} n={t.data?.kpis.abiertos}>Siniestros</Item>
        <Item to="/contratantes" icon={<Users {...ICONO} />}>Contratantes</Item>
        <Item to="/reportes" icon={<ChartNoAxesColumn {...ICONO} />}>Reportes</Item>
        {u.role === "admin" && (
          <>
            <p className="hidden px-2 pb-2 pt-5 text-[11px] font-medium uppercase tracking-[0.09em] text-ink-400 lg:block">Administración</p>
            <Item to="/usuarios" icon={<ShieldCheck {...ICONO} />}>Usuarios y permisos</Item>
            <Item to="/configuracion" icon={<Settings2 {...ICONO} />}>Configuración</Item>
          </>
        )}
      </nav>
      <div className="mt-auto hidden border-t border-line px-4 py-4 lg:block">
        <div className="flex items-center gap-2.5">
          <Avatar nombre={u.nombre} grande oscuro />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-medium">{u.nombre}</p>
            <p className="text-[12px] text-ink-400">{ROL_LABEL[u.role]}</p>
          </div>
          <button onClick={() => logout.mutate()} className="rounded-md p-1.5 text-ink-400 hover:bg-subtle hover:text-ink-900" title="Salir" aria-label="Salir"><LogOut size={16} strokeWidth={1.6} /></button>
        </div>
        <p className="mt-4 font-display text-[11px] font-light italic text-ink-400">“Asesorar para decidir”</p>
      </div>
    </aside>
  )
}

function Item({ to, icon, n, children }: { to: string; icon: ReactNode; n?: number; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        clsx(
          "relative flex items-center gap-2.5 whitespace-nowrap rounded-[9px] px-2.5 py-2 text-[13.5px] transition-colors",
          isActive ? "bg-subtle font-medium text-ink-900 lg:before:absolute lg:before:-left-3 lg:before:top-2 lg:before:h-5 lg:before:w-[2px] lg:before:rounded-full lg:before:bg-thp" : "text-ink-600 hover:bg-subtle/70 hover:text-ink-900",
        )
      }
    >
      {icon}
      <span className="flex-1">{children}</span>
      {!!n && <span className="font-mono text-[11px] text-ink-400">{n}</span>}
    </NavLink>
  )
}

function Topbar() {
  const nav = useNavigate()
  const [q, setQ] = useState("")
  const ref = useRef<HTMLInputElement>(null)
  const { vista } = useSesion()
  const t = trpc.tablero.resumen.useQuery({ soloMios: vista === "mios" })
  // Atajo: "/" enfoca la búsqueda.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener("keydown", k)
    return () => window.removeEventListener("keydown", k)
  }, [])
  const buscar = (e: FormEvent) => {
    e.preventDefault()
    nav(`/siniestros?q=${encodeURIComponent(q.trim())}&estado=todos`)
    ref.current?.blur()
  }
  const alertas = t.data?.alertas.length ?? 0
  return (
    <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-canvas/80 px-4 py-3 backdrop-blur-md lg:px-10">
      <form onSubmit={buscar} className="relative max-w-[460px] flex-1">
        <Search size={15} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          ref={ref}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar folio, contratante, asegurado o póliza"
          className="h-9 w-full rounded-[10px] border border-line bg-surface pl-9 pr-10 text-[13px] outline-none transition placeholder:text-ink-400 focus:border-thp focus:ring-4 focus:ring-thp/10"
        />
        <kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 font-mono text-[10px] text-ink-400 sm:block">/</kbd>
      </form>
      <button onClick={() => nav("/")} className="relative ml-auto flex h-9 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink-600 hover:text-ink-900" aria-label="Alertas">
        <Bell size={15} strokeWidth={1.75} />
        <span className="hidden sm:inline">Alertas</span>
        {alertas > 0 && <span className="rounded-full bg-sev-alta px-1.5 font-mono text-[10px] font-medium text-white">{alertas}</span>}
      </button>
    </header>
  )
}

function Pantalla({ titulo, sub, children }: { titulo: string; sub: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <img src="/logo-thp.png" alt="THP Seguros" className="h-14 w-auto self-start" />
        <div className="my-auto w-full max-w-[360px] py-12">
          <h1 className="text-[28px] font-medium leading-tight">{titulo}</h1>
          <p className="mb-8 mt-2 text-[13px] text-ink-600">{sub}</p>
          {children}
        </div>
        <p className="text-[11px] text-ink-400">THP Seguros · Sistema de siniestros</p>
      </div>
      <div className="relative hidden overflow-hidden bg-[#0B0F17] lg:block">
        {/* Retícula fina y halo con el azul del logo */}
        <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(#ffffff14_1px,transparent_1px),linear-gradient(90deg,#ffffff14_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="absolute -right-32 -top-32 h-[520px] w-[520px] rounded-full bg-thp opacity-40 blur-[120px]" />
        <div className="absolute -bottom-40 left-10 h-[420px] w-[420px] rounded-full bg-[#9A9A9A] opacity-10 blur-[120px]" />
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <img src="/segurito.png" alt="Segurito, la mascota de THP" className="mb-10 h-44 w-auto self-start drop-shadow-[0_12px_24px_rgba(0,0,0,0.35)]" />
          <p className="max-w-md font-display text-[34px] font-light leading-tight tracking-tight">Cada siniestro, de principio a fin, en un solo lugar.</p>
          <p className="mt-4 font-display text-[13px] font-light italic text-white/50">“Asesorar para decidir”</p>
        </div>
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
    <Pantalla titulo="Bienvenido" sub="Entra con tu usuario de THP Seguros.">
      <form onSubmit={enviar} className="space-y-4">
        <Field label="Usuario"><Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" /></Field>
        <Field label="Contraseña"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
        <ErrorBox error={login.error && errorMsg(login.error)} />
        <Button type="submit" className="h-10 w-full" disabled={login.isPending}>Entrar</Button>
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
    <Pantalla titulo="Nueva contraseña" sub="Tu contraseña es temporal. Elige una propia para continuar.">
      <form onSubmit={(e) => { e.preventDefault(); cambiar.mutate({ actual, nueva }) }} className="space-y-4">
        <Field label="Contraseña temporal"><Input type="password" value={actual} onChange={(e) => setActual(e.target.value)} /></Field>
        <Field label="Nueva contraseña" hint="Mínimo 10 caracteres, con letras y números."><Input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" /></Field>
        <ErrorBox error={cambiar.error && errorMsg(cambiar.error)} />
        <Button type="submit" className="h-10 w-full" disabled={cambiar.isPending}>Guardar y entrar</Button>
      </form>
    </Pantalla>
  )
}
