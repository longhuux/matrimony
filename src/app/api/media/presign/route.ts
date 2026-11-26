import { and, count, eq, gt, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { invitations, mediaAssets } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";
import { canUploadMedia, getEffectivePlan, getPlanConfig } from "@/modules/billing/plans";
import { createPresignedUpload, presignRequestSchema } from "@/modules/storage/r2";

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
    const parsed = presignRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid upload payload" },
        { status: 400 },
      );
    }

    const effectivePlan = getEffectivePlan(user.plan, user.planExpiresAt);
    const planCfg = getPlanConfig(effectivePlan);

    if (parsed.data.kind === "audio" && !planCfg.features.customMusic) {
      return NextResponse.json(
        { error: "Gói hiện tại chưa hỗ trợ tải lên nhạc nền tùy chỉnh." },
        { status: 403 },
      );
    }
    if (parsed.data.kind === "font" && !planCfg.features.customFont) {
      return NextResponse.json(
        { error: "Gói hiện tại chưa hỗ trợ tải lên phông chữ tùy chỉnh." },
        { status: 403 },
      );
    }

    if (parsed.data.invitationId) {
      const owned = await db
        .select({ id: invitations.id })
        .from(invitations)
        .where(
          and(
            eq(invitations.id, parsed.data.invitationId),
            eq(invitations.userId, user.id),
          ),
        )
        .limit(1);
      if (!owned[0]) {
        return NextResponse.json({ error: "Forbidden invitation reference" }, { status: 403 });
      }
    }

    const env = getEnv();
    const txResult = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`);

      if (parsed.data.kind === "image") {
        const [{ value: imageCount }] = await tx
          .select({ value: count() })
          .from(mediaAssets)
          .where(
            and(
              eq(mediaAssets.userId, user.id),
              eq(mediaAssets.kind, "image"),
              or(
                eq(mediaAssets.status, "confirmed"),
                gt(mediaAssets.createdAt, sql`NOW() - INTERVAL '10 minutes'`),
              ),
            ),
          );

        if (!canUploadMedia(effectivePlan, imageCount)) {
          return {
            ok: false as const,
            status: 403,
            error: "Bạn đã đạt giới hạn ảnh của gói hiện tại. Vui lòng nâng cấp để tải thêm.",
          };
        }
      }

      const presigned = await createPresignedUpload({
        userId: user.id,
        kind: parsed.data.kind,
        mimeType: parsed.data.mimeType,
        sizeBytes: parsed.data.sizeBytes,
      });

      await tx.insert(mediaAssets).values({
        userId: user.id,
        invitationId: parsed.data.invitationId ?? null,
        kind: parsed.data.kind,
        status: env.STORAGE_DRIVER === "local" ? "pending" : "confirmed",
        r2Key: presigned.r2Key,
        publicUrl: presigned.publicUrl,
        mimeType: parsed.data.mimeType,
        sizeBytes: parsed.data.sizeBytes,
      });

      return { ok: true as const, presigned };
    });

    if (!txResult.ok) {
      return NextResponse.json({ error: txResult.error }, { status: txResult.status });
    }

    return NextResponse.json(txResult.presigned);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create upload URL";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
