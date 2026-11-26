import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { guests, invitations } from "@/db/schema";
import { extractClientIp } from "@/modules/auth/csrf";
import { checkIpRateLimit } from "@/modules/led-realtime";

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

const rsvpSchema = z.object({
  fullName: z.string().trim().min(1, "Vui lòng nhập họ tên").max(80),
  rsvpStatus: z.enum(["attending", "declined"]),
  attendeeCount: z.number().int().min(1).max(10),
  guestSide: z.enum(["groom", "bride"]),
  transportation: z.enum(["self", "pickup"]),
  note: z.string().trim().max(300).optional().default(""),
  inviteCode: z.string().trim().max(64).optional(),
});

function generateGuestInviteCode(): string {
  return `rsvp-${crypto.randomBytes(5).toString("hex")}`;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const ip = extractClientIp(req);
  const allowed = await checkIpRateLimit("public-rsvp", ip, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS);
  if (!allowed) {
    return NextResponse.json(
      { error: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau." },
      { status: 429 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 });
  }

  const parsed = rsvpSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu xác nhận tham dự không hợp lệ." },
      { status: 400 },
    );
  }

  const { slug } = await context.params;
  const [invitation] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(and(eq(invitations.slug, slug), eq(invitations.status, "published")))
    .limit(1);

  if (!invitation) {
    return NextResponse.json({ error: "Không tìm thấy thiệp cưới đang mở." }, { status: 404 });
  }

  const normalizedCode = parsed.data.inviteCode?.trim();
  if (normalizedCode) {
    const [existingGuest] = await db
      .select({ id: guests.id })
      .from(guests)
      .where(and(eq(guests.invitationId, invitation.id), eq(guests.inviteCode, normalizedCode)))
      .limit(1);

    if (existingGuest) {
      const [updated] = await db
        .update(guests)
        .set({
          fullName: parsed.data.fullName,
          rsvpStatus: parsed.data.rsvpStatus,
          attendeeCount: parsed.data.attendeeCount,
          guestSide: parsed.data.guestSide,
          transportation: parsed.data.transportation,
          note: parsed.data.note ?? "",
          rsvpUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(guests.id, existingGuest.id))
        .returning();

      return NextResponse.json({ ok: true, guest: updated });
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [created] = await db
        .insert(guests)
        .values({
          invitationId: invitation.id,
          inviteCode: generateGuestInviteCode(),
          fullName: parsed.data.fullName,
          rsvpStatus: parsed.data.rsvpStatus,
          attendeeCount: parsed.data.attendeeCount,
          guestSide: parsed.data.guestSide,
          transportation: parsed.data.transportation,
          note: parsed.data.note ?? "",
          rsvpUpdatedAt: new Date(),
        })
        .returning();

      return NextResponse.json({ ok: true, guest: created }, { status: 201 });
    } catch (err) {
      const pgCode = (err as { code?: string })?.code;
      if (pgCode === "23505" && attempt < 4) {
        continue;
      }
      throw err;
    }
  }

  return NextResponse.json({ error: "Không thể lưu thông tin tham dự." }, { status: 500 });
}
