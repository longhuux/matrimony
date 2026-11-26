import { getEnv } from "@/lib/env";

const CONTROL_CHARS_RE = /[\x00-\x1f\x7f]/g;
const MAX_IP_LENGTH = 64;

/**
 * Extracts and sanitizes the client IP address from reverse-proxy headers.
 */
export function extractClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  const raw = forwarded ? forwarded.split(",")[0] : req.headers.get("x-real-ip");
  if (!raw) return null;

  const cleaned = raw.replace(CONTROL_CHARS_RE, "").trim().slice(0, MAX_IP_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

function addHostOrigins(allowed: Set<string>, rawHost: string | null): void {
  if (!rawHost) return;
  const candidate = rawHost.split(",")[0]?.trim();
  if (!candidate || /[\s/\\]/.test(candidate)) return;

  for (const proto of ["http", "https"]) {
    try {
      allowed.add(new URL(`${proto}://${candidate}`).origin);
    } catch {
      // Ignore malformed host headers.
    }
  }
}

/**
 * Validates same-origin CSRF protections using Sec-Fetch-Site, Origin, and Referer headers.
 */
export function isTrustedOrigin(req: Request): boolean {
  const secFetchSite = req.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (secFetchSite === "cross-site") {
    return false;
  }

  const allowedOrigins = new Set<string>();
  try {
    allowedOrigins.add(new URL(getEnv().APP_URL).origin);
  } catch {
    // Ignore invalid APP_URL fallback.
  }

  addHostOrigins(allowedOrigins, req.headers.get("host"));
  addHostOrigins(allowedOrigins, req.headers.get("x-forwarded-host"));

  try {
    allowedOrigins.add(new URL(req.url).origin);
  } catch {
    // Ignore relative or malformed request URLs.
  }

  const origin = req.headers.get("origin");
  if (origin !== null) {
    if (origin.trim().toLowerCase() === "null") {
      return false;
    }
    try {
      return allowedOrigins.has(new URL(origin).origin);
    } catch {
      return false;
    }
  }

  const referer = req.headers.get("referer");
  if (referer !== null && referer.trim() !== "") {
    try {
      return allowedOrigins.has(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  return true;
}
