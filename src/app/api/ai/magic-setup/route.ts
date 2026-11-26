import crypto from "node:crypto";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  invitations,
  invitationVersions,
  templates,
  weddingProfiles,
} from "@/db/schema";
import { getRedis } from "@/lib/redis";
import { slugify } from "@/lib/utils";
import { AiCreditError, consumeAiCreditAndGenerate } from "@/modules/ai/copywriter";
import { isTrustedOrigin } from "@/modules/auth/csrf";
import { getCurrentUser } from "@/modules/auth/session";
import { canCreateInvitation, getEffectivePlan } from "@/modules/billing/plans";
import {
  hydrateDocumentWithProfile,
  invitationDocumentV2Schema,
  type InvitationDocumentV2,
} from "@/modules/invitation-engine/schema";

const MAGIC_SETUP_LIMIT = 10;
const MAGIC_SETUP_WINDOW_SECONDS = 5 * 60;

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

const magicSetupSchema = z.object({
  groomName: z.string().trim().min(1, "Vui lòng nhập tên chú rể").max(80),
  brideName: z.string().trim().min(1, "Vui lòng nhập tên cô dâu").max(80),
  tone: z.enum(["romantic", "formal", "playful"]).default("romantic"),
  meetingStory: z.string().trim().max(500).optional(),
  weddingDate: z.string().trim().max(40).optional(),
  venueName: z.string().trim().max(120).optional(),
  createInvitation: z.boolean().optional().default(false),
  templateSlug: z.string().trim().min(1).max(80).optional(),
  profileId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120).optional(),
  palette: z
    .object({
      primary: hexColorSchema,
      secondary: hexColorSchema,
      accent: hexColorSchema,
      text: hexColorSchema,
      background: hexColorSchema,
    })
    .optional(),
  coverPhoto: z
    .object({
      url: z.string().trim().url().max(500),
      focalPoint: z
        .object({
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
        })
        .optional(),
    })
    .optional(),
});

async function checkMagicSetupRateLimit(userId: string): Promise<boolean> {
  try {
    const redis = getRedis();
    if (redis.status === "wait") await redis.connect();
    const key = `ai:magic-setup:${userId}`;
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, MAGIC_SETUP_WINDOW_SECONDS);
    }
    return current <= MAGIC_SETUP_LIMIT;
  } catch {
    return true;
  }
}

function replaceSimpleTokens(
  doc: InvitationDocumentV2,
  tokens: Record<string, string>,
): InvitationDocumentV2 {
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") {
      return value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (full, key: string) =>
        Object.hasOwn(tokens, key) ? tokens[key] : full,
      );
    }
    if (Array.isArray(value)) return value.map(walk);
    if (value !== null && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = walk(v);
      }
      return out;
    }
    return value;
  };

  return {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      data: walk(section.data) as Record<string, unknown>,
    })),
  };
}

/**
 * Generates AI wedding copy (consuming 1 AI credit) and optionally hydrates and saves a new invitation.
 */
