// Startup migration runner.
//
// Applies pending SQL migrations from the bundled ./drizzle folder to the
// DATABASE_URL database before the server starts. The Docker CMD chains:
//   node dist/migrate.mjs && node dist/index.mjs
// so every deploy self-migrates and nobody ever runs schema push by hand.
//
// Safety properties:
//  - takes a Postgres advisory lock, so concurrent replicas can't race
//  - each migration runs in its own transaction, recorded in schema_migrations
//  - already-applied files are skipped → fully idempotent across restarts

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ADVISORY_LOCK_KEY = 727_272_001;

const distDir = path.dirname(fileURLToPath(import.meta.url));

// Candidate locations, first match wins:
//  - explicit override (dev / CI)
//  - Docker runtime layout: dist is /app/artifacts/api-server/dist,
//    migrations are copied to /app/migrations (three levels up)
//  - fallback one level shallower for alternative layouts
const CANDIDATE_DIRS = [
  process.env.MIGRATIONS_DIR,
  path.resolve(distDir, "../../../migrations"),
  path.resolve(distDir, "../../migrations"),
].filter((d): d is string => Boolean(d));

function resolveMigrationsDir(): string | null {
  for (const dir of CANDIDATE_DIRS) {
    if (fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith(".sql"))) {
      return dir;
    }
  }
  return null;
}

export interface PendingPlan {
  pending: string[];
  applied: string[];
}

/** Pure planning logic — unit-testable without a database. */
export function planMigrations(
  files: string[], // sorted .sql filenames available on disk
  appliedRows: string[], // names recorded in schema_migrations
): PendingPlan {
  const appliedSet = new Set(appliedRows);
  const applied = files.filter((f) => appliedSet.has(f));
  const pending = files.filter((f) => !appliedSet.has(f));
  return { pending, applied };
}

function loadSqlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    console.warn(`migrate: directory not found: ${dir} — nothing to do`);
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function splitStatements(sql: string): string[] {
  // drizzle-kit separates statements with '--> statement-breakpoint'
  return sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Acquire a connection with retries. Serverless Postgres providers (Neon)
 * auto-suspend idle databases; the first connection after a wake-up can take
 * several seconds, so a single attempt at container boot would crash-loop
 * the deployment for a database that is actually healthy.
 */
async function connectWithRetry(
  pool: pg.Pool,
  attempts = 6,
  baseDelayMs = 2_000,
): Promise<pg.PoolClient> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await pool.connect();
    } catch (err) {
      lastErr = err as Error;
      if (attempt < attempts) {
        const delay = baseDelayMs * attempt;
        console.warn(
          `migrate: database not reachable (${lastErr.message.split("\n")[0]}) — retry ${attempt}/${attempts - 1} in ${delay}ms`
        );
        await sleep(delay);
      }
    }
  }
  throw lastErr!;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set for migrations");
  }

  // Fail fast if no migrations can be located. Booting an app against an
  // empty/unmigrated database silently would be far worse than crashing here.
  const MIGRATIONS_DIR = resolveMigrationsDir();
  if (!MIGRATIONS_DIR) {
    console.error(
      `migrate: FAILED — no .sql migration files found. Searched: ${CANDIDATE_DIRS.join(", ")}`
    );
    process.exit(1);
  }

  const files = loadSqlFiles(MIGRATIONS_DIR);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

  try {
    const client = await connectWithRetry(pool);
    try {
      await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          name       text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      const { rows } = await client.query<{ name: string }>(
        "SELECT name FROM schema_migrations ORDER BY name"
      );
      const plan = planMigrations(files, rows.map((r) => r.name));

      console.log(
        `migrate: ${plan.applied.length} applied, ${plan.pending.length} pending (${files.length} total)`
      );

      for (const file of plan.pending) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
        const statements = splitStatements(sql);
        await client.query("BEGIN");
        try {
          for (const statement of statements) {
            await client.query(statement);
          }
          await client.query(
            "INSERT INTO schema_migrations (name) VALUES ($1)",
            [file]
          );
          await client.query("COMMIT");
          console.log(`migrate: applied ${file} (${statements.length} statements)`);
        } catch (err) {
          await client.query("ROLLBACK");
          throw new Error(`migration ${file} failed: ${(err as Error).message}`);
        }
      }

      if (plan.pending.length === 0) {
        console.log("migrate: database is up to date");
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]);
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("migrate: FAILED —", (err as Error).message);
  process.exit(1);
});
