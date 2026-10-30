import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as s from "@db/schema";
import { ARCHIVO_MAX_MB, ARCHIVO_TIPOS, DICTAMENES, DOC_ESTADOS, DOC_LABEL } from "@contracts/catalogos";
import { ESTADOS_PAGO, ESTADO_LABEL, estadoTrasPago } from "@contracts/flujo";
import { authedQuery, createRouter, editorQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { assertEditable, assertSiniestro } from "../auth/alcance";
import { hoyISO, recalcularConceptos, registrarEvento, totalPagado } from "../queries/siniestros";
import { monto } from "./siniestros";

const montoReq = monto.refine((v) => v !== null && Number(v) > 0, "Captura un monto mayor a cero.");
const fmt = (n: number | string) => `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Documentación, conceptos reclamados y pagos de un siniestro. */
export const expedienteRouter = createRouter({
  documentoEstado: editorQuery
    .input(z.object({ id: z.number(), estado: z.enum(DOC_ESTADOS), nota: z.string().trim().max(500).nullish() }))
    .mutation(async ({ ctx, input }) => {
      const [d] = await getDb().select().from(s.documentos).where(eq(s.documentos.id, input.id));
      if (!d) throw new TRPCError({ code: "NOT_FOUND", message: "Documento no encontrado." });
      await assertEditable(ctx.user, d.siniestroId);
      if (d.estado === input.estado) return { ok: true };
      await getDb().transaction(async (tx) => {
        await tx
          .update(s.documentos)
          .set({ estado: input.estado, nota: input.nota ?? d.nota, actualizadoPorId: ctx.user.id })
          .where(eq(s.documentos.id, d.id));
        await registrarEvento(tx, {
          siniestroId: d.siniestroId,
          tipo: "documento",
          nota: `${d.nombre}: ${DOC_LABEL[input.estado].toLowerCase()}.${input.nota ? ` ${input.nota}` : ""}`,
          autorId: ctx.user.id,
        });
      });
      return { ok: true };
    }),

  agregarDocumento: editorQuery
    .input(z.object({ siniestroId: z.number(), nombre: z.string().trim().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      await assertEditable(ctx.user, input.siniestroId);
      return getDb().transaction(async (tx) => {
        const [m] = await tx
          .select({ orden: sql<number>`coalesce(max(${s.documentos.orden}), -1)` })
          .from(s.documentos)
          .where(eq(s.documentos.siniestroId, input.siniestroId));
        const [{ id }] = await tx
          .insert(s.documentos)
          .values({ siniestroId: input.siniestroId, nombre: input.nombre, orden: Number(m.orden) + 1 })
          .$returningId();
        await registrarEvento(tx, { siniestroId: input.siniestroId, tipo: "documento", nota: `Se pide un documento más: ${input.nombre}.`, autorId: ctx.user.id });
        return { id };
      });
    }),

  subirArchivo: editorQuery
    .input(
      z.object({
        siniestroId: z.number(),
        documentoId: z.number().nullish(),
        nombre: z.string().trim().min(1).max(255),
        tipo: z.string().max(128),
        base64: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertEditable(ctx.user, input.siniestroId);
      if (!ARCHIVO_TIPOS[input.tipo]) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Formato no aceptado. Sube PDF, foto, Word o Excel." });
      }
      if (!/^[A-Za-z0-9+/]+=*$/.test(input.base64)) throw new TRPCError({ code: "BAD_REQUEST", message: "Archivo dañado." });
      const tamano = Math.floor((input.base64.length * 3) / 4) - (input.base64.match(/=+$/)?.[0].length ?? 0);
      if (tamano > ARCHIVO_MAX_MB * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `El archivo pesa más de ${ARCHIVO_MAX_MB} MB.` });
      }
      return getDb().transaction(async (tx) => {
        let doc: s.Documento | undefined;
        if (input.documentoId) {
          [doc] = await tx.select().from(s.documentos).where(eq(s.documentos.id, input.documentoId));
          if (!doc || doc.siniestroId !== input.siniestroId) throw new TRPCError({ code: "NOT_FOUND", message: "Documento no encontrado." });
        }
        const [{ id }] = await tx
          .insert(s.archivos)
          .values({ siniestroId: input.siniestroId, documentoId: doc?.id ?? null, nombre: input.nombre, tipo: input.tipo, tamano, contenido: input.base64, subidoPorId: ctx.user.id })
          .$returningId();
        // Subir el archivo de un documento que faltaba lo marca como recibido; validarlo sigue siendo a mano.
        const recibido = doc && (doc.estado === "pendiente" || doc.estado === "correccion");
        if (doc && recibido) {
          await tx.update(s.documentos).set({ estado: "recibido", actualizadoPorId: ctx.user.id }).where(eq(s.documentos.id, doc.id));
        }
        await registrarEvento(tx, {
          siniestroId: input.siniestroId,
          tipo: "documento",
          nota: doc ? `${doc.nombre}: se subió el archivo ${input.nombre}${recibido ? " (queda como recibido)" : ""}.` : `Se subió el archivo ${input.nombre}.`,
          autorId: ctx.user.id,
        });
        return { id };
      });
    }),

  /** Contenido de un archivo, para verlo o descargarlo. Lo puede ver quien ve el siniestro. */
  archivo: authedQuery.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const [a] = await getDb().select().from(s.archivos).where(eq(s.archivos.id, input.id));
    if (!a) throw new TRPCError({ code: "NOT_FOUND", message: "Archivo no encontrado." });
    await assertSiniestro(a.siniestroId);
    return { nombre: a.nombre, tipo: a.tipo, base64: a.contenido };
  }),

  borrarArchivo: editorQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const [a] = await getDb()
      .select({ id: s.archivos.id, siniestroId: s.archivos.siniestroId, nombre: s.archivos.nombre })
      .from(s.archivos)
      .where(eq(s.archivos.id, input.id));
    if (!a) throw new TRPCError({ code: "NOT_FOUND", message: "Archivo no encontrado." });
    await assertEditable(ctx.user, a.siniestroId);
    await getDb().transaction(async (tx) => {
      await tx.delete(s.archivos).where(eq(s.archivos.id, a.id));
      await registrarEvento(tx, { siniestroId: a.siniestroId, tipo: "documento", nota: `Se quitó el archivo ${a.nombre}.`, autorId: ctx.user.id });
    });
    return { ok: true };
  }),

  guardarConcepto: editorQuery
    .input(
      z.object({
        id: z.number().optional(),
        siniestroId: z.number(),
        concepto: z.string().trim().min(1).max(255),
        importe: montoReq,
        noProcedente: monto,
        dictamen: z.enum(DICTAMENES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertEditable(ctx.user, input.siniestroId);
      const np = Number(input.noProcedente ?? 0);
      if (np > Number(input.importe)) throw new TRPCError({ code: "BAD_REQUEST", message: "Lo no procedente no puede ser mayor que el importe." });
      const valores = { concepto: input.concepto, importe: input.importe!, noProcedente: String(np), dictamen: input.dictamen };
      await getDb().transaction(async (tx) => {
        if (input.id) {
          const r = await tx
            .update(s.conceptos)
            .set(valores)
            .where(and(eq(s.conceptos.id, input.id), eq(s.conceptos.siniestroId, input.siniestroId)));
          if (r[0].affectedRows === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Concepto no encontrado." });
        } else {
          await tx.insert(s.conceptos).values({ ...valores, siniestroId: input.siniestroId });
        }
        await recalcularConceptos(tx, input.siniestroId);
        await registrarEvento(tx, {
          siniestroId: input.siniestroId,
          tipo: "financiero",
          nota: `${input.id ? "Se actualizó" : "Se agregó"} el concepto "${input.concepto}" por ${fmt(input.importe!)}.`,
          autorId: ctx.user.id,
        });
      });
      return { ok: true };
    }),

  quitarConcepto: editorQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const [c] = await getDb().select().from(s.conceptos).where(eq(s.conceptos.id, input.id));
    if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Concepto no encontrado." });
    await assertEditable(ctx.user, c.siniestroId);
    await getDb().transaction(async (tx) => {
      await tx.delete(s.conceptos).where(eq(s.conceptos.id, c.id));
      await recalcularConceptos(tx, c.siniestroId);
      await registrarEvento(tx, { siniestroId: c.siniestroId, tipo: "financiero", nota: `Se quitó el concepto "${c.concepto}".`, autorId: ctx.user.id });
    });
    return { ok: true };
  }),

  /**
   * Registra un pago de la aseguradora. Solo después de "Autorizado", con la referencia del pago,
   * y sin pasar de lo autorizado. El estatus cambia solo a "Pago parcial" o "Pagado".
   */
  registrarPago: editorQuery
    .input(
      z.object({
        siniestroId: z.number(),
        concepto: z.string().trim().min(1).max(255),
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
        monto: montoReq,
        forma: z.enum(["transferencia", "cheque", "pago_directo", "otro"]),
        referencia: z.string().trim().min(1, "Captura la referencia del pago (transferencia, cheque u oficio).").max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertEditable(ctx.user, input.siniestroId);
      if (input.fecha > hoyISO()) throw new TRPCError({ code: "BAD_REQUEST", message: "La fecha del pago no puede ser futura." });
      return getDb().transaction(async (tx) => {
        const [sin] = await tx.select().from(s.siniestros).where(eq(s.siniestros.id, input.siniestroId)).for("update");
        if (!ESTADOS_PAGO.includes(sin.estado) || sin.autorizado === null) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se registran pagos cuando la aseguradora ya autorizó el siniestro." });
        }
        const previo = await totalPagado(tx, sin.id);
        const autorizado = Number(sin.autorizado);
        const nuevoTotal = previo + Number(input.monto);
        if (nuevoTotal > autorizado + 0.005) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `El pago excede lo autorizado. Saldo pendiente: ${fmt(autorizado - previo)}.` });
        }
        await tx.insert(s.pagos).values({ ...input, monto: input.monto!, registradoPorId: ctx.user.id });
        const estado = estadoTrasPago(autorizado, nuevoTotal);
        if (estado !== sin.estado) {
          // Con lo autorizado ya pagado, lo que sigue es confirmar con el cliente y cerrar.
          const cierre = estado === "pagado" ? { proximaAccion: "Confirmar con el cliente que recibió el pago y cerrar el expediente", fechaCompromiso: hoyISO(new Date(Date.now() + 3 * 86_400_000)) } : {};
          await tx.update(s.siniestros).set({ estado, ...cierre }).where(eq(s.siniestros.id, sin.id));
        }
        const saldo = autorizado - nuevoTotal;
        await registrarEvento(tx, {
          siniestroId: sin.id,
          tipo: "pago",
          estadoAnterior: estado !== sin.estado ? sin.estado : null,
          estadoNuevo: estado !== sin.estado ? estado : null,
          folio: input.referencia,
          nota: `${input.concepto}: ${fmt(input.monto!)} (${input.fecha.split("-").reverse().join("/")}). ${saldo > 0.005 ? `Queda saldo de ${fmt(saldo)}.` : "Queda pagado lo autorizado."}`,
          autorId: ctx.user.id,
        });
        return { estado, label: ESTADO_LABEL[estado], saldo };
      });
    }),
});
