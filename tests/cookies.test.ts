import { afterEach, describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "../api/lib/cookies";

describe("cookie de sesión", () => {
  afterEach(() => { delete process.env.COOKIE_SECURE; });
  it("secure solo con HTTPS, para que funcione en la red de la oficina", () => {
    expect(getSessionCookieOptions(new Headers({ host: "192.168.1.50:3000" })).secure).toBe(false);
    expect(getSessionCookieOptions(new Headers({ host: "thp.up.railway.app", "x-forwarded-proto": "https" })).secure).toBe(true);
    process.env.COOKIE_SECURE = "true";
    expect(getSessionCookieOptions(new Headers({ host: "192.168.1.50:3000" })).secure).toBe(true);
  });
});
