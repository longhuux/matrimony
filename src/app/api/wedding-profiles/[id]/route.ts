import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { weddingProfiles } from "@/db/schema";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";
import { weddingProfileDataSchema } from "@/modules/invitation-engine/schema";

const uuidSchema = z.string().uuid();

const updateProfileSchema = weddingProfileDataSchema.extend({
  name: z.string().trim().min(1, "Tên hồ sơ không được để trống").max(80),
  photoKeys: z.array(z.string().trim().min(1).max(300)).max(20).optional().default([]),
});

/**
 * Fetches a single owned wedding profile by ID.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "ID hồ sơ không hợp lệ." }, { status: 400 });
  }

  const [profile] = await db
    .select()
    .from(weddingProfiles)
    .where(and(eq(weddingProfiles.id, id), eq(weddingProfiles.userId, user.id)))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ error: "Không tìm thấy hồ sơ đám cưới." }, { status: 404 });
  }

  return NextResponse.json({ profile });
}

/**
 * Updates an owned wedding profile by ID.
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
    return NextResponse.json({ error: "ID hồ sơ không hợp lệ." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 });
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu hồ sơ không hợp lệ.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(weddingProfiles)
    .set({
      name: parsed.data.name,
      groomInfo: parsed.data.groom,
      brideInfo: parsed.data.bride,
      events: parsed.data.events,
      bankAccounts: parsed.data.bankAccounts,
      photoKeys: parsed.data.photoKeys,
      updatedAt: new Date(),
    })
    .where(and(eq(weddingProfiles.id, id), eq(weddingProfiles.userId, user.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Không tìm thấy hồ sơ đám cưới." }, { status: 404 });
  }

  return NextResponse.json({ profile: updated });
}

/**
 * Deletes an owned wedding profile by ID.
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
    return NextResponse.json({ error: "ID hồ sơ không hợp lệ." }, { status: 400 });
  }

  const [deleted] = await db
    .delete(weddingProfiles)
    .where(and(eq(weddingProfiles.id, id), eq(weddingProfiles.userId, user.id)))
    .returning({ id: weddingProfiles.id });

  if (!deleted) {
    return NextResponse.json({ error: "Không tìm thấy hồ sơ đám cưới." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
