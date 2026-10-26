export const Session = {
  cookieName: "thp_sin_sid",
  maxAgeMs: 12 * 60 * 60 * 1000, // 12 horas
} as const;

export const ErrorMessages = {
  unauthenticated: "Inicia sesión para continuar.",
  insufficientRole: "Tu rol no tiene permiso para esta acción.",
} as const;

export const ROLES = ["admin", "siniestros", "vendedor"] as const;
export type Rol = (typeof ROLES)[number];
export const ROL_LABEL: Record<Rol, string> = {
  admin: "Administrador",
  siniestros: "Siniestros (oficina)",
  vendedor: "Vendedor",
};
