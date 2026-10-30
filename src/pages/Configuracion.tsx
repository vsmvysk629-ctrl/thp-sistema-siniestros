import { useEffect, useState, type FormEvent } from "react"
import clsx from "clsx"
import { Plus, Trash2 } from "lucide-react"
import { RAMOS, RAMO_LABEL, type Ramo } from "@contracts/catalogos"
import { trpc } from "@/providers/trpc"
import { Badge, Button, Card, ErrorBox, Eyebrow, Field, Input, Modal, Nota, PageHeader, Select, Tabla, Tabs } from "@/components/ui"
import { errorMsg } from "@/lib/format"
import type { Salidas } from "@/lib/sesion"

type Tab = "aseguradoras" | "tipos" | "documentos" | "ajustes"
type Cfg = Salidas["configuracion"]["get"]

export default function Configuracion() {
  const [tab, setTab] = useState<Tab>("documentos")
  const cfg = trpc.configuracion.get.useQuery()
  return (
    <>
      <PageHeader titulo="Configuración" sub="Adapta catálogos, documentos y avisos a la forma de trabajar de la oficina. Los cambios aplican a los siniestros nuevos." />
      <Tabs<Tab>
        valor={tab}
        onChange={setTab}
        tabs={[
          { id: "documentos", label: "Documentos" },
          { id: "tipos", label: "Tipos de siniestro" },
          { id: "aseguradoras", label: "Aseguradoras" },
          { id: "ajustes", label: "Ajustes generales" },
        ]}
      />
      {!cfg.data ? (
        <p className="text-sm text-ink-400">Cargando…</p>
      ) : tab === "documentos" ? (
        <Documentos cfg={cfg.data} />
      ) : tab === "tipos" ? (
        <Tipos cfg={cfg.data} />
      ) : tab === "aseguradoras" ? (
        <Aseguradoras cfg={cfg.data} />
      ) : (
        <Ajustes cfg={cfg.data} />
      )}
    </>
  )
}

function useRefrescar() {
  const utils = trpc.useUtils()
  return () => {
    utils.configuracion.invalidate()
    utils.catalogos.aseguradoras.invalidate()
    utils.tablero.invalidate()
  }
}

/** Lista de ramos a la izquierda, contenido a la derecha. */
function PorRamo({ ramo, setRamo, children, cuenta }: { ramo: Ramo; setRamo: (r: Ramo) => void; children: React.ReactNode; cuenta: (r: Ramo) => number }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <nav className="flex gap-1 overflow-x-auto lg:flex-col">
        {RAMOS.map((r) => (
          <button
            key={r}
            onClick={() => setRamo(r)}
            className={clsx(
              "flex items-center justify-between whitespace-nowrap rounded-[9px] px-3 py-2 text-left text-[13px]",
              ramo === r ? "bg-surface font-medium text-ink-900 shadow-[0_0_0_1px_#E8EAEE]" : "text-ink-600 hover:bg-surface",
            )}
          >
            {RAMO_LABEL[r]}
            <span className="ml-3 font-mono text-[11px] text-ink-400">{cuenta(r)}</span>
          </button>
        ))}
      </nav>
      <div>{children}</div>
    </div>
  )
}

