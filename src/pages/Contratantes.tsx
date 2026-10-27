import { useState, type FormEvent } from "react"
import { Link } from "react-router"
import { RAMO_LABEL } from "@contracts/catalogos"
import { trpc } from "@/providers/trpc"
import { Badge, Button, ErrorBox, Field, Input, Modal, PageHeader, Select } from "@/components/ui"
import { errorMsg, moneda } from "@/lib/format"
import { esEditor, useSesion } from "@/lib/sesion"

export default function Contratantes() {
  const { usuario } = useSesion()
  const [q, setQ] = useState("")
  const [nuevo, setNuevo] = useState(false)
  const lista = trpc.catalogos.contratantes.useQuery({ busqueda: q || undefined })
  return (
    <>
      <PageHeader
        titulo="Contratantes"
        sub="Personas y empresas con pólizas en el despacho"
        acciones={esEditor(usuario) && <Button onClick={() => setNuevo(true)}>+ Nuevo contratante</Button>}
      />
      <Input className="mb-5 max-w-md" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar contratante…" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lista.data?.map((c) => (
          <Link key={c.id} to={`/contratantes/${c.id}`} className="rounded-card border border-line bg-surface p-5 hover:border-line-strong">
            <p className="text-lg font-semibold leading-tight">{c.nombre}</p>
            <p className="text-sm text-ink-600">{c.tipoPersona === "moral" ? "Persona moral" : "Persona física"}{c.clienteDesde ? ` · Cliente desde ${c.clienteDesde}` : ""}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.ramos.map((r) => <Badge key={r}>{RAMO_LABEL[r]}</Badge>)}
              {!c.ramos.length && <span className="text-xs text-ink-400">Sin pólizas capturadas</span>}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line-soft pt-3 text-sm">
              <div><p className="text-ink-600">Siniestros</p><p className="font-semibold">{c.siniestros}</p></div>
              <div><p className="text-ink-600">Abiertos</p><p className="font-semibold">{c.abiertos}</p></div>
              <div><p className="text-ink-600">Pagado</p><p className="font-semibold">{moneda(c.pagado)}</p></div>
            </div>
          </Link>
        ))}
      </div>
      {lista.data?.length === 0 && <p className="py-8 text-center text-sm text-ink-400">No hay contratantes.</p>}
      {nuevo && <ContratanteModal onClose={() => setNuevo(false)} />}
    </>
  )
}

type Datos = { nombre: string; tipoPersona: "fisica" | "moral"; rfc: string; contacto: string; telefono: string; email: string; clienteDesde: string; ejecutivoId: string }

export function ContratanteModal({ onClose, inicial }: { onClose: () => void; inicial?: { id: number } & Partial<Record<keyof Datos, string | number | null>> }) {
  const utils = trpc.useUtils()
  const usuarios = trpc.catalogos.usuarios.useQuery()
  const v = (k: keyof Datos) => (inicial?.[k] === null || inicial?.[k] === undefined ? "" : String(inicial[k]))
  const [f, setF] = useState<Datos>({
    nombre: v("nombre"), tipoPersona: (v("tipoPersona") || "fisica") as Datos["tipoPersona"], rfc: v("rfc"), contacto: v("contacto"),
    telefono: v("telefono"), email: v("email"), clienteDesde: v("clienteDesde"), ejecutivoId: v("ejecutivoId"),
  })
  const set = (k: keyof Datos) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const ok = () => { utils.catalogos.invalidate(); onClose() }
  const crear = trpc.catalogos.crearContratante.useMutation({ onSuccess: ok })
  const editar = trpc.catalogos.editarContratante.useMutation({ onSuccess: ok })
  const datos = () => ({ ...f, clienteDesde: f.clienteDesde ? Number(f.clienteDesde) : null, ejecutivoId: f.ejecutivoId ? Number(f.ejecutivoId) : null })
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (inicial) editar.mutate({ id: inicial.id, datos: datos() })
    else crear.mutate(datos())
  }
  const error = crear.error ?? editar.error
  return (
    <Modal title={inicial ? "Editar contratante" : "Nuevo contratante"} onClose={onClose}>
      <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre o razón social" className="sm:col-span-2"><Input value={f.nombre} onChange={set("nombre")} required /></Field>
        <Field label="Tipo de persona">
          <Select value={f.tipoPersona} onChange={set("tipoPersona")}><option value="fisica">Física</option><option value="moral">Moral</option></Select>
        </Field>
        <Field label="RFC"><Input value={f.rfc} onChange={set("rfc")} /></Field>
        <Field label="Contacto"><Input value={f.contacto} onChange={set("contacto")} /></Field>
        <Field label="Teléfono"><Input value={f.telefono} onChange={set("telefono")} /></Field>
        <Field label="Correo"><Input type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="Cliente desde (año)"><Input inputMode="numeric" value={f.clienteDesde} onChange={set("clienteDesde")} /></Field>
        <Field label="Ejecutivo de la cuenta" className="sm:col-span-2">
          <Select value={f.ejecutivoId} onChange={set("ejecutivoId")}>
            <option value="">Sin asignar</option>
            {usuarios.data?.filter((u) => u.role !== "consulta").map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2"><ErrorBox error={error && errorMsg(error)} /></div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={crear.isPending || editar.isPending}>Guardar</Button>
        </div>
      </form>
    </Modal>
  )
}
