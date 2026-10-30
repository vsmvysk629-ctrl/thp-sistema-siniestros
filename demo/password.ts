// Demo: contraseñas con SHA-256 del navegador (datos ficticios; el sistema real usa scrypt).
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("")

async function sha(password: string, salt: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + password)))
}

export async function hashPassword(password: string): Promise<string> {
  const salt = hex(crypto.getRandomValues(new Uint8Array(8)).buffer)
  return `demo$${salt}$${await sha(password, salt)}`
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [tipo, salt, h] = (stored ?? "").split("$")
  return tipo === "demo" && (await sha(password, salt)) === h
}

export function passwordProblema(password: string): string | null {
  if (password.length < 10) return "La contraseña debe tener al menos 10 caracteres."
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return "La contraseña debe incluir letras y números."
  return null
}

export function passwordTemporal(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
  const out = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => abc[b % abc.length]).join("")
  return out.slice(0, 4) + "-" + out.slice(4, 8) + "-" + out.slice(8, 12)
}
