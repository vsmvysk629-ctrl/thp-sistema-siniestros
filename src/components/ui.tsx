import clsx from "clsx"
import { X } from "lucide-react"
import { useEffect } from "react"
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react"
import { ESTADO_LABEL, ESTADO_TONO, type Estado, type Tono } from "@contracts/flujo"
import { TONO_CLASE, iniciales } from "@/lib/format"

export function Button({ variant = "primary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  return (
    <button
      type="button"
      {...p}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-navy-900 text-white hover:bg-navy-800",
        variant === "secondary" && "border border-line-strong bg-surface text-ink-900 hover:bg-subtle",
        variant === "danger" && "border border-tone-redBg bg-surface text-tone-red hover:bg-tone-redBg",
        variant === "ghost" && "text-ink-600 hover:bg-subtle",
        className,
      )}
    />
  )
}

const campo = "w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-ink-400 focus:border-navy-900 focus:ring-2 focus:ring-tone-blueBg"

export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx(campo, className)} />
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={clsx(campo, className)} />
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={clsx(campo, className)} />

export function Field({ label, children, className, hint }: { label: string; children: ReactNode; className?: string; hint?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
    </label>
  )
}

export function Card({ title, actions, children, className, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={clsx("rounded-card border border-line bg-surface", pad && "p-5", className)}>
      {(title || actions) && (
        <header className={clsx("mb-3 flex items-center justify-between gap-2", !pad && "px-5 pt-5")}>
          <h2 className="text-lg font-semibold">{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

export function Badge({ tono = "gray", children, className }: { tono?: Tono; children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", TONO_CLASE[tono], className)}>{children}</span>
}

export const EstadoBadge = ({ estado }: { estado: Estado }) => <Badge tono={ESTADO_TONO[estado]}>{ESTADO_LABEL[estado]}</Badge>

const AV = ["bg-tone-blueBg text-tone-blue", "bg-[#F1E4F5] text-[#6B2A80]", "bg-tone-greenBg text-tone-green", "bg-tone-orangeBg text-tone-orange"]
export function Avatar({ nombre, id = 0, grande, oscuro }: { nombre: string | null | undefined; id?: number; grande?: boolean; oscuro?: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        grande ? "h-9 w-9 text-xs" : "h-7 w-7 text-[11px]",
        oscuro ? "bg-navy-900 text-white" : AV[id % AV.length],
      )}
    >
      {iniciales(nombre)}
    </span>
  )
}

export function Kpi({ label, valor, nota, className }: { label: string; valor: ReactNode; nota?: ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-card border border-line bg-surface px-4 py-4", className)}>
      <p className="text-[13px] text-ink-600">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{valor}</p>
      {nota && <p className="mt-1 text-xs text-ink-600">{nota}</p>}
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
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#16202E]/40 p-4 sm:pt-16" onMouseDown={onClose}>
      <div className={clsx("w-full rounded-card bg-surface shadow-xl", ancho)} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-line-soft px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-900" aria-label="Cerrar"><X size={18} /></button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function ErrorBox({ error }: { error?: string | null }) {
  if (!error) return null
  return <p className="rounded-[10px] bg-tone-redBg px-3 py-2 text-sm text-tone-red">{error}</p>
}

export function Dato({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[13px] font-medium text-ink-600">{label}</dt>
      <dd className="mt-0.5 text-[15px]">{children === null || children === undefined || children === "" ? "—" : children}</dd>
    </div>
  )
}

export function PageHeader({ titulo, sub, acciones, arriba }: { titulo: ReactNode; sub?: ReactNode; acciones?: ReactNode; arriba?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {arriba && <p className="text-sm text-ink-600">{arriba}</p>}
        <h1 className="text-[28px] font-bold tracking-tight">{titulo}</h1>
        {sub && <p className="text-sm text-ink-600">{sub}</p>}
      </div>
      {acciones && <div className="no-print flex flex-wrap gap-2">{acciones}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, valor, onChange }: { tabs: { id: T; label: ReactNode }[]; valor: T; onChange: (t: T) => void }) {
  return (
    <div className="no-print mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={clsx(
            "-mb-px whitespace-nowrap border-b-[3px] px-4 py-3 text-[15px]",
            valor === t.id ? "border-navy-900 font-semibold text-ink-900" : "border-transparent text-ink-600 hover:text-ink-900",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** Tabla con encabezado gris claro, como en el prototipo. */
export function Tabla({ cols, children, vacio, className }: { cols: ReactNode[]; children: ReactNode; vacio?: string | false; className?: string }) {
  return (
    <div className={clsx("overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[13px] font-medium text-ink-600">
            {cols.map((c, i) => <th key={i} className="whitespace-nowrap px-2.5 py-2.5 font-medium">{c}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">{children}</tbody>
      </table>
      {vacio && <p className="px-2.5 py-6 text-center text-sm text-ink-400">{vacio}</p>}
    </div>
  )
}

export const Folio = ({ children }: { children: ReactNode }) => <span className="font-mono text-[13px] text-navy-900">{children}</span>
