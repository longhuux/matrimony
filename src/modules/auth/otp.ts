import crypto from "node:crypto";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiCreditLedger, authOtpTokens, users } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { getRedis } from "@/lib/redis";
import { createSession } from "./session";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_SECONDS = 30;
const OTP_IP_WINDOW_SECONDS = 10 * 60;
const OTP_IP_MAX_REQUESTS = 15;
const MAX_OTP_ATTEMPTS = 5;

/**
 * Typed authentication error carrying an HTTP status code for OTP flows.
 */
export class OtpAuthError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "OtpAuthError";
    this.statusCode = statusCode;
  }
}

function hashOtp(email: string, code: string): string {
  const secret = getEnv().AUTH_SECRET;
  return crypto.createHash("sha256").update(`${secret}:${email}:${code}`).digest("hex");
}

async function enforceOtpRateLimits(email: string, ipAddress?: string | null): Promise<void> {
  try {
    const redis = getRedis();
    if (redis.status === "wait") await redis.connect();

    if (ipAddress) {
      const ipKey = `otp:ip:${ipAddress}`;
      const ipCount = await redis.incr(ipKey);
      if (ipCount === 1) {
        await redis.expire(ipKey, OTP_IP_WINDOW_SECONDS);
      }
      if (ipCount > OTP_IP_MAX_REQUESTS) {
        throw new OtpAuthError("Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.", 429);
      }
    }

    const cooldownKey = `otp:cooldown:${email}`;
    const set = await redis.set(cooldownKey, "1", "EX", OTP_COOLDOWN_SECONDS, "NX");
    if (set !== "OK") {
      throw new OtpAuthError("Vui lòng đợi 30 giây trước khi yêu cầu mã OTP mới.", 429);
    }
    return;
  } catch (err) {
    if (err instanceof OtpAuthError) {
      throw err;
    }
  }

  try {
    const cutoff = new Date(Date.now() - OTP_COOLDOWN_SECONDS * 1000);
    const recent = await db
      .select({ id: authOtpTokens.id })
      .from(authOtpTokens)
      .where(and(eq(authOtpTokens.email, email), gt(authOtpTokens.createdAt, cutoff)))
      .limit(1);

    if (recent[0]) {
      throw new OtpAuthError("Vui lòng đợi 30 giây trước khi yêu cầu mã OTP mới.", 429);
    }
  } catch (err) {
    if (err instanceof OtpAuthError) {
      throw err;
    }
    if (getEnv().NODE_ENV === "production") {
      throw new OtpAuthError("Hệ thống đang bận, vui lòng thử lại sau.", 503);
    }
  }
}