function Documentos({ cfg }: { cfg: Cfg }) {
  const refrescar = useRefrescar()
  const lista = trpc.configuracion.plantillas.useQuery()
  const [ramo, setRamo] = useState<Ramo>("autos")
  const [nuevo, setNuevo] = useState<{ tipo: string | null; aseguradoraId: number | null } | null>(null)
  const guardar = trpc.configuracion.guardarPlantilla.useMutation({ onSuccess: () => { refrescar(); lista.refetch() } })
  const quitar = trpc.configuracion.quitarPlantilla.useMutation({ onSuccess: () => lista.refetch() })
  const del = (lista.data ?? []).filter((p) => p.ramo === ramo)
  const nombreAseg = (id: number) => cfg.aseguradoras.find((a) => a.id === id)?.nombre ?? "—"
  // Grupos: generales del ramo, por tipo y por aseguradora.
  const grupos = [
    { clave: "general", titulo: "Todos los tipos", nota: "Se piden en cualquier siniestro del ramo.", filas: del.filter((p) => !p.tipo && !p.aseguradoraId), tipo: null, aseguradoraId: null },
    ...[...new Set(del.filter((p) => p.tipo && !p.aseguradoraId).map((p) => p.tipo!))].map((t) => ({
      clave: `t-${t}`, titulo: t, nota: "Reemplazan a los generales cuando el siniestro es de este tipo.", filas: del.filter((p) => p.tipo === t && !p.aseguradoraId), tipo: t, aseguradoraId: null,
    })),
    ...[...new Set(del.filter((p) => p.aseguradoraId).map((p) => p.aseguradoraId!))].map((a) => ({
      clave: `a-${a}`, titulo: `Además, para ${nombreAseg(a)}`, nota: "Se suman cuando la póliza es de esta compañía.", filas: del.filter((p) => p.aseguradoraId === a), tipo: null, aseguradoraId: a,
    })),
  ]
  return (
    <PorRamo ramo={ramo} setRamo={setRamo} cuenta={(r) => (lista.data ?? []).filter((p) => p.ramo === r && p.activo).length}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-ink-600">Documentos que se piden al abrir un expediente de <b className="font-medium text-ink-900">{RAMO_LABEL[ramo]}</b>.</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setNuevo({ tipo: "", aseguradoraId: null })}><Plus size={14} /> Para un tipo</Button>
          <Button variant="secondary" onClick={() => setNuevo({ tipo: null, aseguradoraId: cfg.aseguradoras[0]?.id ?? null })}><Plus size={14} /> Para una aseguradora</Button>
        </div>
      </div>
      <div className="space-y-4">
        {grupos.map((g) => (
          <Card key={g.clave} pad={false}>
            <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-4">
              <div>
                <h3 className="text-[14px] font-medium">{g.titulo}</h3>
                <p className="text-[12px] text-ink-400">{g.nota}</p>
              </div>
              <Button variant="ghost" onClick={() => setNuevo({ tipo: g.tipo, aseguradoraId: g.aseguradoraId })}><Plus size={14} /> Documento</Button>
            </div>
            <ul className="divide-y divide-line-soft border-t border-line-soft">
              {g.filas.map((p) => (
                <li key={p.id} className="group flex items-center gap-3 px-5 py-2.5 text-[13.5px]">
                  <span className={clsx("flex-1", !p.activo && "text-ink-400 line-through")}>{p.nombre}</span>
                  <button className="text-[12px] text-ink-400 hover:text-ink-900" onClick={() => guardar.mutate({ ...p, activo: !p.activo })}>{p.activo ? "Pausar" : "Activar"}</button>
                  <button className="text-ink-400 opacity-0 transition hover:text-tone-red group-hover:opacity-100" aria-label="Quitar" onClick={() => confirm(`¿Quitar "${p.nombre}"? Los expedientes ya abiertos no cambian.`) && quitar.mutate({ id: p.id })}>
                    <Trash2 size={14} strokeWidth={1.6} />
                  </button>
                </li>
              ))}
              {!g.filas.length && <li className="px-5 py-3 text-[13px] text-ink-400">Sin documentos.</li>}
            </ul>
          </Card>
        ))}
      </div>
      <ErrorBox error={guardar.error && errorMsg(guardar.error)} />
      {nuevo && (
        <NuevaPlantilla
          cfg={cfg}
          ramo={ramo}
          inicial={nuevo}
          onClose={() => setNuevo(null)}
          onGuardar={(v) => guardar.mutateAsync({ ramo, ...v }).then(() => setNuevo(null))}
        />
      )}
    </PorRamo>
  )
}

function NuevaPlantilla({ cfg, ramo, inicial, onClose, onGuardar }: {
  cfg: Cfg
  ramo: Ramo
  inicial: { tipo: string | null; aseguradoraId: number | null }
  onClose: () => void
  onGuardar: (v: { nombre: string; tipo: string | null; aseguradoraId: number | null }) => Promise<unknown>
}) {
  const tipos = cfg.tipos.filter((t) => t.ramo === ramo && t.activo)
  const [nombre, setNombre] = useState("")
  const [tipo, setTipo] = useState(inicial.tipo === "" ? tipos[0]?.nombre ?? "" : inicial.tipo ?? "")
  const [aseg, setAseg] = useState(inicial.aseguradoraId ? String(inicial.aseguradoraId) : "")
  const [error, setError] = useState<string | null>(null)
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    onGuardar({ nombre, tipo: tipo || null, aseguradoraId: aseg ? Number(aseg) : null }).catch((x) => setError(errorMsg(x)))
  }
  return (
    <Modal title="Agregar documento" onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <Field label="Documento"><Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Carta de no adeudo" autoFocus required /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo de siniestro">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              {tipos.map((t) => <option key={t.id}>{t.nombre}</option>)}
            </Select>
          </Field>
          <Field label="Aseguradora">
            <Select value={aseg} onChange={(e) => setAseg(e.target.value)}>
              <option value="">Todas</option>
              {cfg.aseguradoras.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </Select>
          </Field>
        </div>
        <Nota>
          {aseg ? "Se sumará a la lista cuando la póliza sea de esa aseguradora." : tipo ? "Para este tipo se usarán los documentos del tipo en lugar de los generales del ramo." : "Se pedirá en todos los siniestros del ramo."}
        </Nota>
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Agregar</Button>
        </div>
      </form>
    </Modal>
  )
}

