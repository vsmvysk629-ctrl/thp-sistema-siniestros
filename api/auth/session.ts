import * as jose from "jose";
import * as cookie from "cookie";
import { env } from "../lib/env";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "../lib/cookies";

const JWT_ALG = "HS256";
/** pv = huella de la contraseña: si la contraseña cambia, las sesiones viejas dejan de servir. */
export type SessionPayload = { uid: number; pv: string };

const secret = () => new TextEncoder().encode(env.appSecret);

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime(`${Math.floor(Session.maxAgeMs / 1000)}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jose.jwtVerify(token, secret(), { algorithms: [JWT_ALG] });
    if (typeof payload.uid !== "number" || typeof payload.pv !== "string") return null;
    return { uid: payload.uid, pv: payload.pv };
  } catch {
    return null;
  }
}

export function sessionCookie(headers: Headers, token: string, maxAgeSec: number) {
  const o = getSessionCookieOptions(headers);
  return cookie.serialize(Session.cookieName, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: o.secure,
    maxAge: maxAgeSec,
  });
}

export const huellaPassword = (hash: string | null | undefined) => (hash ?? "").slice(-12);
