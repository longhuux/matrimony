import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { createGoogleAuthUrl, isGoogleOAuthConfigured } from "@/modules/auth/google";

export async function GET(): Promise<NextResponse> {
  const appUrl = getEnv().APP_URL;
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", appUrl));
  }
  const url = await createGoogleAuthUrl();
  return NextResponse.redirect(url);
}
