export const Session = {
  cookieName: "thp_sin_sid",
  maxAgeMs: 12 * 60 * 60 * 1000, // 12 horas
} as const;

export const ErrorMessages = {
  unauthenticated: "Inicia sesión para continuar.",
  insufficientRole: "Tu rol no tiene permiso para esta acción.",
} as const;

/**
 * Roles (tabla "Permisos por rol"):
 * - admin: todo.
 * - ejecutivo: ve todo; crea siniestros y edita, cambia estatus, documentos y pagos solo de los suyos.
 * - consulta: solo ve, reportes y exportar.
 */
export const ROLES = ["admin", "ejecutivo", "consulta"] as const;
export type Rol = (typeof ROLES)[number];
export const ROL_LABEL: Record<Rol, string> = {
  admin: "Administrador",
  ejecutivo: "Ejecutivo",
  consulta: "Solo consulta",
};
