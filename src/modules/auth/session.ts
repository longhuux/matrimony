import crypto from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { authSessions, users } from "@/db/schema";
import { getEnv } from "@/lib/env";

export const SESSION_COOKIE_NAME = "matrimony_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  role: "user" | "admin";
  plan: "free" | "pro" | "combo" | "studio_pilot";
  planExpiresAt: Date | null;
  aiCredits: number;
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function sanitizeHeaderMeta(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, maxLength);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Creates a database-backed session row and sets the httpOnly session cookie.
 */
export async function createSession(
  userId: string,
  meta?: { ipAddress?: string | null; userAgent?: string | null },
): Promise<void> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await db.insert(authSessions).values({
    userId,
    tokenHash,
    expiresAt,
    ipAddress: sanitizeHeaderMeta(meta?.ipAddress, 64),
    userAgent: sanitizeHeaderMeta(meta?.userAgent, 512),
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/**
 * Resolves the currently authenticated user from the session cookie, or returns null.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      emailVerified: users.emailVerified,
      role: users.role,
      plan: users.plan,
      planExpiresAt: users.planExpiresAt,
      aiCredits: users.aiCredits,
    })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(and(eq(authSessions.tokenHash, tokenHash), gt(authSessions.expiresAt, new Date())))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Deletes the current session row from Postgres and clears the cookie.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (rawToken) {
    await db.delete(authSessions).where(eq(authSessions.tokenHash, hashToken(rawToken)));
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}
