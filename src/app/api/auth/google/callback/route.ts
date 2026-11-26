import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { extractClientIp } from "@/modules/auth/csrf";
import { handleGoogleCallback } from "@/modules/auth/google";

export async function GET(req: Request): Promise<NextResponse> {
  const appUrl = getEnv().APP_URL;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(new URL("/login?error=google_cancelled", appUrl));
  }

  try {
    await handleGoogleCallback(code, state, {
      ipAddress: extractClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.redirect(new URL("/dashboard", appUrl));
  } catch {
    return NextResponse.redirect(new URL("/login?error=google_failed", appUrl));
  }
}
