import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { guests, invitations, wishes } from "@/db/schema";
import { extractClientIp } from "@/modules/auth/csrf";
import { checkIpRateLimit, containsBlockedWord } from "@/modules/led-realtime";

const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

const createWishSchema = z.object({
  senderName: z.string().trim().min(1, "Vui lòng nhập tên người gửi").max(80),
  content: z.string().trim().min(1, "Vui lòng nhập lời chúc").max(500),
  guestId: z.string().uuid().optional(),
});

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await context.params;
  const [invitation] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(and(eq(invitations.slug, slug), eq(invitations.status, "published")))
    .limit(1);

  if (!invitation) {
    return NextResponse.json({ error: "Không tìm thấy thiệp cưới đang mở." }, { status: 404 });
  }

  const approvedWishes = await db
    .select({
      id: wishes.id,
      senderName: wishes.senderName,
      content: wishes.content,
      isApproved: wishes.isApproved,
      createdAt: wishes.createdAt,
    })
    .from(wishes)
    .where(and(eq(wishes.invitationId, invitation.id), eq(wishes.isApproved, true)))
    .orderBy(desc(wishes.createdAt))
    .limit(50);

  return NextResponse.json({ wishes: approvedWishes });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const ip = extractClientIp(req);
  const allowed = await checkIpRateLimit(
    "public-wishes",
    ip,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_SECONDS,
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Bạn đang gửi lời chúc quá nhanh. Vui lòng thử lại sau." },
      { status: 429 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 });
  }

  const parsed = createWishSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu lời chúc không hợp lệ." },
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

  let resolvedGuestId: string | null = null;
  if (parsed.data.guestId) {
    const [guest] = await db
      .select({ id: guests.id })
      .from(guests)
      .where(and(eq(guests.id, parsed.data.guestId), eq(guests.invitationId, invitation.id)))
      .limit(1);
    resolvedGuestId = guest?.id ?? null;
  }

  const blocked = containsBlockedWord(`${parsed.data.senderName} ${parsed.data.content}`);
  const isApproved = !blocked;

  const [wish] = await db
    .insert(wishes)
    .values({
      invitationId: invitation.id,
      guestId: resolvedGuestId,
      senderName: parsed.data.senderName,
      content: parsed.data.content,
      isApproved,
    })
    .returning({
      id: wishes.id,
      invitationId: wishes.invitationId,
      guestId: wishes.guestId,
      senderName: wishes.senderName,
      content: wishes.content,
      isApproved: wishes.isApproved,
      createdAt: wishes.createdAt,
    });

  return NextResponse.json(
    {
      ok: true,
      isApproved,
      wish,
    },
    { status: 201 },
  );
}
