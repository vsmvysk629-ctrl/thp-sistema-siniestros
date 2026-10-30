import { useEffect } from "react"
import clsx from "clsx"
import { X } from "lucide-react"
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react"
import { ESTADO_LABEL, ESTADO_TONO, type Estado, type Tono } from "@contracts/flujo"
import { iniciales } from "@/lib/format"

export function Button({ variant = "primary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  return (
    <button
      type="button"
      {...p}
      className={clsx(
        "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-thp/30 disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" && "bg-ink-900 text-white hover:bg-navy-800",
        variant === "secondary" && "border border-line bg-surface text-ink-900 hover:border-line-strong hover:bg-subtle",
        variant === "danger" && "border border-line bg-surface text-tone-red hover:bg-tone-redBg",
        variant === "ghost" && "text-ink-600 hover:bg-subtle hover:text-ink-900",
        className,
      )}
    />
  )
}

const campo =
  "w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] outline-none transition placeholder:text-ink-400 hover:border-line-strong focus:border-thp focus:ring-4 focus:ring-thp/10 disabled:bg-subtle disabled:text-ink-600"

export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx(campo, className)} />
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={clsx(campo, className)} />
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={clsx(campo, className)} />

/** Etiqueta pequeña en mayúsculas para títulos de sección. */
export const Eyebrow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={clsx("text-[11px] font-medium uppercase tracking-[0.09em] text-ink-400", className)}>{children}</p>
)

export function Field({ label, children, className, hint }: { label: string; children: ReactNode; className?: string; hint?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1.5 block text-[12px] font-medium text-ink-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-ink-400">{hint}</span>}
    </label>
  )
}

export function Card({ title, actions, children, className, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={clsx("rounded-card border border-line bg-surface", pad && "p-5", className)}>
      {(title || actions) && (
        <header className={clsx("mb-4 flex items-center justify-between gap-2", !pad && "px-5 pt-5")}>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

const DOT: Record<Tono, string> = { blue: "bg-thp", orange: "bg-sev-media", green: "bg-[#2F9E68]", gray: "bg-ink-400", red: "bg-sev-alta" }

/** Etiqueta discreta: punto de color y texto. */
export function Badge({ tono = "gray", children, className }: { tono?: Tono; children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-2.5 py-0.5 text-[12px] font-medium text-ink-900", className)}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", DOT[tono])} />
      {children}
    </span>
  )
}

export const EstadoBadge = ({ estado }: { estado: Estado }) => <Badge tono={ESTADO_TONO[estado]}>{ESTADO_LABEL[estado]}</Badge>

export function Avatar({ nombre, grande, oscuro }: { nombre: string | null | undefined; id?: number; grande?: boolean; oscuro?: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium tracking-wide",
        grande ? "h-8 w-8 text-[11px]" : "h-6 w-6 text-[10px]",
        oscuro ? "bg-ink-900 text-white" : "border border-line bg-subtle text-ink-600",
      )}
    >
      {iniciales(nombre)}
    </span>
  )
}

export function Kpi({ label, valor, nota, className, acento }: { label: string; valor: ReactNode; nota?: ReactNode; className?: string; acento?: boolean }) {
  return (
    <div className={clsx("rounded-card border border-line bg-surface px-4 py-4", className)}>
      <p className="text-[12px] text-ink-600">{label}</p>
      <p className={clsx("mt-2 font-display text-[26px] font-light leading-none tracking-tight tabular-nums", acento && "text-thp")}>{valor}</p>
      {nota && <p className="mt-2 text-[12px] text-ink-400">{nota}</p>}
    </div>
  )
}

export function Modal({ title, onClose, children, ancho = "max-w-lg" }: { title: string; onClose: () => void; children: ReactNode; ancho?: string }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
  }, [onClose])
  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/20 p-4 backdrop-blur-[2px] sm:pt-16" onMouseDown={onClose}>
      <div className={clsx("w-full rounded-card border border-line bg-surface shadow-flota", ancho)} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 pb-1 pt-5">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-subtle hover:text-ink-900" aria-label="Cerrar"><X size={17} strokeWidth={1.75} /></button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function ErrorBox({ error }: { error?: string | null }) {
  if (!error) return null
  return <p className="rounded-[10px] border border-tone-redBg bg-tone-redBg/60 px-3 py-2 text-[13px] text-tone-red">{error}</p>
}

/** Aviso informativo neutro. */
export const Nota = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={clsx("rounded-[10px] border border-line bg-thp-soft/60 px-3 py-2 text-[13px] text-ink-600", className)}>{children}</p>
)

export function Dato({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[12px] text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-[14px]">{children === null || children === undefined || children === "" ? <span className="text-ink-400">—</span> : children}</dd>
    </div>
  )
}

export function PageHeader({ titulo, sub, acciones, arriba }: { titulo: ReactNode; sub?: ReactNode; acciones?: ReactNode; arriba?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div>
        {arriba && <Eyebrow className="mb-1.5">{arriba}</Eyebrow>}
        <h1 className="text-[26px] font-medium leading-tight">{titulo}</h1>
        {sub && <p className="mt-1 text-[13px] text-ink-600">{sub}</p>}
      </div>
      {acciones && <div className="no-print flex flex-wrap gap-2">{acciones}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, valor, onChange }: { tabs: { id: T; label: ReactNode }[]; valor: T; onChange: (t: T) => void }) {
  return (
    <div className="no-print mb-5 inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[12px] border border-line bg-surface p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={clsx(
            "whitespace-nowrap rounded-[9px] px-3.5 py-1.5 text-[13px] transition-colors",
            valor === t.id ? "bg-ink-900 font-medium text-white" : "text-ink-600 hover:bg-subtle hover:text-ink-900",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** Tabla de líneas finas. */
export function Tabla({ cols, children, vacio, className }: { cols: ReactNode[]; children: ReactNode; vacio?: string | false; className?: string }) {
  return (
    <div className={clsx("overflow-x-auto", className)}>
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="border-b border-line text-left">
            {cols.map((c, i) => <th key={i} className="whitespace-nowrap px-3 pb-2.5 pt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-400">{c}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">{children}</tbody>
      </table>
      {vacio && <p className="px-3 py-8 text-center text-[13px] text-ink-400">{vacio}</p>}
    </div>
  )
}

export const Folio = ({ children }: { children: ReactNode }) => <span className="whitespace-nowrap font-mono text-[12px] tracking-tight text-ink-600">{children}</span>

/** Barra de progreso delgada. */
export const Barra = ({ pct, className }: { pct: number; className?: string }) => (
  <div className="h-1 rounded-full bg-line-soft">
    <div className={clsx("h-1 rounded-full", className ?? "bg-ink-900")} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
  </div>
)

/** Control segmentado de dos o más opciones. */
export function Segmento<T extends string>({ opciones, valor, onChange }: { opciones: { id: T; label: ReactNode }[]; valor: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex h-9 items-center rounded-[10px] border border-line bg-surface p-0.5">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={clsx("h-full rounded-[8px] px-3 text-[12.5px] transition-colors", valor === o.id ? "bg-subtle font-medium text-ink-900" : "text-ink-400 hover:text-ink-900")}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
