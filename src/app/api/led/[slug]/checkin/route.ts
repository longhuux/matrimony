import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { invitations, ledCheckins, ledSessions, users } from "@/db/schema";
import { extractClientIp } from "@/modules/auth/csrf";
import { getEffectivePlan, getPlanConfig } from "@/modules/billing/plans";
import {
  allocateLuckyTicket,
  checkIpRateLimit,
  containsBlockedWord,
  publishLedEvent,
  resolveLedPhotoPublicUrl,
  sanitizeLedSlug,
  toLedCheckinCard,
} from "@/modules/led-realtime";

const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

const checkinSubmitSchema = z.object({
  guestName: z.string().trim().min(1, "Vui lòng nhập tên của bạn").max(60),
  message: z.string().trim().max(220).optional().default(""),
  photoKey: z.string().trim().max(300).nullable().optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const ip = extractClientIp(req);
  const allowed = await checkIpRateLimit(
    "led-checkin",
    ip,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_SECONDS,
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Bạn đang gửi check-in quá nhanh. Vui lòng thử lại sau." },
      { status: 429 },
    );
  }

  const { slug } = await context.params;
  const safeSlug = sanitizeLedSlug(slug);
  if (!safeSlug) {
    return NextResponse.json({ error: "Slug không hợp lệ." }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 });
  }

  const parsed = checkinSubmitSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu check-in không hợp lệ." },
      { status: 400 },
    );
  }

  const normalizedPhotoKey = parsed.data.photoKey?.trim() || null;
  if (normalizedPhotoKey) {
    const validPrefix = `led/${safeSlug}/`;
    if (
      !normalizedPhotoKey.startsWith(validPrefix) ||
      normalizedPhotoKey.includes("..") ||
      !/^led\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/.test(normalizedPhotoKey)
    ) {
      return NextResponse.json({ error: "Mã ảnh photoKey không hợp lệ." }, { status: 400 });
    }
  }

  const [target] = await db
    .select({
      sessionId: ledSessions.id,
      autoApprove: ledSessions.autoApprove,
      blockedWords: ledSessions.blockedWords,
      ownerPlan: users.plan,
      ownerPlanExpiresAt: users.planExpiresAt,
    })
    .from(invitations)
    .innerJoin(users, eq(invitations.userId, users.id))
    .innerJoin(ledSessions, eq(ledSessions.invitationId, invitations.id))
    .where(and(eq(invitations.slug, slug), eq(ledSessions.isActive, true)))
    .limit(1);

  if (!target) {
    return NextResponse.json(
      { error: "Không tìm thấy phiên check-in LED đang hoạt động." },
      { status: 404 },
    );
  }

  const effectivePlan = getEffectivePlan(target.ownerPlan, target.ownerPlanExpiresAt);
  const planCfg = getPlanConfig(effectivePlan);

  const [{ value: existingCountRaw }] = await db
    .select({ value: count() })
    .from(ledCheckins)
    .where(eq(ledCheckins.ledSessionId, target.sessionId));

  const existingCount = Number(existingCountRaw);
  if (planCfg.ledCheckinLimit !== -1 && existingCount >= planCfg.ledCheckinLimit) {
    return NextResponse.json(
      {
        error:
          "Phiên LED đã đạt giới hạn lượt check-in của gói hiện tại. Vui lòng liên hệ cô dâu chú rể.",
      },
      { status: 403 },
    );
  }

  const combinedText = `${parsed.data.guestName} ${parsed.data.message}`;
  const isBlocked = containsBlockedWord(combinedText, target.blockedWords);
  const status: "approved" | "pending" =
    !isBlocked && target.autoApprove ? "approved" : "pending";

  let inserted: typeof ledCheckins.$inferSelect | undefined;
  let nextSeed = existingCount + 1;

  for (let attempt = 0; attempt < 8; attempt++) {
    const ticketNumber = allocateLuckyTicket(nextSeed + attempt);
    try {
      const [row] = await db
        .insert(ledCheckins)
        .values({
          ledSessionId: target.sessionId,
          guestName: parsed.data.guestName,
          message: parsed.data.message,
          photoKey: normalizedPhotoKey,
          status,
          ticketNumber,
          moderatedAt: status === "approved" ? new Date() : null,
        })
        .returning();
      inserted = row;
      break;
    } catch (err) {
      const pgErr = err as { code?: string; constraint?: string };
      if (
        pgErr.code === "23505" &&
        (!pgErr.constraint || pgErr.constraint === "led_checkins_session_ticket_uidx")
      ) {
        if (attempt === 0) {
          const [{ value: latestCount }] = await db
            .select({ value: count() })
            .from(ledCheckins)
            .where(eq(ledCheckins.ledSessionId, target.sessionId));
          nextSeed = Math.max(nextSeed, Number(latestCount) + 1);
        }
        continue;
      }
      throw err;
    }
  }

  if (!inserted) {
    return NextResponse.json(
      { error: "Hệ thống đang bận cấp số vé, vui lòng thử lại." },
      { status: 503 },
    );
  }

  if (inserted.status === "approved") {
    await publishLedEvent(slug, {
      type: "checkin_approved",
      checkin: toLedCheckinCard(slug, inserted),
    });
  }

  return NextResponse.json(
    {
      id: inserted.id,
      ticketNumber: inserted.ticketNumber,
      status: inserted.status,
      publicUrl: resolveLedPhotoPublicUrl(slug, inserted.photoKey),
    },
    { status: 201 },
  );
}
