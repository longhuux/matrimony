import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { invitations, ledCheckins, ledSessions } from "@/db/schema";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";
import { publishLedEvent, toLedCheckinCard } from "@/modules/led-realtime";

const moderateSchema = z.object({
  checkinId: z.string().uuid("checkinId không hợp lệ"),
  status: z.enum(["approved", "rejected"]),
});

export async function PATCH(
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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 });
  }

  const parsed = moderateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu kiểm duyệt không hợp lệ." },
      { status: 400 },
    );
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

  const [updated] = await db
    .update(ledCheckins)
    .set({
      status: parsed.data.status,
      moderatedAt: new Date(),
    })
    .where(
      and(
        eq(ledCheckins.id, parsed.data.checkinId),
        eq(ledCheckins.ledSessionId, target.sessionId),
      ),
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Không tìm thấy thẻ check-in cần duyệt." }, { status: 404 });
  }

  const card = toLedCheckinCard(slug, updated);
  if (updated.status === "approved") {
    await publishLedEvent(slug, {
      type: "checkin_approved",
      checkin: card,
    });
  } else {
    await publishLedEvent(slug, {
      type: "checkin_removed",
      id: updated.id,
    });
  }

  return NextResponse.json({ checkin: card });
}
