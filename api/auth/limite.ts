/**
 * Freno de intentos fallidos por dirección IP (además del bloqueo por usuario), para que nadie
 * pueda probar contraseñas contra muchas cuentas a la vez. Vive en memoria: se reinicia con el servidor.
 */
export const MAX_FALLOS_IP = 20;
const VENTANA_MS = 15 * 60_000;

const fallos = new Map<string, { n: number; desde: number }>();

/** IP del cliente. En el servidor (Railway) llega en x-forwarded-for, puesta por su proxy. */
export function ipDe(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}

export function ipBloqueada(ip: string, ahora = Date.now()) {
  const f = fallos.get(ip);
  if (!f) return false;
  if (ahora - f.desde > VENTANA_MS) {
    fallos.delete(ip);
    return false;
  }
  return f.n >= MAX_FALLOS_IP;
}

export function registrarFallo(ip: string, ahora = Date.now()) {
  const f = fallos.get(ip);
  if (!f || ahora - f.desde > VENTANA_MS) fallos.set(ip, { n: 1, desde: ahora });
  else f.n++;
}

export const limpiarFallos = (ip: string) => fallos.delete(ip);
