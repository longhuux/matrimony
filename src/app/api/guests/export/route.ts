import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { guests, invitations } from "@/db/schema";
import { toCsvWithBom } from "@/lib/csv";
import { getCurrentUser } from "@/modules/auth/session";

const uuidSchema = z.string().uuid();

/**
 * Exports an owned invitation's guest list as a formula-safe UTF-8 BOM CSV attachment.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const url = new URL(req.url);
  const invitationId = url.searchParams.get("invitationId") ?? "";
  if (!uuidSchema.safeParse(invitationId).success) {
    return NextResponse.json({ error: "invitationId không hợp lệ." }, { status: 400 });
  }

  const [owned] = await db
    .select({ id: invitations.id, slug: invitations.slug })
    .from(invitations)
    .where(and(eq(invitations.id, invitationId), eq(invitations.userId, user.id)))
    .limit(1);

  if (!owned) {
    return NextResponse.json({ error: "Không tìm thấy thiệp." }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(guests)
    .where(eq(guests.invitationId, owned.id))
    .orderBy(asc(guests.createdAt));

  const csv = toCsvWithBom(
    [
      "Họ tên",
      "Xưng hô",
      "Nhóm",
      "Nhà",
      "Mã mời",
      "Trạng thái RSVP",
      "Số người",
      "Phương tiện",
      "Đã gửi",
      "Lời mời",
      "Ghi chú",
    ],
    rows.map((g) => [
      g.fullName,
      g.salutation,
      g.groupName,
      g.guestSide,
      g.inviteCode,
      g.rsvpStatus,
      g.attendeeCount,
      g.transportation,
      g.isSent ? "Đã gửi" : "Chưa gửi",
      g.greeting,
      g.note,
    ]),
  );

  const safeFilename = owned.slug.replace(/[^a-z0-9-]/gi, "") || "guests";
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="guests-${safeFilename}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
