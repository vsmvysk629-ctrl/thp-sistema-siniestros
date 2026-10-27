import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import * as s from "@db/schema";
import { getDb, type Tx } from "../queries/connection";

/**
 * Permisos por rol:
 * - Ver siniestros, reportes y exportar: todos.
 * - Crear siniestros: admin y ejecutivos.
 * - Editar, cambiar estatus, documentos y pagos: admin, o el ejecutivo responsable del siniestro.
 */
export const puedeEditar = (u: s.User, sin: Pick<s.Siniestro, "ejecutivoId">) =>
  u.role === "admin" || (u.role === "ejecutivo" && sin.ejecutivoId === u.id);

export async function assertSiniestro(siniestroId: number, tx: Tx = getDb()) {
  const [sin] = await tx.select().from(s.siniestros).where(eq(s.siniestros.id, siniestroId)).limit(1);
  if (!sin) throw new TRPCError({ code: "NOT_FOUND", message: "Siniestro no encontrado." });
  return sin;
}

export async function assertEditable(u: s.User, siniestroId: number, tx: Tx = getDb()) {
  const sin = await assertSiniestro(siniestroId, tx);
  if (!puedeEditar(u, sin)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Solo el ejecutivo responsable o un administrador puede modificar este siniestro." });
  }
  return sin;
}
