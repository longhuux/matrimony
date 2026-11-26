import { count, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { weddingProfiles } from "@/db/schema";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";
import { weddingProfileDataSchema } from "@/modules/invitation-engine/schema";

const MAX_PROFILES_PER_USER = 5;

const createProfileSchema = weddingProfileDataSchema.extend({
  name: z.string().trim().min(1, "Tên hồ sơ không được để trống").max(80),
  photoKeys: z.array(z.string().trim().min(1).max(300)).max(20).optional().default([]),
});

/**
 * Lists all wedding profiles belonging to the authenticated user.
 */
export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const profiles = await db
    .select()
    .from(weddingProfiles)
    .where(eq(weddingProfiles.userId, user.id))
    .orderBy(desc(weddingProfiles.updatedAt));

  return NextResponse.json({ profiles });
}

/**
 * Creates a reusable wedding profile (up to 5 per user).
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

  const parsed = createProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu hồ sơ không hợp lệ.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(weddingProfiles)
    .where(eq(weddingProfiles.userId, user.id));

  if (total >= MAX_PROFILES_PER_USER) {
    return NextResponse.json(
      { error: `Mỗi tài khoản chỉ lưu tối đa ${MAX_PROFILES_PER_USER} hồ sơ đám cưới.` },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(weddingProfiles)
    .values({
      userId: user.id,
      name: parsed.data.name,
      groomInfo: parsed.data.groom,
      brideInfo: parsed.data.bride,
      events: parsed.data.events,
      bankAccounts: parsed.data.bankAccounts,
      photoKeys: parsed.data.photoKeys,
    })
    .returning();

  return NextResponse.json({ profile: created }, { status: 201 });
}
