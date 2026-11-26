import { and, desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Heart, Sparkles } from "lucide-react";
import {
  InvitationRenderer,
  type InvitationWishItem,
} from "@/components/invitation/invitation-renderer";
import { db } from "@/db";
import { invitations, users, weddingProfiles, wishes } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { getRedis } from "@/lib/redis";
import { SITE_CONFIG } from "@/lib/site-config";
import { getEffectivePlan, getPlanConfig } from "@/modules/billing/plans";
import { hydrateDocumentWithProfile } from "@/modules/invitation-engine/schema";

export const dynamic = "force-dynamic";

interface PublicInvitationRecord {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published" | "paused";
  version: number;
  viewCount: number;
  docJson: typeof invitations.$inferSelect.docJson;
  profileId: string | null;
  expiresAt: Date | null;
  ownerPlan: "free" | "pro" | "combo" | "studio_pilot";
  ownerPlanExpiresAt: Date | null;
}

async function loadPublicInvitation(slug: string): Promise<PublicInvitationRecord | null> {
  const [row] = await db
    .select({
      id: invitations.id,
      slug: invitations.slug,
      title: invitations.title,
      status: invitations.status,
      version: invitations.version,
      viewCount: invitations.viewCount,
      docJson: invitations.docJson,
      profileId: invitations.profileId,
      expiresAt: invitations.expiresAt,
      ownerPlan: users.plan,
      ownerPlanExpiresAt: users.planExpiresAt,
    })
    .from(invitations)
    .innerJoin(users, eq(invitations.userId, users.id))
    .where(eq(invitations.slug, slug))
    .limit(1);

  return row ?? null;
}

function resolveMetadataBase(): URL {
  try {
    return new URL(getEnv().APP_URL);
  } catch {
    return new URL("http://localhost:3000");
  }
}

async function extractClientIpFromHeaders(): Promise<string> {
  const hdrs = await headers();
  const forwarded = hdrs.get("x-forwarded-for");
  const raw = forwarded ? forwarded.split(",")[0] : hdrs.get("x-real-ip");
  const cleaned = raw?.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 64);
  return cleaned && cleaned.length > 0 ? cleaned : "unknown";
}

async function tryIncrementViewCount(invitationId: string, slug: string): Promise<void> {
  const ip = await extractClientIpFromHeaders();
  const throttleKey = `view:inv:${slug}:${ip}`;
  let shouldIncrement = false;

  try {
    const redis = getRedis();
    if (redis.status === "wait") {
      await redis.connect();
    }
    const acquired = await redis.set(throttleKey, "1", "EX", 60, "NX");
    shouldIncrement = acquired === "OK";
  } catch {
    // Fallback safely if Redis is unreachable without failing SSR render.
    shouldIncrement = false;
  }

  if (!shouldIncrement) return;

  try {
    await db
      .update(invitations)
      .set({ viewCount: sql`${invitations.viewCount} + 1` })
      .where(eq(invitations.id, invitationId));
  } catch {
    // Do not interrupt page rendering if view counter update fails.
  }
}

function StatusNoticePage({
  badge,
  title,
  description,
}: {
  badge: string;
  title: string;
  description: string;
}): React.ReactElement {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ivory px-4 py-12 text-ink">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blush text-burgundy">
          <Clock className="h-5 w-5" aria-hidden="true" />
        </div>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-surface px-3 py-1 text-xs font-semibold text-amber-text">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          {badge}
        </span>
        <h1 className="mt-4 font-serif text-2xl font-bold leading-snug text-ink">
          {title}
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-secondary">{description}</p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-burgundy px-5 text-xs font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark"
          >
            <Heart className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            Về trang chủ {SITE_CONFIG.brandName}
          </Link>
        </div>
      </div>
    </main>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const inv = await loadPublicInvitation(slug);
  if (!inv || inv.status !== "published") {
    return {
      title: `Thiệp cưới | ${SITE_CONFIG.brandName}`,
      description: SITE_CONFIG.description,
    };
  }

  const title = inv.docJson.seo?.title?.trim() || inv.title;
  const description = inv.docJson.seo?.description?.trim() || SITE_CONFIG.description;
  const ogImageUrl = `/api/og/${encodeURIComponent(slug)}?v=${inv.version}`;

  return {
    metadataBase: resolveMetadataBase(),
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "vi_VN",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function PublicInvitationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<React.ReactElement> {
  const { slug } = await params;
  const inv = await loadPublicInvitation(slug);

  if (!inv || inv.status === "draft") {
    notFound();
  }

  if (inv.status === "paused") {
    return (
      <StatusNoticePage
        badge="Thiệp đang tạm dừng"
        title={inv.title}
        description="Cô dâu & chú rể hiện đang tạm dừng hiển thị thiệp cưới để cập nhật thêm thông tin. Vui lòng quay lại sau ít phút."
      />
    );
  }

  if (inv.expiresAt && inv.expiresAt.getTime() <= Date.now()) {
    return (
      <StatusNoticePage
        badge="Đã hết hạn hiển thị"
        title={inv.title}
        description="Thiệp cưới này đã kết thúc thời gian lưu trữ công khai. Gia đình có thể gia hạn gói trong bảng điều khiển để mở lại."
      />
    );
  }

  const effectivePlan = getEffectivePlan(inv.ownerPlan, inv.ownerPlanExpiresAt);
  const planCfg = getPlanConfig(effectivePlan);

  if (planCfg.maxViews !== -1 && inv.viewCount >= planCfg.maxViews) {
    return (
      <StatusNoticePage
        badge="Đạt giới hạn lượt xem"
        title={inv.title}
        description={`Thiệp cưới đã đạt giới hạn ${planCfg.maxViews.toLocaleString("vi-VN")} lượt xem của gói ${planCfg.name}. Cô dâu & chú rể có thể nâng cấp gói để mở rộng không giới hạn.`}
      />
    );
  }

  let hydratedDoc = inv.docJson;
  if (inv.profileId) {
    const [profile] = await db
      .select()
      .from(weddingProfiles)
      .where(eq(weddingProfiles.id, inv.profileId))
      .limit(1);
    if (profile) {
      hydratedDoc = hydrateDocumentWithProfile(hydratedDoc, {
        groom: profile.groomInfo,
        bride: profile.brideInfo,
        events: profile.events,
        bankAccounts: profile.bankAccounts,
      });
    }
  }

  const [approvedWishRows] = await Promise.all([
    db
      .select({
        id: wishes.id,
        senderName: wishes.senderName,
        content: wishes.content,
        createdAt: wishes.createdAt,
      })
      .from(wishes)
      .where(and(eq(wishes.invitationId, inv.id), eq(wishes.isApproved, true)))
      .orderBy(desc(wishes.createdAt))
      .limit(100),
    tryIncrementViewCount(inv.id, inv.slug),
  ]);

  const approvedWishes: InvitationWishItem[] = approvedWishRows.map((row) => ({
    id: row.id,
    senderName: row.senderName,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <main>
      <InvitationRenderer
        doc={hydratedDoc}
        slug={inv.slug}
        initialWishes={approvedWishes}
        showWatermark={!planCfg.features.removeWatermark}
        interactive={true}
        previewMode={false}
      />
    </main>
  );
}
