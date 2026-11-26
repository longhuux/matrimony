import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  matrimonyPool?: Pool;
};

function getPool(): Pool {
  if (!globalForDb.matrimonyPool) {
    globalForDb.matrimonyPool = new Pool({
      connectionString: getEnv().DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 3_000,
    });
    globalForDb.matrimonyPool.on("error", (err) => {
      console.error("[db] Idle client error:", err.message);
    });
  }
  return globalForDb.matrimonyPool;
}

export const db = drizzle(getPool(), { schema });

/** Verifies PostgreSQL connectivity with a lightweight SELECT 1 probe. */
export async function checkPostgresHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getPool().query("SELECT 1");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown Postgres error" };
  }
}