async function sendOtpEmail(email: string, code: string): Promise<void> {
  const env = getEnv();
  if (env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM ?? "Matrimony <noreply@matrimony.vn>",
        to: [email],
        subject: `Mã đăng nhập Matrimony của bạn: ${code}`,
        html: `<p>Mã xác thực OTP của bạn là: <strong style="font-size:20px">${code}</strong></p><p>Mã có hiệu lực trong 10 phút.</p>`,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend API error (${res.status})`);
    }
    return;
  }

  if (env.NODE_ENV !== "production") {
    console.info(`[MATRIMONY DEV OTP] ${email} -> ${code}`);
    return;
  }

  throw new Error("RESEND_API_KEY is required to send OTP emails in production");
}

/**
 * Generates and dispatches a 6-digit login OTP for the requested email address.
 */
export async function requestEmailOtp(
  rawEmail: string,
  meta?: { ipAddress?: string | null },
): Promise<{ ok: true }> {
  const email = rawEmail.trim().toLowerCase();
  await enforceOtpRateLimits(email, meta?.ipAddress);

  const code = crypto.randomInt(100000, 1000000).toString();
  const codeHash = hashOtp(email, code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db
    .update(authOtpTokens)
    .set({ consumedAt: new Date() })
    .where(and(eq(authOtpTokens.email, email), isNull(authOtpTokens.consumedAt)));

  const [inserted] = await db
    .insert(authOtpTokens)
    .values({
      email,
      codeHash,
      expiresAt,
    })
    .returning({ id: authOtpTokens.id });

  try {
    await sendOtpEmail(email, code);
  } catch (err) {
    await db
      .delete(authOtpTokens)
      .where(eq(authOtpTokens.id, inserted.id))
      .catch(() => {});
    try {
      const redis = getRedis();
      if (redis.status === "wait") await redis.connect();
      await redis.del(`otp:cooldown:${email}`);
    } catch {
      // Best-effort cooldown rollback.
    }
    throw err;
  }

  return { ok: true };
}

/**
 * Verifies a 6-digit OTP, creates or updates the user account, and establishes a session.
 */
export async function verifyEmailOtp(
  rawEmail: string,
  rawCode: string,
  meta?: { ipAddress?: string | null; userAgent?: string | null },
): Promise<{ userId: string; isNewUser: boolean }> {
  const email = rawEmail.trim().toLowerCase();
  const code = rawCode.trim();

  const rows = await db
    .select()
    .from(authOtpTokens)
    .where(
      and(
        eq(authOtpTokens.email, email),
        isNull(authOtpTokens.consumedAt),
        gt(authOtpTokens.expiresAt, sql`NOW()`),
      ),
    )
    .orderBy(desc(authOtpTokens.createdAt))
    .limit(1);

  const token = rows[0];
  if (!token) {
    throw new OtpAuthError("Mã OTP không tồn tại hoặc đã hết hạn.", 401);
  }

  const [updatedToken] = await db
    .update(authOtpTokens)
    .set({ attempts: sql`${authOtpTokens.attempts} + 1` })
    .where(
      and(
        eq(authOtpTokens.id, token.id),
        isNull(authOtpTokens.consumedAt),
        gt(authOtpTokens.expiresAt, sql`NOW()`),
        lt(authOtpTokens.attempts, MAX_OTP_ATTEMPTS),
      ),
    )
    .returning();

  if (!updatedToken) {
    throw new OtpAuthError("Bạn đã nhập sai quá số lần cho phép. Vui lòng yêu cầu mã mới.", 401);
  }

  const candidateHash = Buffer.from(hashOtp(email, code), "hex");
  const expectedHash = Buffer.from(updatedToken.codeHash, "hex");
  const isMatch =
    candidateHash.length === expectedHash.length &&
    crypto.timingSafeEqual(candidateHash, expectedHash);

  if (!isMatch) {
    throw new OtpAuthError("Mã OTP không chính xác.", 401);
  }

  const { userId, isNewUser } = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(authOtpTokens)
      .set({ consumedAt: sql`NOW()` })
      .where(and(eq(authOtpTokens.id, updatedToken.id), isNull(authOtpTokens.consumedAt)))
      .returning({ id: authOtpTokens.id });

    if (!claimed) {
      throw new OtpAuthError("Mã OTP đã được sử dụng.", 401);
    }

    const existing = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing[0]) {
      await tx
        .update(users)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(users.id, existing[0].id));
      return { userId: existing[0].id, isNewUser: false };
    }

    const defaultName = email.split("@")[0] ?? "Khách hàng";
    const [created] = await tx
      .insert(users)
      .values({
        email,
        name: defaultName,
        emailVerified: true,
        plan: "free",
        aiCredits: 3,
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });

    if (!created) {
      const [concurrentUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (!concurrentUser) {
        throw new Error("Failed to resolve user account");
      }
      await tx
        .update(users)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(users.id, concurrentUser.id));
      return { userId: concurrentUser.id, isNewUser: false };
    }

    await tx.insert(aiCreditLedger).values({
      userId: created.id,
      delta: 3,
      balanceAfter: 3,
      reason: "plan_grant",
      refId: "free",
    });

    return { userId: created.id, isNewUser: true };
  });

  await createSession(userId, {
    ipAddress: meta?.ipAddress ? meta.ipAddress.slice(0, 64) : null,
    userAgent: meta?.userAgent,
  });

  return { userId, isNewUser };
}
