import { and, desc, eq, isNull, sql } from "drizzle-orm";
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
import { guests, invitations, users, weddingProfiles, wishes } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { getRedis } from "@/lib/redis";
import { SITE_CONFIG } from "@/lib/site-config";
import { getEffectivePlan, getPlanConfig } from "@/modules/billing/plans";
import { hydrateDocumentWithProfile } from "@/modules/invitation-engine/schema";

export const dynamic = "force-dynamic";

interface PersonalizedInviteRecord {
  guestId: string;
  inviteCode: string;
  fullName: string;
  salutation: string;
  greeting: string;
  rsvpStatus: "pending" | "attending" | "declined";
  viewedAt: Date | null;
  invitationId: string;
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

async function loadPersonalizedInvite(code: string): Promise<PersonalizedInviteRecord | null> {
  const [row] = await db
    .select({
      guestId: guests.id,
      inviteCode: guests.inviteCode,
      fullName: guests.fullName,
      salutation: guests.salutation,
      greeting: guests.greeting,
      rsvpStatus: guests.rsvpStatus,
      viewedAt: guests.viewedAt,
      invitationId: invitations.id,
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
    .from(guests)
    .innerJoin(invitations, eq(guests.invitationId, invitations.id))
    .innerJoin(users, eq(invitations.userId, users.id))
    .where(eq(guests.inviteCode, code))
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

async function tryIncrementViewCount(invitationId: string, slug: string): Promise<void> {
  const hdrs = await headers();
  const forwarded = hdrs.get("x-forwarded-for");
  const raw = forwarded ? forwarded.split(",")[0] : hdrs.get("x-real-ip");
  const ip = raw?.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 64) || "unknown";
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
    shouldIncrement = false;
  }

  if (!shouldIncrement) return;

  try {
    await db
      .update(invitations)
      .set({ viewCount: sql`${invitations.viewCount} + 1` })
      .where(eq(invitations.id, invitationId));
  } catch {
    // Safe fallback
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const record = await loadPersonalizedInvite(code);

  if (!record || record.status !== "published") {
    return {
      title: `Thiệp mời cá nhân hóa | ${SITE_CONFIG.brandName}`,
      description: SITE_CONFIG.description,
    };
  }

  const title = `Trân trọng kính mời ${record.salutation} ${record.fullName} | ${record.title}`;
  const description =
    record.greeting.trim() || record.docJson.seo?.description?.trim() || SITE_CONFIG.description;
  const ogImageUrl = `/api/og/${encodeURIComponent(record.slug)}?guest=${encodeURIComponent(
    record.inviteCode,
  )}&v=${record.version}`;

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

export default async function PersonalizedInvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<React.ReactElement> {
  const { code } = await params;
  const record = await loadPersonalizedInvite(code);

  if (!record || record.status !== "published") {
    notFound();
  }

  const effectivePlan = getEffectivePlan(record.ownerPlan, record.ownerPlanExpiresAt);
  const planCfg = getPlanConfig(effectivePlan);

  if (
    (record.expiresAt && record.expiresAt.getTime() <= Date.now()) ||
    (planCfg.maxViews !== -1 && record.viewCount >= planCfg.maxViews)
  ) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ivory px-4 py-12 text-ink">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-[var(--shadow-card)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blush text-burgundy">
            <Clock className="h-5 w-5" aria-hidden="true" />
          </div>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-surface px-3 py-1 text-xs font-semibold text-amber-text">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Thiệp tạm ngừng hiển thị
          </span>
          <h1 className="mt-4 font-serif text-2xl font-bold text-ink">
            {record.title}
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-ink-secondary">
            Thiệp cưới đã hết hạn hoặc đạt giới hạn lượt xem của gói hiện tại. Vui lòng liên hệ cô
            dâu &amp; chú rể để biết thêm chi tiết.
          </p>
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

  let hydratedDoc = record.docJson;
  if (record.profileId) {
    const [profile] = await db
      .select()
      .from(weddingProfiles)
      .where(eq(weddingProfiles.id, record.profileId))
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

  const markFirstViewPromise =
    record.viewedAt === null
      ? db
          .update(guests)
          .set({ viewedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(guests.id, record.guestId), isNull(guests.viewedAt)))
          .catch(() => {})
      : Promise.resolve();

  const [approvedWishRows] = await Promise.all([
    db
      .select({
        id: wishes.id,
        senderName: wishes.senderName,
        content: wishes.content,
        createdAt: wishes.createdAt,
      })
      .from(wishes)
      .where(and(eq(wishes.invitationId, record.invitationId), eq(wishes.isApproved, true)))
      .orderBy(desc(wishes.createdAt))
      .limit(100),
    markFirstViewPromise,
    tryIncrementViewCount(record.invitationId, record.slug),
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
        slug={record.slug}
        initialWishes={approvedWishes}
        showWatermark={!planCfg.features.removeWatermark}
        interactive={true}
        previewMode={false}
        guest={{
          inviteCode: record.inviteCode,
          fullName: record.fullName,
          salutation: record.salutation,
          greeting: record.greeting,
          rsvpStatus: record.rsvpStatus,
        }}
      />
    </main>
  );
}
