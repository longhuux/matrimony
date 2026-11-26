import crypto from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { invitations, invitationVersions } from "@/db/schema";
import { slugify } from "@/lib/utils";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";
import { canCreateInvitation, getEffectivePlan } from "@/modules/billing/plans";

const uuidSchema = z.string().uuid();

/**
 * Clones an owned invitation into a new draft invitation with a unique slug, respecting plan limits.
 */
export async function POST(
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
    return NextResponse.json({ error: "ID thiệp không hợp lệ." }, { status: 400 });
  }

  const [sourceInv] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.id, id), eq(invitations.userId, user.id)))
    .limit(1);

  if (!sourceInv) {
    return NextResponse.json({ error: "Không tìm thấy thiệp nguồn." }, { status: 404 });
  }

  const effectivePlan = getEffectivePlan(user.plan, user.planExpiresAt);
  const [{ total: currentCount }] = await db
    .select({ total: count() })
    .from(invitations)
    .where(eq(invitations.userId, user.id));

  if (!canCreateInvitation(effectivePlan, currentCount)) {
    return NextResponse.json(
      {
        error: "Bạn đã đạt giới hạn số thiệp của gói hiện tại. Vui lòng nâng cấp để nhân bản thiệp.",
        code: "PLAN_LIMIT_REACHED",
      },
      { status: 403 },
    );
  }

  const nextTitle = `${sourceInv.title} (Bản sao)`.slice(0, 120);
  const baseSlug = slugify(sourceInv.title) || "thiep-cuoi";
  const slug = `${baseSlug.slice(0, 42)}-${crypto.randomBytes(3).toString("hex")}`;

  const cloned = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(invitations)
      .values({
        userId: user.id,
        templateId: sourceInv.templateId,
        profileId: sourceInv.profileId,
        slug,
        title: nextTitle,
        status: "draft",
        version: 1,
        docJson: sourceInv.docJson,
      })
      .returning();

    await tx.insert(invitationVersions).values({
      invitationId: created.id,
      version: 1,
      source: "clone",
      docJson: sourceInv.docJson,
    });

    return created;
  });

  return NextResponse.json({ invitation: cloned }, { status: 201 });
}
