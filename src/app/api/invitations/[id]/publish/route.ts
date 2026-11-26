import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";
import { getEffectivePlan, getPlanConfig } from "@/modules/billing/plans";

const uuidSchema = z.string().uuid();

const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "login",
  "dashboard",
  "editor",
  "templates",
  "tools",
  "checkin",
  "stage",
  "invite",
  "s",
]);

const publishSchema = z.object({
  status: z.enum(["published", "paused", "draft"]).optional().default("published"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9-]{3,50}$/,
      "Đường dẫn chỉ gồm chữ thường, số và dấu gạch ngang (3-50 ký tự).",
    )
    .optional(),
});

function addMonths(base: Date, months: number): Date {
  const next = new Date(base.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

/**
 * Publishes, pauses, or updates the custom public slug of an owned invitation.
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = publishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Thông tin xuất bản không hợp lệ.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.id, id), eq(invitations.userId, user.id)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Không tìm thấy thiệp." }, { status: 404 });
  }

  const nextSlug = parsed.data.slug;
  if (nextSlug) {
    if (RESERVED_SLUGS.has(nextSlug)) {
      return NextResponse.json(
        { error: "Đường dẫn này được hệ thống bảo lưu. Vui lòng chọn tên khác." },
        { status: 400 },
      );
    }

    const [conflict] = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(and(eq(invitations.slug, nextSlug), ne(invitations.id, id)))
      .limit(1);

    if (conflict) {
      return NextResponse.json(
        { error: "Đường dẫn này đã có người sử dụng. Vui lòng chọn tên khác." },
        { status: 409 },
      );
    }
  }

  const now = new Date();
  const effectivePlan = getEffectivePlan(user.plan, user.planExpiresAt, now);
  const planCfg = getPlanConfig(effectivePlan);

  const updateFields: Partial<typeof invitations.$inferInsert> = {
    status: parsed.data.status,
    updatedAt: now,
  };

  if (nextSlug) {
    updateFields.slug = nextSlug;
  }

  if (parsed.data.status === "published") {
    updateFields.publishedAt = existing.publishedAt ?? now;
    updateFields.expiresAt = addMonths(now, planCfg.durationMonths);
  }

  try {
    const [updated] = await db
      .update(invitations)
      .set(updateFields)
      .where(and(eq(invitations.id, id), eq(invitations.userId, user.id)))
      .returning();

    return NextResponse.json({ invitation: updated });
  } catch (err) {
    const pgCode = typeof err === "object" && err !== null && "code" in err ? err.code : undefined;
    if (pgCode === "23505") {
      return NextResponse.json(
        { error: "Đường dẫn này đã có người sử dụng. Vui lòng chọn tên khác." },
        { status: 409 },
      );
    }
    throw err;
  }
}
