import * as cookie from "cookie";
import { eq } from "drizzle-orm";
import * as s from "@db/schema";
import { Session } from "@contracts/constants";
import { getDb } from "../queries/connection";
import { huellaPassword, verifySessionToken } from "./session";

/** Devuelve el usuario de la cookie de sesión, o undefined. */
export async function authenticateRequest(headers: Headers) {
  const token = cookie.parse(headers.get("cookie") || "")[Session.cookieName];
  if (!token) return undefined;
  const claim = await verifySessionToken(token);
  if (!claim) return undefined;
  const [user] = await getDb().select().from(s.users).where(eq(s.users.id, claim.uid));
  if (!user || !user.activo || !user.passwordHash) return undefined;
  if (huellaPassword(user.passwordHash) !== claim.pv) return undefined;
  return user;
}
