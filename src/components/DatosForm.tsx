import { RESPONSABILIDADES, RESPONSABILIDAD_LABEL, TIPOS, TIPO_LABEL, type Responsabilidad, type TipoSiniestro } from "@contracts/flujo"
import { trpc } from "@/providers/trpc"
import { Field, Input, Select, Textarea } from "@/components/ui"

export type Datos = {
  numeroReporte: string
  numeroSiniestro: string
  ajustadorNombre: string
  ajustadorTelefono: string
  tipo: TipoSiniestro
  fechaOcurrido: string
  lugar: string
  descripcion: string
  conductorNombre: string
  responsabilidad: Responsabilidad
  tallerNombre: string
  deducible: string
  montoEstimado: string
  responsableId: number | null
}

export const datosVacios = (): Datos => ({
  numeroReporte: "", numeroSiniestro: "", ajustadorNombre: "", ajustadorTelefono: "",
  tipo: "colision", fechaOcurrido: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
  lugar: "", descripcion: "", conductorNombre: "", responsabilidad: "por_definir",
  tallerNombre: "", deducible: "", montoEstimado: "", responsableId: null,
})

export function DatosForm({ datos, onChange, conResponsable }: { datos: Datos; onChange: (d: Datos) => void; conResponsable: boolean }) {
  const usuarios = trpc.catalogos.usuarios.useQuery(undefined, { enabled: conResponsable })
  const set = <K extends keyof Datos>(k: K, v: Datos[K]) => onChange({ ...datos, [k]: v })
  const txt = (k: keyof Datos) => ({ value: String(datos[k] ?? ""), onChange: (e: { target: { value: string } }) => set(k, e.target.value as never) })
  return (
    <div className="space-y-4">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">El hecho</legend>
        <Field label="Tipo">
          <Select value={datos.tipo} onChange={(e) => set("tipo", e.target.value as TipoSiniestro)}>
            {TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
          </Select>
        </Field>
        <Field label="Fecha y hora"><Input type="datetime-local" {...txt("fechaOcurrido")} /></Field>
        <Field label="Lugar" className="sm:col-span-2"><Input {...txt("lugar")} placeholder="Calle, colonia, ciudad" /></Field>
        <Field label="Conductor"><Input {...txt("conductorNombre")} /></Field>
        <Field label="Responsabilidad">
          <Select value={datos.responsabilidad} onChange={(e) => set("responsabilidad", e.target.value as Responsabilidad)}>
            {RESPONSABILIDADES.map((r) => <option key={r} value={r}>{RESPONSABILIDAD_LABEL[r]}</option>)}
          </Select>
        </Field>
        <Field label="Descripción" className="sm:col-span-2"><Textarea rows={3} {...txt("descripcion")} /></Field>
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Aseguradora</legend>
        <Field label="Nº de reporte (cabina)"><Input {...txt("numeroReporte")} /></Field>
        <Field label="Nº de siniestro"><Input {...txt("numeroSiniestro")} /></Field>
        <Field label="Ajustador"><Input {...txt("ajustadorNombre")} /></Field>
        <Field label="Teléfono del ajustador"><Input {...txt("ajustadorTelefono")} inputMode="tel" /></Field>
        <Field label="Taller o agencia"><Input {...txt("tallerNombre")} /></Field>
        <Field label="Deducible ($)"><Input {...txt("deducible")} inputMode="decimal" placeholder="0.00" /></Field>
        <Field label="Monto estimado ($)" hint="Estimación propia; el monto autorizado lo da la aseguradora."><Input {...txt("montoEstimado")} inputMode="decimal" placeholder="0.00" /></Field>
        {conResponsable && (
          <Field label="Responsable en la oficina">
            <Select value={datos.responsableId ?? ""} onChange={(e) => set("responsableId", e.target.value ? Number(e.target.value) : null)}>
              <option value="">Sin asignar</option>
              {usuarios.data?.filter((u) => u.role !== "vendedor").map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </Select>
          </Field>
        )}
      </fieldset>
    </div>
  )
}

/** Convierte el formulario al formato de la API (vacíos → null). */
export function aApi(d: Datos) {
  const n = (v: string) => v.trim() || null
  return {
    numeroReporte: n(d.numeroReporte),
    numeroSiniestro: n(d.numeroSiniestro),
    ajustadorNombre: n(d.ajustadorNombre),
    ajustadorTelefono: n(d.ajustadorTelefono),
    tipo: d.tipo,
    fechaOcurrido: d.fechaOcurrido.replace("T", " "),
    lugar: n(d.lugar),
    descripcion: n(d.descripcion),
    conductorNombre: n(d.conductorNombre),
    responsabilidad: d.responsabilidad,
    tallerNombre: n(d.tallerNombre),
    deducible: n(d.deducible.replace(/[$,\s]/g, "")),
    montoEstimado: n(d.montoEstimado.replace(/[$,\s]/g, "")),
    responsableId: d.responsableId,
  }
}
