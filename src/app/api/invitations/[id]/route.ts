import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { guests, invitations, invitationVersions, wishes } from "@/db/schema";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";
import { invitationDocumentV2Schema } from "@/modules/invitation-engine/schema";

const uuidSchema = z.string().uuid();

const updateInvitationSchema = z.object({
  docJson: invitationDocumentV2Schema,
  title: z.string().trim().min(1).max(120).optional(),
  expectedVersion: z.number().int().min(1),
  source: z.enum(["manual", "auto"]).optional().default("manual"),
});

/**
 * Fetches an owned invitation along with its latest snapshot and guest/wish statistics.
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

  const [invitation] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.id, id), eq(invitations.userId, user.id)))
    .limit(1);

  if (!invitation) {
    return NextResponse.json({ error: "Không tìm thấy thiệp." }, { status: 404 });
  }

  const [[latestVersion], [guestStats], [wishStats]] = await Promise.all([
    db
      .select()
      .from(invitationVersions)
      .where(eq(invitationVersions.invitationId, invitation.id))
      .orderBy(desc(invitationVersions.version))
      .limit(1),
    db
      .select({
        total: sql<number>`count(*)::int`,
        attending: sql<number>`count(*) filter (where ${guests.rsvpStatus} = 'attending')::int`,
        declined: sql<number>`count(*) filter (where ${guests.rsvpStatus} = 'declined')::int`,
        pending: sql<number>`count(*) filter (where ${guests.rsvpStatus} = 'pending')::int`,
        totalAttendees: sql<number>`coalesce(sum(${guests.attendeeCount}) filter (where ${guests.rsvpStatus} = 'attending'), 0)::int`,
      })
      .from(guests)
      .where(eq(guests.invitationId, invitation.id)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        approved: sql<number>`count(*) filter (where ${wishes.isApproved} = true)::int`,
      })
      .from(wishes)
      .where(eq(wishes.invitationId, invitation.id)),
  ]);

  return NextResponse.json({
    invitation,
    latestVersion: latestVersion ?? null,
    stats: {
      guests: guestStats ?? {
        total: 0,
        attending: 0,
        declined: 0,
        pending: 0,
        totalAttendees: 0,
      },
      wishes: wishStats ?? {
        total: 0,
        approved: 0,
      },
    },
  });
}

/**
 * Updates an owned invitation with optimistic version locking and prunes old auto-save snapshots.
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
    return NextResponse.json({ error: "ID thiệp không hợp lệ." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 });
  }

  const parsed = updateInvitationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu cập nhật thiệp không hợp lệ.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const outcome = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(invitations)
      .set({
        docJson: parsed.data.docJson,
        version: sql`${invitations.version} + 1`,
        updatedAt: new Date(),
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      })
      .where(
        and(
          eq(invitations.id, id),
          eq(invitations.userId, user.id),
          eq(invitations.version, parsed.data.expectedVersion),
        ),
      )
      .returning();

    if (!updated) {
      const [existing] = await tx
        .select({
          id: invitations.id,
          version: invitations.version,
          docJson: invitations.docJson,
        })
        .from(invitations)
        .where(and(eq(invitations.id, id), eq(invitations.userId, user.id)))
        .limit(1);

      if (!existing) {
        return { kind: "not_found" as const };
      }

      return {
        kind: "conflict" as const,
        serverVersion: existing.version,
        serverDoc: existing.docJson,
      };
    }

    await tx
      .insert(invitationVersions)
      .values({
        invitationId: updated.id,
        version: updated.version,
        source: parsed.data.source,
        docJson: updated.docJson,
      })
      .onConflictDoNothing();

    // Prune older auto-save snapshots, keeping the 10 most recent auto versions.
    const staleAutoSnapshots = await tx
      .select({ id: invitationVersions.id })
      .from(invitationVersions)
      .where(
        and(
          eq(invitationVersions.invitationId, updated.id),
          eq(invitationVersions.source, "auto"),
        ),
      )
      .orderBy(desc(invitationVersions.version))
      .offset(10);

    if (staleAutoSnapshots.length > 0) {
      await tx
        .delete(invitationVersions)
        .where(
          inArray(
            invitationVersions.id,
            staleAutoSnapshots.map((s) => s.id),
          ),
        );
    }

    return { kind: "updated" as const, invitation: updated };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ error: "Không tìm thấy thiệp." }, { status: 404 });
  }

  if (outcome.kind === "conflict") {
    return NextResponse.json(
      {
        error: "Xung đột phiên bản: thiệp đã được cập nhật ở tab/thiết bị khác.",
        code: "VERSION_CONFLICT",
        serverVersion: outcome.serverVersion,
        serverDoc: outcome.serverDoc,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ invitation: outcome.invitation });
}

/**
 * Deletes an owned invitation by ID.
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
    return NextResponse.json({ error: "ID thiệp không hợp lệ." }, { status: 400 });
  }

  const [deleted] = await db
    .delete(invitations)
    .where(and(eq(invitations.id, id), eq(invitations.userId, user.id)))
    .returning({ id: invitations.id });

  if (!deleted) {
    return NextResponse.json({ error: "Không tìm thấy thiệp." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
