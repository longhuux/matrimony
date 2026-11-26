import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { ledCheckins } from "@/db/schema";
import { getCurrentUser } from "@/modules/auth/session";
import {
  fetchLedPublicFeed,
  getLedSessionCounts,
  toLedCheckinCard,
} from "@/modules/led-realtime";

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await context.params;
  const feed = await fetchLedPublicFeed(slug);
  if (!feed) {
    return NextResponse.json({ error: "Không tìm thấy phiên LED." }, { status: 404 });
  }

  const basePayload = {
    invitation: feed.invitation,
    session: feed.session,
    approved: feed.approved,
  };

  const scope = new URL(req.url).searchParams.get("scope");
  if (scope === "mod") {
    const user = await getCurrentUser();
    if (user && user.id === feed.ownerId) {
      const [pendingRows, rejectedRows, counts] = await Promise.all([
        db
          .select()
          .from(ledCheckins)
          .where(and(eq(ledCheckins.ledSessionId, feed.sessionId), eq(ledCheckins.status, "pending")))
          .orderBy(desc(ledCheckins.createdAt))
          .limit(200),
        db
          .select()
          .from(ledCheckins)
          .where(
            and(eq(ledCheckins.ledSessionId, feed.sessionId), eq(ledCheckins.status, "rejected")),
          )
          .orderBy(desc(ledCheckins.moderatedAt), desc(ledCheckins.createdAt))
          .limit(200),
        getLedSessionCounts(feed.sessionId),
      ]);

      return NextResponse.json({
        ...basePayload,
        pending: pendingRows.map((row) => toLedCheckinCard(slug, row)),
        rejected: rejectedRows.map((row) => toLedCheckinCard(slug, row)),
        counts,
      });
    }
  }

  return NextResponse.json(basePayload);
}