function Tipos({ cfg }: { cfg: Cfg }) {
  const refrescar = useRefrescar()
  const [ramo, setRamo] = useState<Ramo>("autos")
  const [nombre, setNombre] = useState("")
  const guardar = trpc.configuracion.guardarTipo.useMutation({ onSuccess: () => { setNombre(""); refrescar() } })
  const del = cfg.tipos.filter((t) => t.ramo === ramo)
  return (
    <PorRamo ramo={ramo} setRamo={setRamo} cuenta={(r) => cfg.tipos.filter((t) => t.ramo === r && t.activo).length}>
      <Card title={`Tipos de siniestro · ${RAMO_LABEL[ramo]}`}>
        <ul className="divide-y divide-line-soft border-y border-line-soft">
          {del.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5 text-[13.5px]">
              <span className={clsx("flex-1", !t.activo && "text-ink-400 line-through")}>{t.nombre}</span>
              <button className="text-[12px] text-ink-400 hover:text-ink-900" onClick={() => guardar.mutate({ id: t.id, ramo, nombre: t.nombre, activo: !t.activo })}>
                {t.activo ? "Ocultar" : "Mostrar"}
              </button>
            </li>
          ))}
        </ul>
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); guardar.mutate({ ramo, nombre }) }}>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nuevo tipo (ej. Granizo)" />
          <Button type="submit" variant="secondary" disabled={!nombre.trim()}>Agregar</Button>
        </form>
        <div className="mt-3"><ErrorBox error={guardar.error && errorMsg(guardar.error)} /></div>
        <p className="mt-3 text-[12px] text-ink-400">Ocultar un tipo lo quita de los formularios; los siniestros que ya lo tienen no cambian.</p>
      </Card>
    </PorRamo>
  )
}

type Aseg = Cfg["aseguradoras"][number]

function Aseguradoras({ cfg }: { cfg: Cfg }) {
  const [editar, setEditar] = useState<Aseg | "nueva" | null>(null)
  const [verInactivas, setVerInactivas] = useState(false)
  const inactivas = cfg.aseguradoras.filter((a) => !a.activa).length
  const visibles = cfg.aseguradoras.filter((a) => a.activa || verInactivas)
  return (
    <Card title="Aseguradoras" actions={<Button variant="secondary" onClick={() => setEditar("nueva")}><Plus size={14} /> Aseguradora</Button>}>
      <Tabla cols={["Compañía", "Teléfono de cabina", "Aviso sin respuesta", "Notas", "Estado", ""]}>
        {visibles.map((a) => (
          <tr key={a.id}>
            <td className="px-3 py-3.5 font-medium">{a.nombre}</td>
            <td className="px-3 py-3.5 font-mono text-[12.5px]">{a.telefonoCabina ?? <span className="text-ink-400">—</span>}</td>
            <td className="px-3 py-3.5">{a.diasSinRespuesta ? `${a.diasSinRespuesta} días` : <span className="text-ink-400">General ({cfg.ajustes.diasSinMovimiento} días)</span>}</td>
            <td className="max-w-[260px] px-3 py-3.5 text-ink-600">{a.notas ?? <span className="text-ink-400">—</span>}</td>
            <td className="px-3 py-3.5"><Badge tono={a.activa ? "green" : "gray"}>{a.activa ? "Activa" : "Inactiva"}</Badge></td>
            <td className="px-3 py-3.5 text-right"><button className="text-[12.5px] text-ink-600 hover:text-ink-900" onClick={() => setEditar(a)}>Editar</button></td>
          </tr>
        ))}
      </Tabla>
      {inactivas > 0 && (
        <button className="mt-2 px-3 py-2 text-[12.5px] text-navy-900 hover:underline" onClick={() => setVerInactivas((v) => !v)}>
          {verInactivas ? "Ocultar inactivas" : `Ver ${inactivas} compañías inactivas para activar`}
        </button>
      )}
      {editar && <AseguradoraModal a={editar === "nueva" ? null : editar} onClose={() => setEditar(null)} />}
    </Card>
  )
}