export async function POST(req: Request): Promise<NextResponse> {
  if (!isTrustedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const allowed = await checkMagicSetupRateLimit(user.id);
  if (!allowed) {
    return NextResponse.json(
      { error: "Bạn đã tạo nội dung AI quá nhanh. Vui lòng thử lại sau ít phút." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 });
  }

  const parsed = magicSetupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu AI Magic Setup không hợp lệ.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  let templateRow: typeof templates.$inferSelect | undefined;
  let profileRow: typeof weddingProfiles.$inferSelect | undefined;

  if (data.createInvitation) {
    const effectivePlan = getEffectivePlan(user.plan, user.planExpiresAt);
    const [{ total: invCount }] = await db
      .select({ total: count() })
      .from(invitations)
      .where(eq(invitations.userId, user.id));

    if (!canCreateInvitation(effectivePlan, invCount)) {
      return NextResponse.json(
        {
          error: "Bạn đã đạt giới hạn số thiệp của gói hiện tại. Vui lòng nâng cấp để tạo thêm thiệp.",
          code: "PLAN_LIMIT_REACHED",
        },
        { status: 403 },
      );
    }

    if (data.templateSlug) {
      [templateRow] = await db
        .select()
        .from(templates)
        .where(and(eq(templates.slug, data.templateSlug), eq(templates.isActive, true)))
        .limit(1);
    } else {
      [templateRow] = await db
        .select()
        .from(templates)
        .where(eq(templates.isActive, true))
        .orderBy(asc(templates.tier), asc(templates.createdAt))
        .limit(1);
    }

    if (!templateRow) {
      return NextResponse.json({ error: "Không tìm thấy mẫu thiệp phù hợp." }, { status: 404 });
    }

    if (data.profileId) {
      [profileRow] = await db
        .select()
        .from(weddingProfiles)
        .where(and(eq(weddingProfiles.id, data.profileId), eq(weddingProfiles.userId, user.id)))
        .limit(1);

      if (!profileRow) {
        return NextResponse.json({ error: "Không tìm thấy hồ sơ đám cưới." }, { status: 404 });
      }
    }
  }

  let copyResult: Awaited<ReturnType<typeof consumeAiCreditAndGenerate>>;
  try {
    copyResult = await consumeAiCreditAndGenerate(user.id, {
      groomName: data.groomName,
      brideName: data.brideName,
      tone: data.tone,
      meetingStory: data.meetingStory,
      weddingDate: data.weddingDate,
      venueName: data.venueName,
    });
  } catch (err) {
    if (err instanceof AiCreditError) {
      return NextResponse.json({ error: err.message, code: "NO_AI_CREDITS" }, { status: err.statusCode });
    }
    throw err;
  }

  if (!data.createInvitation || !templateRow) {
    return NextResponse.json({
      copy: copyResult.copy,
      remainingCredits: copyResult.remainingCredits,
    });
  }

  let docJson: InvitationDocumentV2 = templateRow.defaultDoc;
  if (profileRow) {
    docJson = hydrateDocumentWithProfile(docJson, {
      groom: profileRow.groomInfo,
      bride: profileRow.brideInfo,
      events: profileRow.events,
      bankAccounts: profileRow.bankAccounts,
    });
  }

  docJson = replaceSimpleTokens(docJson, {
    groomName: data.groomName,
    groomShortName: data.groomName,
    brideName: data.brideName,
    brideShortName: data.brideName,
    coupleNames: `${data.groomName} & ${data.brideName}`,
    eventDate: data.weddingDate ?? "",
    venueName: data.venueName ?? "",
  });

  if (data.palette) {
    docJson = {
      ...docJson,
      theme: {
        ...docJson.theme,
        palette: data.palette,
      },
    };
  }

  docJson = {
    ...docJson,
    sections: docJson.sections.map((section) => {
      if (section.type === "hero") {
        return {
          ...section,
          data: {
            ...section.data,
            badge: copyResult.copy.badge,
            headline: copyResult.copy.headline,
            inviteMessage: copyResult.copy.inviteMessage,
            ...(data.coverPhoto
              ? {
                  coverPhotoUrl: data.coverPhoto.url,
                  coverFocalPoint: data.coverPhoto.focalPoint ?? { x: 0.5, y: 0.34 },
                }
              : {}),
          },
        };
      }
      if (section.type === "love_story") {
        return {
          ...section,
          data: {
            ...section.data,
            title: copyResult.copy.storyTitle,
            milestones: copyResult.copy.milestones,
          },
        };
      }
      if (section.type === "rsvp_wish") {
        return {
          ...section,
          data: {
            ...section.data,
            wishPrompt: copyResult.copy.wishPrompt,
          },
        };
      }
      return section;
    }),
  };

  const validatedDoc = invitationDocumentV2Schema.parse(docJson);
  const title = data.title ?? `Thiệp cưới ${data.groomName} & ${data.brideName}`;
  const baseSlug = slugify(title) || "thiep-cuoi";
  const slug = `${baseSlug.slice(0, 42)}-${crypto.randomBytes(3).toString("hex")}`;

  const createdInvitation = await db.transaction(async (tx) => {
    const [inv] = await tx
      .insert(invitations)
      .values({
        userId: user.id,
        templateId: templateRow.id,
        profileId: profileRow?.id ?? null,
        slug,
        title,
        status: "draft",
        version: 1,
        docJson: validatedDoc,
      })
      .returning();

    await tx.insert(invitationVersions).values({
      invitationId: inv.id,
      version: 1,
      source: "ai_magic_setup",
      docJson: validatedDoc,
    });

    await tx
      .update(templates)
      .set({ usageCount: sql`${templates.usageCount} + 1` })
      .where(eq(templates.id, templateRow.id));

    return inv;
  });

  return NextResponse.json({
    copy: copyResult.copy,
    remainingCredits: copyResult.remainingCredits,
    invitation: createdInvitation,
  });
}
