import { useNavigate, useSearchParams } from "react-router"
import clsx from "clsx"
import { GRUPOS, GRUPO_DE, GRUPO_LABEL, RAMO_LABEL, type Grupo } from "@contracts/catalogos"
import { ESTADO_LABEL, GRUPOS_ESTADO, type GrupoEstado } from "@contracts/flujo"
import { trpc } from "@/providers/trpc"
import { Avatar, Button, Card, EstadoBadge, Field, Folio, Input, PageHeader, Select, Tabla } from "@/components/ui"
import { corto, descargarCSV, fmtFecha, hoyISO, moneda } from "@/lib/format"
import { esEditor, useSesion } from "@/lib/sesion"
import { Compromiso } from "./Tablero"

export default function Siniestros() {
  const { usuario, nuevoSiniestro } = useSesion()
  const nav = useNavigate()
  const [p, setP] = useSearchParams()
  const q = p.get("q") ?? ""
  const estado = (p.get("estado") ?? "abiertos") as GrupoEstado
  const ejecutivoId = p.get("ejecutivo") ? Number(p.get("ejecutivo")) : undefined
  const aseguradoraId = p.get("aseguradora") ? Number(p.get("aseguradora")) : undefined
  const ramo = (p.get("ramo") ?? "") as Grupo | ""
  const cambiar = (k: string, v: string) => {
    const n = new URLSearchParams(p)
    if (v) n.set(k, v)
    else n.delete(k)
    setP(n, { replace: true })
  }

  const usuarios = trpc.catalogos.usuarios.useQuery()
  const aseguradoras = trpc.catalogos.aseguradoras.useQuery()
  const lista = trpc.siniestros.list.useQuery({ busqueda: q || undefined, grupoEstado: estado, ejecutivoId, aseguradoraId })
  const todas = lista.data ?? []
  const filas = ramo ? todas.filter((r) => GRUPO_DE[r.ramo] === ramo) : todas
  const hoy = hoyISO()

  const exportar = () =>
    descargarCSV(
      `siniestros-${hoy}`,
      ["Folio", "Ocurrió", "Contratante", "Afectado", "Ramo", "Tipo", "Compañía", "No. siniestro", "Estatus", "Próxima acción", "Compromiso", "Responsable", "Reclamado", "Autorizado", "Pagado"],
      filas.map((r) => [r.folio, r.fechaOcurrido, r.contratante, r.afectado, RAMO_LABEL[r.ramo], r.tipo, r.aseguradora, r.numeroSiniestro, ESTADO_LABEL[r.estado], r.proximaAccion, r.fechaCompromiso, r.ejecutivo, r.reclamado, r.autorizado, r.pagado]),
    )

  return (
    <>
      <PageHeader
        titulo="Siniestros"
        sub={`${filas.length} resultado${filas.length === 1 ? "" : "s"}`}
        acciones={
          <>
            <Button variant="secondary" onClick={exportar}>Exportar</Button>
            {esEditor(usuario) && <Button onClick={() => nuevoSiniestro()}>+ Nuevo siniestro</Button>}
          </>
        }
      />
      <Card className="no-print mb-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Buscar"><Input value={q} onChange={(e) => cambiar("q", e.target.value)} placeholder="Folio, contratante, asegurado, póliza" /></Field>
          <Field label="Estatus">
            <Select value={estado} onChange={(e) => cambiar("estado", e.target.value)}>
              {(Object.keys(GRUPOS_ESTADO) as GrupoEstado[]).map((k) => <option key={k} value={k}>{GRUPOS_ESTADO[k].label}</option>)}
            </Select>
          </Field>
          <Field label="Ejecutivo">
            <Select value={ejecutivoId ?? ""} onChange={(e) => cambiar("ejecutivo", e.target.value)}>
              <option value="">Todos</option>
              {usuarios.data?.filter((u) => u.role !== "consulta").map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </Select>
          </Field>
          <Field label="Compañía">
            <Select value={aseguradoraId ?? ""} onChange={(e) => cambiar("aseguradora", e.target.value)}>
              <option value="">Todas</option>
              {aseguradoras.data?.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[13px] text-ink-600">Ramo</span>
          <Chip on={!ramo} onClick={() => cambiar("ramo", "")}>Todos ({todas.length})</Chip>
          {GRUPOS.map((g) => (
            <Chip key={g} on={ramo === g} onClick={() => cambiar("ramo", g)}>
              {GRUPO_LABEL[g]} ({todas.filter((r) => GRUPO_DE[r.ramo] === g).length})
            </Chip>
          ))}
          <button className="ml-auto text-sm text-navy-900 hover:underline" onClick={() => setP(new URLSearchParams(), { replace: true })}>Limpiar filtros</button>
        </div>
      </Card>
      <Card pad={false} className="px-3 py-2">
        <Tabla
          cols={["Folio THP", "Contratante / asegurado", "Ramo", "Compañía", "Estatus", "Próxima acción", "Responsable", <span key="r" className="block text-right">Reclamado</span>]}
          vacio={lista.isLoading ? "Cargando…" : !filas.length && "No hay siniestros con estos filtros."}
        >
          {filas.map((r) => (
            <tr key={r.id} className="cursor-pointer align-top hover:bg-subtle" onClick={() => nav(`/siniestros/${r.id}`)}>
              <td className="px-2.5 py-3"><Folio>{r.folio}</Folio><p className="text-ink-600">Ocurrió {fmtFecha(r.fechaOcurrido)}</p></td>
              <td className="max-w-[240px] px-2.5 py-3"><p className="font-semibold">{r.contratante}</p><p className="text-ink-600">{r.afectado}</p></td>
              <td className="px-2.5 py-3"><p>{RAMO_LABEL[r.ramo]}</p><p className="text-ink-600">{r.tipo}</p></td>
              <td className="px-2.5 py-3"><p>{r.aseguradora}</p><p className="text-ink-600">{r.numeroSiniestro ?? "Sin número aún"}</p></td>
              <td className="px-2.5 py-3"><EstadoBadge estado={r.estado} /></td>
              <td className="max-w-[240px] px-2.5 py-3">{r.proximaAccion ? <><p>{r.proximaAccion}</p><Compromiso fecha={r.fechaCompromiso} hoy={hoy} /></> : <span className="text-ink-400">—</span>}</td>
              <td className="px-2.5 py-3"><span className="flex items-center gap-2 whitespace-nowrap"><Avatar nombre={r.ejecutivo} id={r.ejecutivoId} />{corto(r.ejecutivo)}</span></td>
              <td className="px-2.5 py-3 text-right font-semibold">{moneda(r.reclamado)}</td>
            </tr>
          ))}
        </Tabla>
      </Card>
    </>
  )
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={clsx("rounded-full border px-3.5 py-1.5 text-sm", on ? "border-navy-900 bg-navy-900 text-white" : "border-line-strong bg-surface hover:bg-subtle")}>
      {children}
    </button>
  )
}
