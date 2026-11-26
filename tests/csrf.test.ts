import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvCacheForTests } from "@/lib/env";
import { extractClientIp, isTrustedOrigin } from "@/modules/auth/csrf";

describe("CSRF Origin & Client IP Extraction", () => {
  const originalAppUrl = process.env.APP_URL;

  beforeEach(() => {
    resetEnvCacheForTests();
    process.env.APP_URL = "https://matrimony.vn";
  });

  afterEach(() => {
    if (originalAppUrl === undefined) {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = originalAppUrl;
    }
    resetEnvCacheForTests();
  });

  it("extracts and sanitizes client IP from x-forwarded-for or falls back to x-real-ip", () => {
    const reqForwarded = new Request("https://matrimony.vn/api/auth/otp/request", {
      headers: {
        "x-forwarded-for": "  203.0.113.10 , 10.0.0.1 ",
        "x-real-ip": "198.51.100.2",
      },
    });
    expect(extractClientIp(reqForwarded)).toBe("203.0.113.10");

    const reqControlChars = {
      headers: new Map([["x-forwarded-for", " 203.0.113.10\x00\x1f , 10.0.0.1 "]]),
    } as unknown as Request;
    expect(extractClientIp(reqControlChars)).toBe("203.0.113.10");

    const reqRealIp = new Request("https://matrimony.vn/api/auth/otp/request", {
      headers: {
        "x-real-ip": " 198.51.100.2 ",
      },
    });
    expect(extractClientIp(reqRealIp)).toBe("198.51.100.2");

    const longIp = "a".repeat(80);
    const reqLongIp = new Request("https://matrimony.vn/api/auth/otp/request", {
      headers: { "x-forwarded-for": longIp },
    });
    expect(extractClientIp(reqLongIp)).toHaveLength(64);

    const reqNoIp = new Request("https://matrimony.vn/api/auth/otp/request");
    expect(extractClientIp(reqNoIp)).toBeNull();
  });

  it("allows APP_URL and matching Host origin, and rejects cross-site or untrusted origins", () => {
    const trustedAppOrigin = new Request("https://matrimony.vn/api/auth/logout", {
      method: "POST",
      headers: {
        origin: "https://matrimony.vn",
        "sec-fetch-site": "same-origin",
      },
    });
    expect(isTrustedOrigin(trustedAppOrigin)).toBe(true);

    const trustedHostOrigin = new Request("http://127.0.0.1:3011/api/auth/logout", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3011",
        origin: "http://127.0.0.1:3011",
      },
    });
    expect(isTrustedOrigin(trustedHostOrigin)).toBe(true);

    const crossSiteReq = new Request("https://matrimony.vn/api/auth/logout", {
      method: "POST",
      headers: {
        origin: "https://matrimony.vn",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(isTrustedOrigin(crossSiteReq)).toBe(false);

    const untrustedOriginReq = new Request("https://matrimony.vn/api/auth/logout", {
      method: "POST",
      headers: {
        host: "matrimony.vn",
        origin: "https://evil.example",
      },
    });
    expect(isTrustedOrigin(untrustedOriginReq)).toBe(false);

    const nullOriginReq = new Request("https://matrimony.vn/api/auth/logout", {
      method: "POST",
      headers: {
        host: "matrimony.vn",
        origin: "null",
      },
    });
    expect(isTrustedOrigin(nullOriginReq)).toBe(false);

    const untrustedRefererReq = new Request("https://matrimony.vn/api/auth/logout", {
      method: "POST",
      headers: {
        host: "matrimony.vn",
        referer: "https://evil.example/attack.html",
      },
    });
    expect(isTrustedOrigin(untrustedRefererReq)).toBe(false);

    const nonBrowserReq = new Request("https://matrimony.vn/api/auth/logout", {
      method: "POST",
      headers: {
        host: "matrimony.vn",
      },
    });
    expect(isTrustedOrigin(nonBrowserReq)).toBe(true);
  });
});
