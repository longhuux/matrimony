import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { aiCreditLedger, oauthAccounts, users } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { createSession } from "./session";

const OAUTH_STATE_COOKIE = "matrimony_oauth_state";

export function isGoogleOAuthConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/**
 * Generates a Google OAuth 2.0 authorization URL with PKCE and stores CSRF state in an httpOnly cookie.
 */
export async function createGoogleAuthUrl(): Promise<string> {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth is not configured");
  }

  const state = crypto.randomBytes(24).toString("hex");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, `${state}.${codeVerifier}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  const redirectUri = `${env.APP_URL.replace(/\/+$/, "")}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email?: boolean;
  name?: string;
  picture?: string;
}

/**
 * Exchanges the Google OAuth code for user profile details and creates a database session.
 */
export async function handleGoogleCallback(
  code: string,
  state: string,
  meta?: { ipAddress?: string | null; userAgent?: string | null },
): Promise<void> {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth is not configured");
  }

  const cookieStore = await cookies();
  const storedCookie = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!storedCookie) {
    throw new Error("Invalid OAuth state");
  }
  const separatorIndex = storedCookie.indexOf(".");
  if (separatorIndex <= 0) {
    throw new Error("Invalid OAuth state");
  }
  const expectedState = storedCookie.slice(0, separatorIndex);
  const codeVerifier = storedCookie.slice(separatorIndex + 1);

  if (!codeVerifier || expectedState.length !== state.length) {
    throw new Error("Invalid OAuth state");
  }
  const matches = crypto.timingSafeEqual(Buffer.from(expectedState), Buffer.from(state));
  if (!matches) {
    throw new Error("Invalid OAuth state");
  }

  const redirectUri = `${env.APP_URL.replace(/\/+$/, "")}/api/auth/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error("Failed to exchange Google OAuth code");
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error("Missing Google access token");
  }

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!profileRes.ok) {
    throw new Error("Failed to fetch Google user profile");
  }
  const profile = (await profileRes.json()) as GoogleUserInfo;
  if (!profile.email || !profile.id) {
    throw new Error("Google account is missing email or ID");
  }
  if (profile.verified_email !== true) {
    throw new Error("Google account email is not verified");
  }

  const email = profile.email.trim().toLowerCase();

  const userId = await db.transaction(async (tx) => {
    const linked = await tx
      .select({ userId: oauthAccounts.userId })
      .from(oauthAccounts)
      .where(
        and(
          eq(oauthAccounts.provider, "google"),
          eq(oauthAccounts.providerAccountId, profile.id),
        ),
      )
      .limit(1);

    if (linked[0]?.userId) {
      return linked[0].userId;
    }

    let resolvedUserId: string;
    const existingByEmail = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingByEmail[0]) {
      resolvedUserId = existingByEmail[0].id;
      await tx
        .update(users)
        .set({
          emailVerified: true,
          avatarUrl: profile.picture ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(users.id, resolvedUserId));
    } else {
      const [created] = await tx
        .insert(users)
        .values({
          email,
          name: profile.name ?? email.split("@")[0] ?? "User",
          avatarUrl: profile.picture ?? null,
          emailVerified: true,
          plan: "free",
          aiCredits: 3,
        })
        .returning({ id: users.id });
      resolvedUserId = created.id;

      await tx.insert(aiCreditLedger).values({
        userId: resolvedUserId,
        delta: 3,
        balanceAfter: 3,
        reason: "plan_grant",
        refId: "free",
      });
    }

    await tx
      .insert(oauthAccounts)
      .values({
        userId: resolvedUserId,
        provider: "google",
        providerAccountId: profile.id,
      })
      .onConflictDoNothing();

    return resolvedUserId;
  });

  await createSession(userId, meta);
}
