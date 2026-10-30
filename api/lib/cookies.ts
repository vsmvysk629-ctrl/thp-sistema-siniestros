import type { CookieOptions } from "hono/utils/cookie";

/**
 * La cookie de sesión solo se marca "secure" cuando la conexión es HTTPS (Railway, túnel)
 * o si se fuerza con COOKIE_SECURE=true. En la red de la oficina (http://IP-de-la-mini-PC:3000)
 * el navegador descartaría una cookie "secure" y nadie podría entrar.
 */
export function getSessionCookieOptions(headers: Headers): CookieOptions {
  const https = headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https" || process.env.COOKIE_SECURE === "true";
  return {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: https,
  };
}
