import { and, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { invitations, invitationVersions } from "@/db/schema";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";

const uuidSchema = z.string().uuid();

const restoreVersionSchema = z.object({
  versionId: z.string().uuid(),
});

/**
 * Lists up to 10 most recent version snapshots for an owned invitation.
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
    return NextResponse.json({ error: "ID thiệp không hợp lệ." }, { status: 400 });
  }

  const [owned] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(and(eq(invitations.id, id), eq(invitations.userId, user.id)))
    .limit(1);

  if (!owned) {
    return NextResponse.json({ error: "Không tìm thấy thiệp." }, { status: 404 });
  }

  const versions = await db
    .select()
    .from(invitationVersions)
    .where(eq(invitationVersions.invitationId, id))
    .orderBy(desc(invitationVersions.version))
    .limit(10);

  return NextResponse.json({ versions });
}

/**
 * Restores a selected version snapshot, backing up the current state as `before_restore` first.
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
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 });
  }

  const parsed = restoreVersionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "versionId không hợp lệ.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(invitations)
      .where(and(eq(invitations.id, id), eq(invitations.userId, user.id)))
      .limit(1);

    if (!current) {
      return { kind: "not_found" as const, message: "Không tìm thấy thiệp." };
    }

    const [target] = await tx
      .select()
      .from(invitationVersions)
      .where(
        and(
          eq(invitationVersions.id, parsed.data.versionId),
          eq(invitationVersions.invitationId, id),
        ),
      )
      .limit(1);

    if (!target) {
      return { kind: "not_found" as const, message: "Không tìm thấy phiên bản cần khôi phục." };
    }

    await tx
      .insert(invitationVersions)
      .values({
        invitationId: current.id,
        version: current.version,
        source: "before_restore",
        docJson: current.docJson,
      })
      .onConflictDoNothing();

    const [updated] = await tx
      .update(invitations)
      .set({
        docJson: target.docJson,
        version: sql`${invitations.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(invitations.id, current.id))
      .returning();

    await tx
      .insert(invitationVersions)
      .values({
        invitationId: updated.id,
        version: updated.version,
        source: "restore",
        docJson: updated.docJson,
      })
      .onConflictDoNothing();

    return { kind: "restored" as const, invitation: updated };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ error: result.message }, { status: 404 });
  }

  return NextResponse.json({ invitation: result.invitation });
}
