import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getEnv, parseServerEnv, resetEnvCacheForTests } from "@/lib/env";

describe("Server Environment Validation", () => {
  const originalEnv = { ...process.env };

  const validProdEnv = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://prod_user:strong_pass@db.matrimony.vn:5432/matrimony",
    REDIS_URL: "redis://redis.matrimony.vn:6379",
    APP_URL: "https://matrimony.vn",
    AUTH_SECRET: "a-very-strong-production-secret-key-at-least-32-chars",
  };

  beforeEach(() => {
    resetEnvCacheForTests();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetEnvCacheForTests();
  });

  it("throws in production on default AUTH_SECRET, default DATABASE_URL, and localhost APP_URL", () => {
    expect(() => parseServerEnv({ NODE_ENV: "production" })).toThrow(
      /AUTH_SECRET must be at least 32 characters and not the development default/,
    );
    expect(() => parseServerEnv({ NODE_ENV: "production" })).toThrow(
      /DATABASE_URL must not use the development default in production/,
    );
    expect(() => parseServerEnv({ NODE_ENV: "production" })).toThrow(
      /APP_URL must not point to localhost or 127\.0\.0\.1 in production/,
    );

    expect(() =>
      parseServerEnv({
        ...validProdEnv,
        APP_URL: "http://127.0.0.1:3000",
      }),
    ).toThrow(/APP_URL/);
  });

  it("accepts valid production configuration", () => {
    const parsed = parseServerEnv(validProdEnv);
    expect(parsed.NODE_ENV).toBe("production");
    expect(parsed.APP_URL).toBe("https://matrimony.vn");
    expect(parsed.STORAGE_DRIVER).toBe("local");
  });

  it("allows production build phase with defaults when isBuildPhase or NEXT_PHASE is set", () => {
    const withOption = parseServerEnv({ NODE_ENV: "production" }, { isBuildPhase: true });
    expect(withOption.NODE_ENV).toBe("production");

    const withNextPhase = parseServerEnv({
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
    });
    expect(withNextPhase.NODE_ENV).toBe("production");
  });

  it("requires R2 credentials in production when STORAGE_DRIVER=r2", () => {
    expect(() =>
      parseServerEnv({
        ...validProdEnv,
        STORAGE_DRIVER: "r2",
      }),
    ).toThrow(/R2_ACCOUNT_ID is required when STORAGE_DRIVER=r2/);
  });

  it("caches getEnv() until resetEnvCacheForTests() is called", () => {
    process.env.APP_URL = "https://first.matrimony.vn";
    expect(getEnv().APP_URL).toBe("https://first.matrimony.vn");

    process.env.APP_URL = "https://second.matrimony.vn";
    expect(getEnv().APP_URL).toBe("https://first.matrimony.vn");

    resetEnvCacheForTests();
    expect(getEnv().APP_URL).toBe("https://second.matrimony.vn");
  });
});
