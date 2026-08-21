import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.hopvviqachszjtbcsgbp:Tomekprague89@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

export const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  return res;
}