function AseguradoraModal({ a, onClose }: { a: Aseg | null; onClose: () => void }) {
  const refrescar = useRefrescar()
  const [f, setF] = useState({ nombre: a?.nombre ?? "", telefonoCabina: a?.telefonoCabina ?? "", dias: a?.diasSinRespuesta ? String(a.diasSinRespuesta) : "", notas: a?.notas ?? "", activa: a?.activa ?? true })
  const m = trpc.configuracion.guardarAseguradora.useMutation({ onSuccess: () => { refrescar(); onClose() } })
  return (
    <Modal title={a ? `Editar ${a.nombre}` : "Nueva aseguradora"} onClose={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); m.mutate({ id: a?.id, nombre: f.nombre, telefonoCabina: f.telefonoCabina, diasSinRespuesta: f.dias ? Number(f.dias) : null, notas: f.notas, activa: f.activa }) }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <Field label="Nombre" className="sm:col-span-2"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required /></Field>
        <Field label="Teléfono de cabina"><Input value={f.telefonoCabina} onChange={(e) => setF({ ...f, telefonoCabina: e.target.value })} /></Field>
        <Field label="Avisar tras días sin respuesta" hint="Vacío = ajuste general."><Input inputMode="numeric" value={f.dias} onChange={(e) => setF({ ...f, dias: e.target.value.replace(/\D/g, "") })} /></Field>
        <Field label="Notas internas" className="sm:col-span-2"><Input value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} placeholder="Ej. portal de siniestros, horario de ejecutivos" /></Field>
        <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
          <input type="checkbox" checked={f.activa} onChange={(e) => setF({ ...f, activa: e.target.checked })} /> Activa (aparece en los formularios)
        </label>
        <div className="sm:col-span-2"><ErrorBox error={m.error && errorMsg(m.error)} /></div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={m.isPending}>Guardar</Button>
        </div>
      </form>
    </Modal>
  )
}

function Ajustes({ cfg }: { cfg: Cfg }) {
  const refrescar = useRefrescar()
  const [f, setF] = useState(cfg.ajustes)
  const [ok, setOk] = useState(false)
  useEffect(() => setF(cfg.ajustes), [cfg.ajustes])
  const m = trpc.configuracion.guardarAjustes.useMutation({ onSuccess: () => { refrescar(); setOk(true); setTimeout(() => setOk(false), 2500) } })
  return (
    <Card className="max-w-2xl">
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(f) }} className="space-y-6">
        <div>
          <Eyebrow className="mb-3">Siniestros nuevos</Eyebrow>
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <Field label="Primera acción"><Input value={f.accionInicial} onChange={(e) => setF({ ...f, accionInicial: e.target.value })} /></Field>
            <Field label="Días para el compromiso"><Input type="number" min={0} max={60} value={f.diasCompromisoInicial} onChange={(e) => setF({ ...f, diasCompromisoInicial: Number(e.target.value) })} /></Field>
          </div>
        </div>
        <div>
          <Eyebrow className="mb-3">Avisos</Eyebrow>
          <Field label="Días sin respuesta de la aseguradora antes de avisar" hint="Cada aseguradora puede tener su propio número en la pestaña Aseguradoras." className="max-w-xs">
            <Input type="number" min={1} max={365} value={f.diasSinMovimiento} onChange={(e) => setF({ ...f, diasSinMovimiento: Number(e.target.value) })} />
          </Field>
        </div>
        <div>
          <Eyebrow className="mb-3">Impresos</Eyebrow>
          <Field label="Nombre de la agencia" className="max-w-sm"><Input value={f.nombreAgencia} onChange={(e) => setF({ ...f, nombreAgencia: e.target.value })} /></Field>
        </div>
        <ErrorBox error={m.error && errorMsg(m.error)} />
        <div className="flex items-center justify-end gap-3">
          {ok && <span className="text-[13px] text-tone-green">Guardado</span>}
          <Button type="submit" disabled={m.isPending}>Guardar ajustes</Button>
        </div>
      </form>
    </Card>
  )
}
