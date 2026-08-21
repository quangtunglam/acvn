import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

export const isDbConnected = Boolean(process.env.DATABASE_URL);

export const pool = isDbConnected
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : (null as unknown as pg.Pool);

if (pool) {
  pool.on("error", (err) => {
    console.error("pg pool error (idle client):", err.message);
  });
}

export const db = pool ? drizzle(pool, { schema }) : (null as any);

export * from "./schema/index.js";

