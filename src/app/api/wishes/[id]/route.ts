import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { invitations, wishes } from "@/db/schema";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";

const uuidSchema = z.string().uuid();

const patchWishSchema = z.object({
  isApproved: z.boolean(),
});

/**
 * Approves or hides a wish on an invitation owned by the authenticated user.
 */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isTrustedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "ID lời chúc không hợp lệ." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 });
  }

  const parsed = patchWishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu cập nhật lời chúc không hợp lệ.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const ownedInvitationIds = db
    .select({ id: invitations.id })
    .from(invitations)
    .where(eq(invitations.userId, user.id));

  const [updated] = await db
    .update(wishes)
    .set({ isApproved: parsed.data.isApproved })
    .where(and(eq(wishes.id, id), inArray(wishes.invitationId, ownedInvitationIds)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Không tìm thấy lời chúc." }, { status: 404 });
  }

  return NextResponse.json({ wish: updated });
}

/**
 * Deletes a wish from an invitation owned by the authenticated user.
 */
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isTrustedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "ID lời chúc không hợp lệ." }, { status: 400 });
  }

  const ownedInvitationIds = db
    .select({ id: invitations.id })
    .from(invitations)
    .where(eq(invitations.userId, user.id));

  const [deleted] = await db
    .delete(wishes)
    .where(and(eq(wishes.id, id), inArray(wishes.invitationId, ownedInvitationIds)))
    .returning({ id: wishes.id });

  if (!deleted) {
    return NextResponse.json({ error: "Không tìm thấy lời chúc." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
