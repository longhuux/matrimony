import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { invitations, wishes } from "@/db/schema";
import { toCsvWithBom } from "@/lib/csv";
import { getCurrentUser } from "@/modules/auth/session";

const uuidSchema = z.string().uuid();

/**
 * Lists wishes across the authenticated user's invitations (or a specific invitationId), with optional CSV export.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const url = new URL(req.url);
  const invitationIdParam = url.searchParams.get("invitationId");
  const format = url.searchParams.get("format");

  let filterInvIds: string[];

  if (invitationIdParam) {
    if (!uuidSchema.safeParse(invitationIdParam).success) {
      return NextResponse.json({ error: "invitationId không hợp lệ." }, { status: 400 });
    }

    const [owned] = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(and(eq(invitations.id, invitationIdParam), eq(invitations.userId, user.id)))
      .limit(1);

    if (!owned) {
      return NextResponse.json({ error: "Không tìm thấy thiệp." }, { status: 404 });
    }
    filterInvIds = [owned.id];
  } else {
    const ownedRows = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(eq(invitations.userId, user.id));
    filterInvIds = ownedRows.map((row) => row.id);
  }

  const rows =
    filterInvIds.length === 0
      ? []
      : await db
          .select({
            id: wishes.id,
            invitationId: wishes.invitationId,
            invitationTitle: invitations.title,
            guestId: wishes.guestId,
            senderName: wishes.senderName,
            content: wishes.content,
            isApproved: wishes.isApproved,
            createdAt: wishes.createdAt,
          })
          .from(wishes)
          .innerJoin(invitations, eq(wishes.invitationId, invitations.id))
          .where(inArray(wishes.invitationId, filterInvIds))
          .orderBy(desc(wishes.createdAt));

  if (format === "csv") {
    const csv = toCsvWithBom(
      ["Người gửi", "Lời chúc", "Thiệp", "Trạng thái", "Thời gian"],
      rows.map((w) => [
        w.senderName,
        w.content,
        w.invitationTitle,
        w.isApproved ? "Đã duyệt" : "Đang ẩn",
        w.createdAt.toISOString(),
      ]),
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="wishes.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({ wishes: rows });
}
