import crypto from "node:crypto";
import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { guests, invitations } from "@/db/schema";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";
import { getEffectivePlan, getPlanConfig } from "@/modules/billing/plans";

const uuidSchema = z.string().uuid();

const createGuestSchema = z.object({
  invitationId: z.string().uuid(),
  fullName: z.string().trim().min(1, "Tên khách mời không được để trống").max(100),
  salutation: z.string().trim().max(40).optional().default("Bạn"),
  greeting: z.string().trim().max(300).optional().default(""),
  groupName: z.string().trim().max(50).optional().default("ban-be"),
  guestSide: z.enum(["groom", "bride", "both"]).optional().default("groom"),
});

/**
 * Lists guests for an owned invitation with optional search/filter criteria and summary statistics.
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
    .select({ id: invitations.id })
    .from(invitations)
    .where(and(eq(invitations.id, invitationId), eq(invitations.userId, user.id)))
    .limit(1);

  if (!owned) {
    return NextResponse.json({ error: "Không tìm thấy thiệp." }, { status: 404 });
  }

  const conditions = [eq(guests.invitationId, invitationId)];
  const search = url.searchParams.get("search")?.trim();
  const groupName = url.searchParams.get("groupName")?.trim();
  const guestSide = url.searchParams.get("guestSide")?.trim();
  const rsvpStatus = url.searchParams.get("rsvpStatus")?.trim();

  if (search) {
    const pattern = `%${search}%`;
    const searchCond = or(
      ilike(guests.fullName, pattern),
      ilike(guests.salutation, pattern),
      ilike(guests.inviteCode, pattern),
    );
    if (searchCond) conditions.push(searchCond);
  }
  if (groupName && groupName !== "all") {
    conditions.push(eq(guests.groupName, groupName));
  }
  if (guestSide && guestSide !== "all") {
    conditions.push(eq(guests.guestSide, guestSide));
  }
  if (rsvpStatus === "pending" || rsvpStatus === "attending" || rsvpStatus === "declined") {
    conditions.push(eq(guests.rsvpStatus, rsvpStatus));
  }

  const [rows, [stats]] = await Promise.all([
    db
      .select()
      .from(guests)
      .where(and(...conditions))
      .orderBy(asc(guests.createdAt)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        attending: sql<number>`count(*) filter (where ${guests.rsvpStatus} = 'attending')::int`,
        declined: sql<number>`count(*) filter (where ${guests.rsvpStatus} = 'declined')::int`,
        pending: sql<number>`count(*) filter (where ${guests.rsvpStatus} = 'pending')::int`,
        sent: sql<number>`count(*) filter (where ${guests.isSent} = true)::int`,
        totalAttendees: sql<number>`coalesce(sum(${guests.attendeeCount}) filter (where ${guests.rsvpStatus} = 'attending'), 0)::int`,
      })
      .from(guests)
      .where(eq(guests.invitationId, invitationId)),
  ]);

  return NextResponse.json({
    guests: rows,
    stats: stats ?? {
      total: 0,
      attending: 0,
      declined: 0,
      pending: 0,
      sent: 0,
      totalAttendees: 0,
    },
  });
}

/**
 * Adds a single guest to an owned invitation, enforcing plan guest quota.
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

  const parsed = createGuestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Thông tin khách mời không hợp lệ.", details: parsed.error.flatten() },
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

  const effectivePlan = getEffectivePlan(user.plan, user.planExpiresAt);
  const planCfg = getPlanConfig(effectivePlan);

  const [{ total: currentCount }] = await db
    .select({ total: count() })
    .from(guests)
    .where(eq(guests.invitationId, owned.id));

  if (planCfg.maxGuestsPerInvitation !== -1 && currentCount >= planCfg.maxGuestsPerInvitation) {
    return NextResponse.json(
      {
        error: `Gói hiện tại giới hạn tối đa ${planCfg.maxGuestsPerInvitation} khách mời cho mỗi thiệp. Vui lòng nâng cấp gói Pro để không giới hạn khách mời.`,
        code: "PLAN_LIMIT_REACHED",
      },
      { status: 403 },
    );
  }

  const inviteCode = crypto.randomBytes(4).toString("hex").toUpperCase();

  const [created] = await db
    .insert(guests)
    .values({
      invitationId: owned.id,
      inviteCode,
      fullName: parsed.data.fullName,
      salutation: parsed.data.salutation || "Bạn",
      greeting: parsed.data.greeting,
      groupName: parsed.data.groupName || "ban-be",
      guestSide: parsed.data.guestSide,
    })
    .returning();

  return NextResponse.json({ guest: created }, { status: 201 });
}
