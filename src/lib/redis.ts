import Redis from "ioredis";
import { getEnv } from "@/lib/env";

const globalForRedis = globalThis as unknown as {
  matrimonyRedis?: Redis;
};

/** Returns a shared HMR-safe Redis client for caching, rate limiting, and Pub/Sub publishing. */
export function getRedis(): Redis {
  if (!globalForRedis.matrimonyRedis) {
    const client = new Redis(getEnv().REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
    client.on("error", () => {
      // Prevent unhandled error crashes when Redis is temporarily offline in dev.
    });
    globalForRedis.matrimonyRedis = client;
  }
  return globalForRedis.matrimonyRedis;
}

/** Creates an isolated Redis connection dedicated to Pub/Sub subscriptions (e.g., SSE streams). */
export function createRedisSubscriber(): Redis {
  return new Redis(getEnv().REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
}

/** Probes Redis connectivity via PING. */
export async function checkRedisHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = getRedis();
    if (client.status === "wait") {
      await client.connect();
    }
    const pong = await client.ping();
    return { ok: pong === "PONG" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown Redis error" };
  }
}
