import crypto from "node:crypto";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { guests, invitations, invitationVersions, templates, weddingProfiles, wishes } from "@/db/schema";
import { slugify } from "@/lib/utils";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";
import { canCreateInvitation, getEffectivePlan } from "@/modules/billing/plans";
import { hydrateDocumentWithProfile } from "@/modules/invitation-engine/schema";

const createInvitationSchema = z.object({
  templateSlug: z.string().trim().min(1).max(80),
  profileId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120).optional(),
});

/**
 * Lists the authenticated user's invitations with guest/RSVP and wish counts.
 */
export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(invitations)
    .where(eq(invitations.userId, user.id))
    .orderBy(desc(invitations.updatedAt));

  if (rows.length === 0) {
    return NextResponse.json({ invitations: [] });
  }

  const invIds = rows.map((row) => row.id);

  const [guestStatsRows, wishStatsRows] = await Promise.all([
    db
      .select({
        invitationId: guests.invitationId,
        totalGuests: count(),
        attendingCount: sql<number>`count(*) filter (where ${guests.rsvpStatus} = 'attending')::int`,
      })
      .from(guests)
      .where(inArray(guests.invitationId, invIds))
      .groupBy(guests.invitationId),
    db
      .select({
        invitationId: wishes.invitationId,
        wishCount: count(),
      })
      .from(wishes)
      .where(inArray(wishes.invitationId, invIds))
      .groupBy(wishes.invitationId),
  ]);

  const guestMap = new Map(guestStatsRows.map((g) => [g.invitationId, g]));
  const wishMap = new Map(wishStatsRows.map((w) => [w.invitationId, w.wishCount]));

  const enriched = rows.map((inv) => {
    const gStat = guestMap.get(inv.id);
    return {
      ...inv,
      guestCount: Number(gStat?.totalGuests ?? 0),
      rsvpCount: Number(gStat?.attendingCount ?? 0),
      wishCount: Number(wishMap.get(inv.id) ?? 0),
    };
  });

  return NextResponse.json({ invitations: enriched });
}

/**
 * Creates a new wedding invitation from a template (and optional wedding profile), saving v1 snapshot.
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

  const parsed = createInvitationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu tạo thiệp không hợp lệ.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const effectivePlan = getEffectivePlan(user.plan, user.planExpiresAt);
  const [{ total: currentCount }] = await db
    .select({ total: count() })
    .from(invitations)
    .where(eq(invitations.userId, user.id));

  if (!canCreateInvitation(effectivePlan, currentCount)) {
    return NextResponse.json(
      {
        error: "Bạn đã đạt giới hạn số thiệp của gói hiện tại. Vui lòng nâng cấp để tạo thêm thiệp.",
        code: "PLAN_LIMIT_REACHED",
      },
      { status: 403 },
    );
  }

  const [template] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.slug, parsed.data.templateSlug), eq(templates.isActive, true)))
    .limit(1);

  if (!template) {
    return NextResponse.json({ error: "Không tìm thấy mẫu thiệp đã chọn." }, { status: 404 });
  }

  let docJson = template.defaultDoc;
  let defaultTitle = `Thiệp cưới ${template.name}`;
  let resolvedProfileId: string | null = null;

  if (parsed.data.profileId) {
    const [profile] = await db
      .select()
      .from(weddingProfiles)
      .where(and(eq(weddingProfiles.id, parsed.data.profileId), eq(weddingProfiles.userId, user.id)))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ đám cưới." }, { status: 404 });
    }

    resolvedProfileId = profile.id;
    defaultTitle = `Thiệp cưới ${profile.groomInfo.shortName} & ${profile.brideInfo.shortName}`;
    docJson = hydrateDocumentWithProfile(template.defaultDoc, {
      groom: profile.groomInfo,
      bride: profile.brideInfo,
      events: profile.events,
      bankAccounts: profile.bankAccounts,
    });
  }

  const title = parsed.data.title ?? defaultTitle;
  const baseSlug = slugify(title) || slugify(template.slug) || "thiep-cuoi";
  const slug = `${baseSlug.slice(0, 42)}-${crypto.randomBytes(3).toString("hex")}`;

  const created = await db.transaction(async (tx) => {
    const [invitation] = await tx
      .insert(invitations)
      .values({
        userId: user.id,
        templateId: template.id,
        profileId: resolvedProfileId,
        slug,
        title,
        status: "draft",
        version: 1,
        docJson,
      })
      .returning();

    await tx.insert(invitationVersions).values({
      invitationId: invitation.id,
      version: 1,
      source: "initial",
      docJson,
    });

    await tx
      .update(templates)
      .set({ usageCount: sql`${templates.usageCount} + 1` })
      .where(eq(templates.id, template.id));

    return invitation;
  });

  return NextResponse.json({ invitation: created }, { status: 201 });
}
