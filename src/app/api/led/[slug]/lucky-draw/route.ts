import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { invitations, ledCheckins, ledSessions } from "@/db/schema";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";
import { getEffectivePlan, getPlanConfig } from "@/modules/billing/plans";
import {
  pickLuckyDrawWinner,
  publishLedEvent,
  resolveLedPhotoPublicUrl,
} from "@/modules/led-realtime";

const luckyDrawRequestSchema = z.object({
  previousWinnerTicket: z.string().trim().max(32).optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  if (!isTrustedOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const effectivePlan = getEffectivePlan(user.plan, user.planExpiresAt);
  const planCfg = getPlanConfig(effectivePlan);
  if (!planCfg.features.ledLuckyDraw) {
    return NextResponse.json(
      { error: "Tính năng Quay Số Trúng Thưởng yêu cầu gói Combo hoặc Pilot Studio." },
      { status: 403 },
    );
  }

  let previousWinnerTicket: string | undefined;
  const rawText = await req.text();
  if (rawText.trim().length > 0) {
    try {
      const parsed = luckyDrawRequestSchema.safeParse(JSON.parse(rawText));
      if (!parsed.success) {
        return NextResponse.json({ error: "Tham số quay số không hợp lệ." }, { status: 400 });
      }
      previousWinnerTicket = parsed.data.previousWinnerTicket;
    } catch {
      return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 });
    }
  }

  const { slug } = await context.params;
  const [target] = await db
    .select({
      ownerId: invitations.userId,
      sessionId: ledSessions.id,
    })
    .from(invitations)
    .innerJoin(ledSessions, eq(ledSessions.invitationId, invitations.id))
    .where(eq(invitations.slug, slug))
    .limit(1);

  if (!target) {
    return NextResponse.json({ error: "Không tìm thấy phiên LED." }, { status: 404 });
  }
  if (target.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const approvedCandidates = await db
    .select({
      id: ledCheckins.id,
      ticketNumber: ledCheckins.ticketNumber,
      guestName: ledCheckins.guestName,
      message: ledCheckins.message,
      photoKey: ledCheckins.photoKey,
    })
    .from(ledCheckins)
    .where(and(eq(ledCheckins.ledSessionId, target.sessionId), eq(ledCheckins.status, "approved")));

  if (approvedCandidates.length === 0) {
    return NextResponse.json(
      { error: "Chưa có khách check-in được duyệt để tham gia quay số." },
      { status: 400 },
    );
  }

  let eligible = approvedCandidates;
  if (previousWinnerTicket && approvedCandidates.length > 1) {
    const filtered = approvedCandidates.filter((c) => c.ticketNumber !== previousWinnerTicket);
    if (filtered.length > 0) {
      eligible = filtered;
    }
  }

  const winner = pickLuckyDrawWinner(eligible);
  if (!winner) {
    return NextResponse.json({ error: "Không thể chọn người trúng thưởng." }, { status: 400 });
  }

  const drawnAt = new Date().toISOString();
  const luckyDrawState = {
    winnerTicket: winner.ticketNumber,
    winnerName: winner.guestName,
    drawnAt,
  };

  await db
    .update(ledSessions)
    .set({
      luckyDrawState,
      updatedAt: new Date(),
    })
    .where(eq(ledSessions.id, target.sessionId));

  const photoUrl = resolveLedPhotoPublicUrl(slug, winner.photoKey);

  await publishLedEvent(slug, {
    type: "lucky_draw",
    winnerTicket: winner.ticketNumber,
    winnerName: winner.guestName,
    drawnAt,
    checkinId: winner.id,
    photoUrl,
  });

  return NextResponse.json({
    winner: {
      id: winner.id,
      ticketNumber: winner.ticketNumber,
      guestName: winner.guestName,
      message: winner.message,
      photoUrl,
      drawnAt,
    },
    luckyDrawState,
  });
}
