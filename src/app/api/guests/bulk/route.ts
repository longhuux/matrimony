import crypto from "node:crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { guests, invitations } from "@/db/schema";
import { parseGuestCsv } from "@/lib/csv";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";
import { getEffectivePlan, getPlanConfig } from "@/modules/billing/plans";

const guestItemSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  salutation: z.string().trim().max(40).optional().default("Bạn"),
  groupName: z.string().trim().max(50).optional().default("ban-be"),
  guestSide: z.enum(["groom", "bride", "both"]).optional().default("groom"),
  greeting: z.string().trim().max(300).optional().default(""),
});

const bulkImportSchema = z.union([
  z.object({
    invitationId: z.string().uuid(),
    csvText: z.string().min(1).max(500_000),
  }),
  z.object({
    invitationId: z.string().uuid(),
    guests: z.array(guestItemSchema).min(1).max(500),
  }),
]);

const bulkMarkSentSchema = z.object({
  invitationId: z.string().uuid().optional(),
  guestIds: z.array(z.string().uuid()).min(1).max(500),
  isSent: z.boolean(),
});

const bulkDeleteSchema = z.object({
  invitationId: z.string().uuid().optional(),
  guestIds: z.array(z.string().uuid()).min(1).max(500),
});

/**
 * Bulk imports guests from CSV text or JSON array into an owned invitation, respecting plan quota.
 */
export async function POST(req: Request): Promise<NextResponse> {
  if (!isTrustedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 });
  }

  const parsed = bulkImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu nhập hàng loạt không hợp lệ.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [owned] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(and(eq(invitations.id, parsed.data.invitationId), eq(invitations.userId, user.id)))
    .limit(1);

  if (!owned) {
    return NextResponse.json({ error: "Không tìm thấy thiệp." }, { status: 404 });
  }

  const rows = "csvText" in parsed.data ? parseGuestCsv(parsed.data.csvText) : parsed.data.guests;
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Không tìm thấy dòng khách mời hợp lệ nào trong dữ liệu." },
      { status: 400 },
    );
  }

  const effectivePlan = getEffectivePlan(user.plan, user.planExpiresAt);
  const planCfg = getPlanConfig(effectivePlan);

  const [{ total: currentCount }] = await db
    .select({ total: count() })
    .from(guests)
    .where(eq(guests.invitationId, owned.id));

  if (
    planCfg.maxGuestsPerInvitation !== -1 &&
    currentCount + rows.length > planCfg.maxGuestsPerInvitation
  ) {
    const remaining = Math.max(0, planCfg.maxGuestsPerInvitation - currentCount);
    return NextResponse.json(
      {
        error: `Số lượng nhập (${rows.length}) vượt quá giới hạn còn lại của gói (${remaining}/${planCfg.maxGuestsPerInvitation} khách). Vui lòng nâng cấp gói Pro để không giới hạn khách mời.`,
        code: "PLAN_LIMIT_REACHED",
      },
      { status: 403 },
    );
  }

  const valuesToInsert = rows.map((row) => ({
    invitationId: owned.id,
    inviteCode: crypto.randomBytes(4).toString("hex").toUpperCase(),
    fullName: row.fullName,
    salutation: row.salutation || "Bạn",
    greeting: row.greeting ?? "",
    groupName: row.groupName || "ban-be",
    guestSide: row.guestSide ?? "groom",
  }));

  const inserted = await db.insert(guests).values(valuesToInsert).returning();

  return NextResponse.json(
    {
      insertedCount: inserted.length,
      guests: inserted,
    },
    { status: 201 },
  );
}

/**
 * Batch updates `isSent` status for selected guests owned by the authenticated user.
 */
export async function PATCH(req: Request): Promise<NextResponse> {
  if (!isTrustedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 });
  }

  const parsed = bulkMarkSentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu cập nhật hàng loạt không hợp lệ.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const ownedInvFilter = parsed.data.invitationId
    ? and(eq(invitations.userId, user.id), eq(invitations.id, parsed.data.invitationId))
    : eq(invitations.userId, user.id);

  const ownedInvitationIds = db
    .select({ id: invitations.id })
    .from(invitations)
    .where(ownedInvFilter);

  const updated = await db
    .update(guests)
    .set({
      isSent: parsed.data.isSent,
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(guests.id, parsed.data.guestIds),
        inArray(guests.invitationId, ownedInvitationIds),
      ),
    )
    .returning({ id: guests.id });

  return NextResponse.json({ updatedCount: updated.length });
}

/**
 * Batch deletes selected guests owned by the authenticated user.
 */
export async function DELETE(req: Request): Promise<NextResponse> {
  if (!isTrustedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 });
  }

  const parsed = bulkDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu xóa hàng loạt không hợp lệ.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const ownedInvFilter = parsed.data.invitationId
    ? and(eq(invitations.userId, user.id), eq(invitations.id, parsed.data.invitationId))
    : eq(invitations.userId, user.id);

  const ownedInvitationIds = db
    .select({ id: invitations.id })
    .from(invitations)
    .where(ownedInvFilter);

  const deleted = await db
    .delete(guests)
    .where(
      and(
        inArray(guests.id, parsed.data.guestIds),
        inArray(guests.invitationId, ownedInvitationIds),
      ),
    )
    .returning({ id: guests.id });

  return NextResponse.json({ deletedCount: deleted.length });
}
