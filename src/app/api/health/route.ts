import { NextResponse } from "next/server";
import { checkPostgresHealth } from "@/db";
import { getEnv } from "@/lib/env";
import { checkRedisHealth } from "@/lib/redis";

/**
 * Reports service health while hiding internal error details in production.
 */
export async function GET(): Promise<NextResponse> {
  const [postgres, redis] = await Promise.all([
    checkPostgresHealth(),
    checkRedisHealth(),
  ]);

  const ok = postgres.ok && redis.ok;
  const isProd = getEnv().NODE_ENV === "production";

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      services: isProd
        ? {
            postgres: { ok: postgres.ok },
            redis: { ok: redis.ok },
          }
        : {
            postgres,
            redis,
          },
    },
    { status: ok ? 200 : 503 },
  );
}
