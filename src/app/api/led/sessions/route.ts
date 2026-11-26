import crypto from "node:crypto";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { invitations, ledCheckins, ledSessions } from "@/db/schema";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";
import {
  type LedCheckinCounts,
  type LedThemeMode,
  publishLedEvent,
} from "@/modules/led-realtime";

const themeModeSchema = z.enum(["aurora", "velvet", "starlight", "crimson"]);

const createSessionSchema = z.object({
  invitationId: z.string().uuid("invitationId không hợp lệ"),
  themeMode: themeModeSchema.optional(),
  autoApprove: z.boolean().optional(),
  blockedWords: z.array(z.string().trim().min(1).max(60)).max(100).optional(),
});

const patchSessionSchema = z
  .object({
    sessionId: z.string().uuid().optional(),
    invitationId: z.string().uuid().optional(),
    themeMode: themeModeSchema.optional(),
    autoApprove: z.boolean().optional(),
    blockedWords: z.array(z.string().trim().min(1).max(60)).max(100).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.sessionId || data.invitationId), {
    message: "Cần cung cấp sessionId hoặc invitationId",
  });

function generateStageCode(): string {
  return `STAGE-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function GET(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invitationIdParam = new URL(req.url).searchParams.get("invitationId")?.trim();
  if (invitationIdParam && !z.string().uuid().safeParse(invitationIdParam).success) {
    return NextResponse.json({ error: "invitationId không hợp lệ" }, { status: 400 });
  }

  const conditions = [eq(invitations.userId, user.id)];
  if (invitationIdParam) {
    conditions.push(eq(invitations.id, invitationIdParam));
  }

  const rows = await db
    .select({
      session: ledSessions,
      invitation: {
        id: invitations.id,
        title: invitations.title,
        slug: invitations.slug,
        status: invitations.status,
      },
    })
    .from(ledSessions)
    .innerJoin(invitations, eq(ledSessions.invitationId, invitations.id))
    .where(and(...conditions))
    .orderBy(desc(ledSessions.createdAt));

  const sessionIds = rows.map((row) => row.session.id);
  const countsBySession = new Map<string, LedCheckinCounts>();

  if (sessionIds.length > 0) {
    const countRows = await db
      .select({
        ledSessionId: ledCheckins.ledSessionId,
        status: ledCheckins.status,
        value: count(),
      })
      .from(ledCheckins)
      .where(inArray(ledCheckins.ledSessionId, sessionIds))
      .groupBy(ledCheckins.ledSessionId, ledCheckins.status);

    for (const row of countRows) {
      const existing = countsBySession.get(row.ledSessionId) ?? {
        pending: 0,
        approved: 0,
        rejected: 0,
        total: 0,
      };
      const num = Number(row.value);
      if (row.status === "pending") existing.pending = num;
      else if (row.status === "approved") existing.approved = num;
      else if (row.status === "rejected") existing.rejected = num;
      existing.total += num;
      countsBySession.set(row.ledSessionId, existing);
    }
  }

  const sessions = rows.map((row) => ({
    ...row.session,
    invitation: row.invitation,
    counts: countsBySession.get(row.session.id) ?? {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: 0,
    },
  }));

  return NextResponse.json({ sessions });
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!isTrustedOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
        { status: 400 },
      );
    }

    const [ownedInvitation] = await db
      .select({
        id: invitations.id,
        title: invitations.title,
        slug: invitations.slug,
        status: invitations.status,
      })
      .from(invitations)
      .where(
        and(eq(invitations.id, parsed.data.invitationId), eq(invitations.userId, user.id)),
      )
      .limit(1);

    if (!ownedInvitation) {
      return NextResponse.json({ error: "Không tìm thấy thiệp cưới thuộc quyền sở hữu" }, { status: 404 });
    }

    const [existing] = await db
      .select()
      .from(ledSessions)
      .where(eq(ledSessions.invitationId, ownedInvitation.id))
      .limit(1);

    if (existing) {
      return NextResponse.json({
        session: existing,
        invitation: ownedInvitation,
        created: false,
      });
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const [created] = await db
          .insert(ledSessions)
          .values({
            invitationId: ownedInvitation.id,
            stageCode: generateStageCode(),
            themeMode: parsed.data.themeMode ?? "aurora",
            autoApprove: parsed.data.autoApprove ?? false,
            blockedWords: parsed.data.blockedWords ?? [],
            isActive: true,
          })
          .onConflictDoNothing({ target: ledSessions.invitationId })
          .returning();

        if (!created) {
          const [concurrent] = await db
            .select()
            .from(ledSessions)
            .where(eq(ledSessions.invitationId, ownedInvitation.id))
            .limit(1);
          if (concurrent) {
            return NextResponse.json({
              session: concurrent,
              invitation: ownedInvitation,
              created: false,
            });
          }
        } else {
          return NextResponse.json(
            {
              session: created,
              invitation: ownedInvitation,
              created: true,
            },
            { status: 201 },
          );
        }
      } catch (err) {
        const pgCode = (err as { code?: string })?.code;
        if (pgCode === "23505" && attempt < 4) {
          continue;
        }
        throw err;
      }
    }

    return NextResponse.json({ error: "Không thể khởi tạo mã sân khấu LED" }, { status: 500 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Không thể tạo phiên LED";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request): Promise<NextResponse> {
  if (!isTrustedOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = patchSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dữ liệu cập nhật không hợp lệ" },
        { status: 400 },
      );
    }

    const matchConditions = [eq(invitations.userId, user.id)];
    if (parsed.data.sessionId) {
      matchConditions.push(eq(ledSessions.id, parsed.data.sessionId));
    }
    if (parsed.data.invitationId) {
      matchConditions.push(eq(ledSessions.invitationId, parsed.data.invitationId));
    }

    const [target] = await db
      .select({
        session: ledSessions,
        slug: invitations.slug,
      })
      .from(ledSessions)
      .innerJoin(invitations, eq(ledSessions.invitationId, invitations.id))
      .where(and(...matchConditions))
      .limit(1);

    if (!target) {
      return NextResponse.json({ error: "Không tìm thấy phiên LED" }, { status: 404 });
    }

    const updates: Partial<typeof ledSessions.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (parsed.data.themeMode !== undefined) updates.themeMode = parsed.data.themeMode;
    if (parsed.data.autoApprove !== undefined) updates.autoApprove = parsed.data.autoApprove;
    if (parsed.data.blockedWords !== undefined) updates.blockedWords = parsed.data.blockedWords;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    const [updated] = await db
      .update(ledSessions)
      .set(updates)
      .where(eq(ledSessions.id, target.session.id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Không tìm thấy phiên LED" }, { status: 404 });
    }

    await publishLedEvent(target.slug, {
      type: "theme_changed",
      themeMode: updated.themeMode as LedThemeMode,
      autoApprove: updated.autoApprove,
      isActive: updated.isActive,
    });

    return NextResponse.json({ session: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Không thể cập nhật phiên LED";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
