import { drizzle } from "drizzle-orm/mysql2";
import { env } from "../lib/env";
import * as schema from "@db/schema";

let instance: ReturnType<typeof drizzle<typeof schema>>;

export function getDb() {
  if (!instance) {
    instance = drizzle(env.databaseUrl, { mode: "default", schema });
  }
  return instance;
}

export type Db = ReturnType<typeof getDb>;
/** La base o una transacción abierta. */
export type Tx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];
