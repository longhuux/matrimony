import { z } from "zod";

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://matrimony:matrimony_dev@127.0.0.1:5432/matrimony"),
  REDIS_URL: z.string().min(1).default("redis://127.0.0.1:6379"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z
    .string()
    .min(16)
    .default("dev-only-change-me-in-production-32-chars-minimum"),
  STORAGE_DRIVER: z.enum(["local", "r2"]).default("local"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  PAYOS_CLIENT_ID: z.string().optional(),
  PAYOS_API_KEY: z.string().optional(),
  PAYOS_CHECKSUM_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const DEV_DEFAULT_AUTH_SECRET = "dev-only-change-me-in-production-32-chars-minimum";
const DEV_DEFAULT_DATABASE_URL = "postgresql://matrimony:matrimony_dev@127.0.0.1:5432/matrimony";

let cachedEnv: ServerEnv | null = null;

/**
 * Parses and validates server environment variables, enforcing strict security checks in production.
 */
export function parseServerEnv(
  raw: Record<string, string | undefined>,
  options?: { isBuildPhase?: boolean },
): ServerEnv {
  const parsed = serverEnvSchema.parse({
    NODE_ENV: raw.NODE_ENV,
    DATABASE_URL: raw.DATABASE_URL,
    REDIS_URL: raw.REDIS_URL,
    APP_URL: raw.APP_URL,
    AUTH_SECRET: raw.AUTH_SECRET,
    STORAGE_DRIVER: raw.STORAGE_DRIVER,
    R2_ACCOUNT_ID: raw.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: raw.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: raw.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: raw.R2_BUCKET_NAME,
    R2_PUBLIC_URL: raw.R2_PUBLIC_URL,
    GOOGLE_CLIENT_ID: raw.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: raw.GOOGLE_CLIENT_SECRET,
    RESEND_API_KEY: raw.RESEND_API_KEY,
    EMAIL_FROM: raw.EMAIL_FROM,
    GEMINI_API_KEY: raw.GEMINI_API_KEY,
    PAYOS_CLIENT_ID: raw.PAYOS_CLIENT_ID,
    PAYOS_API_KEY: raw.PAYOS_API_KEY,
    PAYOS_CHECKSUM_KEY: raw.PAYOS_CHECKSUM_KEY,
  });

  const isBuildPhase = options?.isBuildPhase ?? raw.NEXT_PHASE === "phase-production-build";

  if (parsed.NODE_ENV === "production" && !isBuildPhase) {
    const errors: string[] = [];

    if (parsed.AUTH_SECRET.length < 32 || parsed.AUTH_SECRET === DEV_DEFAULT_AUTH_SECRET) {
      errors.push("AUTH_SECRET must be at least 32 characters and not the development default");
    }

    if (parsed.DATABASE_URL === DEV_DEFAULT_DATABASE_URL) {
      errors.push("DATABASE_URL must not use the development default in production");
    }

    const appHostname = new URL(parsed.APP_URL).hostname.toLowerCase();
    if (appHostname === "localhost" || appHostname === "127.0.0.1") {
      errors.push("APP_URL must not point to localhost or 127.0.0.1 in production");
    }

    if (parsed.STORAGE_DRIVER === "r2") {
      const requiredR2Keys = [
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET_NAME",
        "R2_PUBLIC_URL",
      ] as const;
      for (const key of requiredR2Keys) {
        if (!parsed[key]?.trim()) {
          errors.push(`${key} is required when STORAGE_DRIVER=r2`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Invalid production environment configuration:\n- ${errors.join("\n- ")}`);
    }
  }

  return parsed;
}

/**
 * Clears the cached environment configuration (intended for test isolation).
 */
export function resetEnvCacheForTests(): void {
  cachedEnv = null;
}

/**
 * Parses and caches server environment variables with safe development fallbacks.
 */
export function getEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;
  cachedEnv = parseServerEnv(process.env);
  return cachedEnv;
}
