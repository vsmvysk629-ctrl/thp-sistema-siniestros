import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router"
import clsx from "clsx"
import { GRUPOS, GRUPO_DE, GRUPO_LABEL, RAMO_LABEL, type Grupo } from "@contracts/catalogos"
import { ESTADO_LABEL, GRUPOS_ESTADO, type GrupoEstado } from "@contracts/flujo"
import { trpc } from "@/providers/trpc"
import { Avatar, Button, Card, EstadoBadge, Field, Folio, Input, PageHeader, Segmento, Select, Tabla } from "@/components/ui"
import { corto, descargarCSV, diasEntre, fmtFecha, hoyISO, moneda } from "@/lib/format"
import { esEditor, guardarPreferencia, leerPreferencia, useSesion, type Vista } from "@/lib/sesion"
import { Compromiso } from "./Tablero"

export default function Siniestros() {
  const { usuario, nuevoSiniestro, vista, setVista } = useSesion()
  const nav = useNavigate()
  const [p, setP] = useSearchParams()
  const claveFiltros = `thp-filtros-${usuario.id}`
  // Sin filtros en la dirección, se recuperan los últimos que usó esta persona.
  useEffect(() => {
    if ([...p.keys()].length === 0) {
      const guardados = leerPreferencia<string>(claveFiltros, "")
      if (guardados) setP(new URLSearchParams(guardados), { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => guardarPreferencia(claveFiltros, p.toString()), [p, claveFiltros])
  const q = p.get("q") ?? ""
  const estado = (p.get("estado") ?? "abiertos") as GrupoEstado
  const mios = vista === "mios" && !p.get("ejecutivo")
  const ejecutivoId = p.get("ejecutivo") ? Number(p.get("ejecutivo")) : mios ? usuario.id : undefined
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
            {esEditor(usuario) && <Segmento<Vista> valor={vista} onChange={(v) => { setVista(v); cambiar("ejecutivo", "") }} opciones={[{ id: "mios", label: "Míos" }, { id: "todos", label: "Todo el despacho" }]} />}
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
            <Select value={p.get("ejecutivo") ?? ""} onChange={(e) => cambiar("ejecutivo", e.target.value)}>
              <option value="">{mios ? "Solo míos" : "Todos"}</option>
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
          cols={["Folio THP", "Contratante / asegurado", "Ramo", "Compañía", "Estatus", <span key="d" className="block text-right">Días</span>, "Próxima acción", "Responsable", <span key="r" className="block text-right">Reclamado</span>]}
          vacio={lista.isLoading ? "Cargando…" : !filas.length && "No hay siniestros con estos filtros."}
        >
          {filas.map((r) => (
            <tr key={r.id} className="cursor-pointer align-top hover:bg-subtle" onClick={() => nav(`/siniestros/${r.id}`)}>
              <td className="px-3 py-3.5"><Folio>{r.folio}</Folio><p className="text-[12px] text-ink-400">Ocurrió {fmtFecha(r.fechaOcurrido)}</p></td>
              <td className="max-w-[240px] px-3 py-3.5"><p className="font-medium">{r.contratante}</p><p className="text-ink-600">{r.afectado}</p></td>
              <td className="px-3 py-3.5"><p>{RAMO_LABEL[r.ramo]}</p><p className="text-ink-600">{r.tipo}</p></td>
              <td className="px-3 py-3.5"><p>{r.aseguradora}</p><p className="text-ink-600">{r.numeroSiniestro ?? "Sin número aún"}</p></td>
              <td className="px-3 py-3.5"><EstadoBadge estado={r.estado} /></td>
              <td className="px-3 py-3.5 text-right font-mono text-[12px] text-ink-600">{r.estado === "cerrado" ? "—" : diasEntre(r.fechaReporte, hoy)}</td>
              <td className="max-w-[240px] px-3 py-3.5">{r.proximaAccion ? <><p>{r.proximaAccion}</p><Compromiso fecha={r.fechaCompromiso} hoy={hoy} /></> : <span className="text-ink-400">—</span>}</td>
              <td className="px-3 py-3.5"><span className="flex items-center gap-2 whitespace-nowrap"><Avatar nombre={r.ejecutivo} id={r.ejecutivoId} />{corto(r.ejecutivo)}</span></td>
              <td className="px-3 py-3.5 text-right font-medium">{moneda(r.reclamado)}</td>
            </tr>
          ))}
        </Tabla>
      </Card>
    </>
  )
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={clsx("rounded-full border px-3 py-1 text-[12.5px] transition-colors", on ? "border-ink-900 bg-ink-900 text-white" : "border-line bg-surface text-ink-600 hover:border-line-strong hover:text-ink-900")}>
      {children}
    </button>
  )
}
