import { useState } from "react"
import { Link } from "react-router"
import { Check, Copy, Mail, MessageCircle, Send, X } from "lucide-react"
import { ligaWhatsApp } from "@contracts/borradores"
import { trpc } from "@/providers/trpc"
import { Badge, Button, Card, ErrorBox, Folio, PageHeader, Textarea } from "@/components/ui"
import { errorMsg, fmtFecha } from "@/lib/format"
import { useSesion, type Salidas } from "@/lib/sesion"

type Item = Salidas["seguimiento"]["lista"]["porAprobar"][number]

export default function Seguimiento() {
  const { usuario } = useSesion()
  const lista = trpc.seguimiento.lista.useQuery()
  const esAdmin = usuario.role === "admin"
  const d = lista.data
  return (
    <>
      <PageHeader
        titulo="Seguimiento"
        sub="Cada día el sistema propone mensajes para lo que está detenido. Un administrador los aprueba y el responsable los envía desde su WhatsApp o correo. El sistema no envía nada por su cuenta."
      />
      <Seccion
        titulo="Por aprobar"
        vacio={esAdmin ? "No hay mensajes por aprobar." : "No hay mensajes esperando aprobación."}
        items={d?.porAprobar}
        cargando={lista.isLoading}
      />
      <Seccion titulo="Aprobados, listos para enviar" vacio="Nada por enviar." items={d?.porEnviar} cargando={lista.isLoading} />
      {!!d?.enviados.length && (
        <Card title="Enviados recientemente" className="mt-5">
          <ul className="divide-y divide-line-soft border-t border-line-soft text-[13px]">
            {d.enviados.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <Link to={`/siniestros/${b.siniestroId}`}><Folio>{b.folio}</Folio></Link>
                <span>{b.motivoLabel}</span>
                <span className="text-ink-600">{b.para === "cliente" ? b.contratante : b.aseguradora}</span>
                <span className="ml-auto text-ink-400">{b.enviadoAt ? fmtFecha(b.enviadoAt, true) : ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

function Seccion({ titulo, items, vacio, cargando }: { titulo: string; items?: Item[]; vacio: string; cargando: boolean }) {
  return (
    <section className="mt-5 first-of-type:mt-0">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-medium">
        {titulo} {!!items?.length && <Badge tono="blue">{items.length}</Badge>}
      </h2>
      {cargando ? (
        <p className="text-[13px] text-ink-400">Cargando…</p>
      ) : !items?.length ? (
        <Card><p className="py-2 text-center text-[13px] text-ink-400">{vacio}</p></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">{items.map((b) => <Mensaje key={b.id} b={b} />)}</div>
      )}
    </section>
  )
}

function Mensaje({ b }: { b: Item }) {
  const { usuario } = useSesion()
  const utils = trpc.useUtils()
  const refrescar = () => Promise.all([utils.seguimiento.invalidate(), utils.siniestros.get.invalidate({ id: b.siniestroId })])
  const [texto, setTexto] = useState(b.texto)
  const [copiado, setCopiado] = useState(false)
  const aprobar = trpc.seguimiento.aprobar.useMutation({ onSuccess: refrescar })
  const descartar = trpc.seguimiento.descartar.useMutation({ onSuccess: refrescar })
  const editar = trpc.seguimiento.editar.useMutation({ onSuccess: refrescar })
  const enviado = trpc.seguimiento.marcarEnviado.useMutation({ onSuccess: refrescar })
  const error = [aprobar, descartar, editar, enviado].find((m) => m.error)?.error
  const puedeEditar = usuario.role === "admin" || b.ejecutivoId === usuario.id
  const pendiente = b.estado === "pendiente"
  const telefono = b.para === "cliente" ? b.telefono : b.telefonoAseguradora
  const destinatario = b.para === "cliente" ? b.contratante : b.aseguradora
  const cambiado = texto.trim() !== b.texto

  async function copiar() {
    try {
      await navigator.clipboard.writeText(b.texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* sin portapapeles: queda el texto a la vista para copiarlo a mano */
    }
  }

  return (
    <Card pad={false} className="flex flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]">
        <Link to={`/siniestros/${b.siniestroId}`} className="hover:underline"><Folio>{b.folio}</Folio></Link>
        <Badge tono={b.para === "cliente" ? "blue" : "orange"}>Para {b.para === "cliente" ? "el cliente" : "la aseguradora"}</Badge>
        <span className="text-ink-600">{b.motivoLabel}</span>
      </div>
      <p className="mb-2 text-[13px] text-ink-600">
        <span className="text-ink-900">{destinatario}</span> · {b.afectado}
        {b.ejecutivo && <> · Responsable: {b.ejecutivo}</>}
      </p>
      {pendiente && puedeEditar ? (
        <Textarea rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Texto del mensaje" className="text-[13px] leading-relaxed" />
      ) : (
        <p className="whitespace-pre-line rounded-[10px] bg-subtle px-3 py-2.5 text-[13px] leading-relaxed">{b.texto}</p>
      )}
      <ErrorBox error={error && errorMsg(error)} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {pendiente ? (
          <>
            {usuario.role === "admin" ? (
              <Button onClick={() => aprobar.mutate({ id: b.id, texto })} disabled={aprobar.isPending}><Check size={14} /> Aprobar</Button>
            ) : (
              <>
                <span className="text-xs text-ink-400">Espera aprobación del administrador.</span>
                {cambiado && <Button variant="secondary" onClick={() => editar.mutate({ id: b.id, texto })} disabled={editar.isPending}>Guardar cambios</Button>}
              </>
            )}
            {puedeEditar && <Button variant="ghost" onClick={() => descartar.mutate({ id: b.id })} disabled={descartar.isPending}><X size={14} /> Descartar</Button>}
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={copiar}><Copy size={14} /> {copiado ? "Copiado" : "Copiar texto"}</Button>
            {telefono && (
              <a className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-line px-3.5 text-[13px] font-medium hover:bg-subtle" href={ligaWhatsApp(telefono, b.texto)} target="_blank" rel="noreferrer">
                <MessageCircle size={14} /> WhatsApp
              </a>
            )}
            {b.para === "cliente" && b.email && (
              <a className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-line px-3.5 text-[13px] font-medium hover:bg-subtle" href={`mailto:${b.email}?subject=${encodeURIComponent(`Siniestro ${b.folio}`)}&body=${encodeURIComponent(b.texto)}`}>
                <Mail size={14} /> Correo
              </a>
            )}
            {puedeEditar && <Button onClick={() => enviado.mutate({ id: b.id })} disabled={enviado.isPending} className="ml-auto"><Send size={14} /> Ya lo envié</Button>}
          </>
        )}
      </div>
    </Card>
  )
}
