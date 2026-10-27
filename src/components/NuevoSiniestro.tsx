import { useEffect, useState, type FormEvent } from "react"
import { useNavigate } from "react-router"
import { RAMOS, RAMO_LABEL, TIPOS, documentosPara, type Ramo } from "@contracts/catalogos"
import { trpc } from "@/providers/trpc"
import { Button, ErrorBox, Field, Input, Modal, Select, Textarea } from "@/components/ui"
import { errorMsg, hoyISO } from "@/lib/format"
import { useSesion } from "@/lib/sesion"

export default function NuevoSiniestro({ contratanteId, onClose }: { contratanteId?: number; onClose: () => void }) {
  const { usuario } = useSesion()
  const nav = useNavigate()
  const utils = trpc.useUtils()
  const contratantes = trpc.catalogos.contratantes.useQuery({})
  const aseguradoras = trpc.catalogos.aseguradoras.useQuery()
  const usuarios = trpc.catalogos.usuarios.useQuery()
  const [f, setF] = useState({
    contratanteId: contratanteId ? String(contratanteId) : "",
    polizaId: "",
    polizaTexto: "",
    ramo: "autos" as Ramo,
    tipo: TIPOS.autos[0],
    aseguradoraId: "",
    afectado: "",
    fechaOcurrido: hoyISO(),
    ejecutivoId: String(usuario.id),
    descripcion: "",
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const polizas = trpc.catalogos.polizas.useQuery({ contratanteId: Number(f.contratanteId) }, { enabled: !!f.contratanteId })
  const poliza = polizas.data?.find((p) => String(p.id) === f.polizaId)

  // Al elegir póliza, la compañía y el ramo salen de ella.
  useEffect(() => {
    if (poliza) setF((x) => ({ ...x, ramo: poliza.ramo, aseguradoraId: String(poliza.aseguradoraId), tipo: TIPOS[poliza.ramo].includes(x.tipo) ? x.tipo : TIPOS[poliza.ramo][0] }))
  }, [poliza])

  const crear = trpc.siniestros.create.useMutation({
    onSuccess: (r) => {
      utils.invalidate()
      onClose()
      nav(`/siniestros/${r.id}`)
    },
  })
  const responsables = (usuarios.data ?? []).filter((u) => u.role !== "consulta" && (usuario.role === "admin" || u.id === usuario.id))
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    crear.mutate({
      contratanteId: Number(f.contratanteId),
      polizaId: f.polizaId ? Number(f.polizaId) : null,
      polizaTexto: f.polizaId ? null : f.polizaTexto,
      aseguradoraId: Number(f.aseguradoraId),
      ramo: f.ramo,
      tipo: f.tipo,
      afectado: f.afectado,
      fechaOcurrido: f.fechaOcurrido,
      descripcion: f.descripcion,
      ejecutivoId: Number(f.ejecutivoId),
    })
  }
  const docs = documentosPara(f.ramo, f.tipo)

  return (
    <Modal title="Nuevo siniestro" onClose={onClose} ancho="max-w-3xl">
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contratante" className="sm:col-span-2">
            <Select value={f.contratanteId} onChange={(e) => setF((x) => ({ ...x, contratanteId: e.target.value, polizaId: "" }))} required>
              <option value="">Elige un contratante…</option>
              {contratantes.data?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
          </Field>
          <Field label="Póliza" hint={!polizas.data?.length && f.contratanteId ? "Este contratante no tiene pólizas capturadas: escribe el número." : undefined}>
            <Select value={f.polizaId} onChange={set("polizaId")} disabled={!f.contratanteId}>
              <option value="">Otra (escribir número)</option>
              {polizas.data?.map((p) => <option key={p.id} value={p.id}>{p.numero} · {RAMO_LABEL[p.ramo]} · {p.aseguradora}</option>)}
            </Select>
          </Field>
          {!f.polizaId ? (
            <Field label="Número de póliza"><Input value={f.polizaTexto} onChange={set("polizaTexto")} placeholder="Opcional" /></Field>
          ) : (
            <Field label="Vigencia"><Input value={`${poliza?.vigenciaInicio ?? "—"} a ${poliza?.vigenciaFin ?? "—"}`} disabled /></Field>
          )}
          <Field label="Ramo">
            <Select value={f.ramo} onChange={(e) => setF((x) => ({ ...x, ramo: e.target.value as Ramo, tipo: TIPOS[e.target.value as Ramo][0] }))} disabled={!!f.polizaId}>
              {RAMOS.map((r) => <option key={r} value={r}>{RAMO_LABEL[r]}</option>)}
            </Select>
          </Field>
          <Field label="Tipo de siniestro">
            <Select value={f.tipo} onChange={set("tipo")}>
              {TIPOS[f.ramo].map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Compañía">
            <Select value={f.aseguradoraId} onChange={set("aseguradoraId")} disabled={!!f.polizaId} required>
              <option value="">Elige…</option>
              {aseguradoras.data?.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </Select>
          </Field>
          <Field label="Fecha de ocurrencia"><Input type="date" value={f.fechaOcurrido} max={hoyISO()} onChange={set("fechaOcurrido")} required /></Field>
          <Field label="Asegurado / afectado" hint="Vehículo, persona o bien afectado.">
            <Input value={f.afectado} onChange={set("afectado")} placeholder="Ej. Nissan Versa 2021 · placas" required />
          </Field>
          <Field label="Ejecutivo responsable">
            <Select value={f.ejecutivoId} onChange={set("ejecutivoId")} disabled={usuario.role !== "admin"}>
              {responsables.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </Select>
          </Field>
          <Field label="Descripción de lo ocurrido" className="sm:col-span-2">
            <Textarea rows={3} value={f.descripcion} onChange={set("descripcion")} />
          </Field>
        </div>
        <div className="rounded-[10px] bg-subtle p-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.09em] text-ink-400">Documentación que se pedirá ({docs.length})</p>
          <ul className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            {docs.map((d) => <li key={d}>· {d}</li>)}
          </ul>
        </div>
        <ErrorBox error={crear.error && errorMsg(crear.error)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={crear.isPending}>Registrar siniestro</Button>
        </div>
      </form>
    </Modal>
  )
}
