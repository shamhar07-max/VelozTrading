import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // FIX: explicit limit (default 10 is too low under load)
  idleTimeoutMillis: 30_000,  // FIX: release idle connections after 30 s
  connectionTimeoutMillis: 5_000, // FIX: fail fast if pool is exhausted
});

// FIX: log pool errors so connection exhaustion is visible in logs
pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error", err);
});
export const db = drizzle(pool, { schema });

export * from "./schema";
