import { relations } from "drizzle-orm";
import { aseguradoras, clientes, polizas, siniestroEventos, siniestros, terceros, users } from "./schema";

export const polizasRel = relations(polizas, ({ one }) => ({
  aseguradora: one(aseguradoras, { fields: [polizas.aseguradoraId], references: [aseguradoras.id] }),
  cliente: one(clientes, { fields: [polizas.clienteId], references: [clientes.id] }),
}));

export const siniestrosRel = relations(siniestros, ({ one, many }) => ({
  poliza: one(polizas, { fields: [siniestros.polizaId], references: [polizas.id] }),
  cliente: one(clientes, { fields: [siniestros.clienteId], references: [clientes.id] }),
  aseguradora: one(aseguradoras, { fields: [siniestros.aseguradoraId], references: [aseguradoras.id] }),
  responsable: one(users, { fields: [siniestros.responsableId], references: [users.id] }),
  eventos: many(siniestroEventos),
  terceros: many(terceros),
}));

export const eventosRel = relations(siniestroEventos, ({ one }) => ({
  siniestro: one(siniestros, { fields: [siniestroEventos.siniestroId], references: [siniestros.id] }),
  autor: one(users, { fields: [siniestroEventos.autorId], references: [users.id] }),
}));

export const tercerosRel = relations(terceros, ({ one }) => ({
  siniestro: one(siniestros, { fields: [terceros.siniestroId], references: [siniestros.id] }),
}));
