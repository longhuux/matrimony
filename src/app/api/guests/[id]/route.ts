import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { guests, invitations } from "@/db/schema";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";

const uuidSchema = z.string().uuid();

const updateGuestSchema = z.object({
  fullName: z.string().trim().min(1).max(100).optional(),
  salutation: z.string().trim().min(1).max(40).optional(),
  greeting: z.string().trim().max(300).optional(),
  groupName: z.string().trim().min(1).max(50).optional(),
  guestSide: z.enum(["groom", "bride", "both"]).optional(),
  rsvpStatus: z.enum(["pending", "attending", "declined"]).optional(),
  attendeeCount: z.number().int().min(0).max(20).optional(),
  transportation: z.string().trim().max(40).optional(),
  note: z.string().trim().max(300).optional(),
  isSent: z.boolean().optional(),
});

/**
 * Updates a guest belonging to an invitation owned by the authenticated user.
 */
export async function PUT(
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
    return NextResponse.json({ error: "ID khách mời không hợp lệ." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 });
  }

  const parsed = updateGuestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu cập nhật khách mời không hợp lệ.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const ownedInvitationIds = db
    .select({ id: invitations.id })
    .from(invitations)
    .where(eq(invitations.userId, user.id));

  const updateFields: Partial<typeof guests.$inferInsert> = {
    ...parsed.data,
    updatedAt: new Date(),
  };

  if (parsed.data.rsvpStatus !== undefined) {
    updateFields.rsvpUpdatedAt = new Date();
  }

  const [updated] = await db
    .update(guests)
    .set(updateFields)
    .where(and(eq(guests.id, id), inArray(guests.invitationId, ownedInvitationIds)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Không tìm thấy khách mời." }, { status: 404 });
  }

  return NextResponse.json({ guest: updated });
}

/**
 * Deletes a guest belonging to an invitation owned by the authenticated user.
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
    return NextResponse.json({ error: "ID khách mời không hợp lệ." }, { status: 400 });
  }

  const ownedInvitationIds = db
    .select({ id: invitations.id })
    .from(invitations)
    .where(eq(invitations.userId, user.id));

  const [deleted] = await db
    .delete(guests)
    .where(and(eq(guests.id, id), inArray(guests.invitationId, ownedInvitationIds)))
    .returning({ id: guests.id });

  if (!deleted) {
    return NextResponse.json({ error: "Không tìm thấy khách mời." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
