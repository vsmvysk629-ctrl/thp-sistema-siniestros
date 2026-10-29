/**
 * Base de datos de la demo: SQLite (sql.js) en el navegador detrás del driver "proxy" de Drizzle.
 * Las rutas del servidor corren igual que en producción; aquí solo se traduce el SQL de MySQL.
 */
import { drizzle } from "drizzle-orm/mysql-proxy";
import { getTableConfig, type MySqlTable } from "drizzle-orm/mysql-core";
import { is, SQL } from "drizzle-orm";
import type { Database } from "sql.js";
import * as schema from "@db/schema";

let sqlite: Database;
let instance: ReturnType<typeof crearDrizzle>;
let alCambiar: () => void = () => {};

const tablas = Object.values(schema).filter((v): v is MySqlTable => typeof v === "object" && v !== null && "getSQL" in v && Symbol.for("drizzle:IsDrizzleTable") in v);

/** Valor por defecto de cada columna, para traducir el "default" que MySQL acepta en VALUES. */
const defaults = new Map<string, Map<string, string>>();

function literal(v: unknown) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

export function crearTablas(db: Database) {
  for (const t of tablas) {
    const cfg = getTableConfig(t);
    const defs = new Map<string, string>();
    const cols = cfg.columns.map((c) => {
      let d = "";
      if (c.hasDefault && c.default !== undefined) {
        d = is(c.default, SQL) ? "(strftime('%Y-%m-%d %H:%M:%f','now'))" : literal(c.default);
      } else if (!c.notNull) d = "NULL";
      if (d) defs.set(c.name, d);
      if (c.primary && c.autoIncrement) return `\`${c.name}\` INTEGER PRIMARY KEY AUTOINCREMENT`;
      return `\`${c.name}\` ${c.getSQLType().startsWith("decimal") ? "TEXT" : ""}${c.notNull ? " NOT NULL" : ""}${d ? ` DEFAULT ${d}` : ""}${c.isUnique ? " UNIQUE" : ""}`;
    });
    for (const u of cfg.uniqueConstraints) cols.push(`UNIQUE (${u.columns.map((c) => `\`${c.name}\``).join(", ")})`);
    for (const i of cfg.indexes) if (i.config.unique) cols.push(`UNIQUE (${i.config.columns.map((c) => `\`${(c as { name: string }).name}\``).join(", ")})`);
    defaults.set(cfg.name, defs);
    if (db) db.run(`CREATE TABLE IF NOT EXISTS \`${cfg.name}\` (${cols.join(", ")})`);
  }
}

/** Ajusta lo poco del SQL de MySQL que SQLite no entiende. */
function traducir(q: string) {
  q = q.replace(/\s+for update$/i, "");
  const ins = /^insert into `(\w+)` \(([^)]*)\) values (.*?)( on duplicate key update (.*))?$/is.exec(q);
  if (ins) {
    const [, tabla, colsTxt, valores, dup, set] = ins;
    const cols = colsTxt.split(",").map((c) => c.trim().replace(/`/g, ""));
    const defs = defaults.get(tabla) ?? new Map();
    const filas = valores.replace(/\(([^()]*)\)/g, (_m, dentro: string) => {
      const vs = dentro.split(",").map((v) => v.trim());
      return `(${vs.map((v, i) => (v.toLowerCase() === "default" ? (defs.get(cols[i]) ?? "NULL") : v)).join(", ")})`;
    });
    q = `insert into \`${tabla}\` (${colsTxt}) values ${filas}`;
    // ON DUPLICATE KEY UPDATE → UPSERT de SQLite (las tablas que lo usan tienen una sola llave única).
    if (dup) q += ` on conflict do update set ${set}`;
  }
  return q;
}

function param(v: unknown) {
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString().slice(0, -1).replace("T", " ");
  if (v === undefined) return null;
  return v as string | number | null;
}

function crearDrizzle() {
  const db = drizzle(
    async (query, params, method) => {
      const sqlText = traducir(query);
      const ps = params.map(param);
      if (method === "all") {
        const res = sqlite.exec(sqlText, ps);
        return { rows: res[0]?.values ?? [] };
      }
      sqlite.run(sqlText, ps);
      const insertId = Number(sqlite.exec("select last_insert_rowid()")[0].values[0][0]);
      const affectedRows = sqlite.getRowsModified();
      if (!/^select/i.test(sqlText)) alCambiar();
      return { rows: [{ insertId, affectedRows }] as unknown as never[] };
    },
    { mode: "default", schema },
  );
  // Un solo usuario en el navegador: las transacciones corren directo.
  (db as unknown as { transaction: unknown }).transaction = (fn: (tx: unknown) => unknown) => fn(db);
  return db;
}

export function iniciarConexion(db: Database, onChange: () => void) {
  sqlite = db;
  alCambiar = onChange;
  if (!defaults.size) crearTablas(null as unknown as Database);
}

export function getDb() {
  if (!instance) instance = crearDrizzle();
  return instance;
}

export type Db = ReturnType<typeof getDb>;
export type Tx = Db;
