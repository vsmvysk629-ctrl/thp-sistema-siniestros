import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import * as s from "@db/schema";
import { getDb } from "../queries/connection";

/**
 * Qué ve cada rol:
 * - admin y siniestros: todo.
 * - vendedor: solo clientes asignados a él (y sus pólizas y siniestros).
 */
export const esVendedor = (u: s.User) => u.role === "vendedor";

export async function assertCliente(u: s.User, clienteId: number) {
  const c = await getDb().query.clientes.findFirst({ where: eq(s.clientes.id, clienteId) });
  if (!c || (esVendedor(u) && c.vendedorId !== u.id)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado." });
  }
  return c;
}

export async function assertPoliza(u: s.User, polizaId: number) {
  const p = await getDb().query.polizas.findFirst({ where: eq(s.polizas.id, polizaId) });
  if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Póliza no encontrada." });
  await assertCliente(u, p.clienteId);
  return p;
}

export async function assertSiniestro(u: s.User, siniestroId: number) {
  const sin = await getDb().query.siniestros.findFirst({ where: eq(s.siniestros.id, siniestroId) });
  if (!sin) throw new TRPCError({ code: "NOT_FOUND", message: "Siniestro no encontrado." });
  await assertCliente(u, sin.clienteId).catch(() => {
    throw new TRPCError({ code: "NOT_FOUND", message: "Siniestro no encontrado." });
  });
  return sin;
}
