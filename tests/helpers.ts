import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/mysql2/migrator";
import path from "path";
import * as s from "@db/schema";
import { getDb } from "../api/queries/connection";
import { createCallerFactory } from "../api/middleware";
import { appRouter } from "../api/router";
import { hashPassword } from "../api/auth/password";
import type { Rol } from "@contracts/constants";

/** Borra todo y vuelve a crear las tablas. Solo corre contra una base de pruebas. */
export async function baseLimpia() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/_test$/.test(new URL(url).pathname)) {
    throw new Error("Las pruebas solo corren contra una base cuyo nombre termina en _test.");
  }
  const db = getDb();
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  const [tablas] = (await db.execute(sql`SHOW TABLES`)) as unknown as [Record<string, string>[]];
  for (const t of tablas) await db.execute(sql.raw(`DROP TABLE \`${Object.values(t)[0]}\``));
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
  await migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, "../db/migrations") });
}

export async function crearUsuario(username: string, role: Rol, password = "Prueba12345") {
  const [{ id }] = await getDb()
    .insert(s.users)
    .values({ username, nombre: `Usuario ${username}`, role, passwordHash: await hashPassword(password) })
    .$returningId();
  return (await getDb().select().from(s.users).where(eq(s.users.id, id)))[0];
}

const factory = createCallerFactory(appRouter);

export function callerDe(user?: s.User) {
  return factory({ req: new Request("http://localhost:3000/"), resHeaders: new Headers(), user });
}
