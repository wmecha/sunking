/**
 * Database client — wraps postgres.js with a libsql-compatible interface.
 * Connects to Supabase PostgreSQL via DATABASE_URL (Session Pooler URL).
 */
import postgres from 'postgres';

let _sql: ReturnType<typeof postgres> | null = null;

function getSql(): ReturnType<typeof postgres> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Add your Supabase connection string to .env.local'
    );
  }
  _sql = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: { rejectUnauthorized: false }, // Supabase pooler — accept their cert chain
    prepare: false, // Supavisor transaction pool mode doesn't support prepared statements
    transform: {
      undefined: null,
    },
  });
  return _sql;
}

/** Normalise BigInt → number and Date → ISO string so rows can cross RSC boundaries */
function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'bigint') out[k] = Number(v);
    else if (v instanceof Date) out[k] = v.toISOString();
    else out[k] = v;
  }
  return out;
}

/** Convert ? positional params → PostgreSQL $1 $2 … */
function toPostgres(sql: string): string {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

export interface DbResult {
  rows: Record<string, unknown>[];
}

async function execute(
  q: string | { sql: string; args?: unknown[] }
): Promise<DbResult> {
  const client = getSql();
  const str  = typeof q === 'string' ? q : q.sql;
  const args = typeof q === 'string' ? [] : (q.args ?? []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await client.unsafe(toPostgres(str), args as any[]);
  return {
    rows: (result as unknown as Record<string, unknown>[]).map(serializeRow),
  };
}

async function batch(
  stmts: Array<{ sql: string; args?: unknown[] }>,
  _mode?: string
): Promise<void> {
  const client = getSql();
  await client.begin(async (tx) => {
    for (const s of stmts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await tx.unsafe(toPostgres(s.sql), (s.args ?? []) as any[]);
    }
  });
}

const db = { execute, batch };
export type Db = typeof db;
export function getDb(): Db { return db; }
export default getDb;
