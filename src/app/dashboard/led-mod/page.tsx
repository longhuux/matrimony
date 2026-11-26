import { and, desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MonitorPlay } from "lucide-react";
import {
  LedModConsole,
  type LedModInitialFeed,
  type LedModInvitationItem,
  type LedModSessionItem,
} from "@/components/led/led-mod-console";
import { db } from "@/db";
import { invitations, ledCheckins, ledSessions } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { SITE_CONFIG } from "@/lib/site-config";
import { getCurrentUser } from "@/modules/auth/session";
import { getEffectivePlan, getPlanConfig } from "@/modules/billing/plans";
import {
  type LedCheckinCounts,
  type LedThemeMode,
  getLedSessionCounts,
  toLedCheckinCard,
} from "@/modules/led-realtime";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Điều khiển Màn hình LED & MC | ${SITE_CONFIG.brandName}`,
  description:
    "Duyệt ảnh check-in sảnh tiệc 1 chạm, chọn giao diện LED sân khấu, lọc từ khóa và quay số Lucky Draw.",
};

async function resolvePublicOrigin(): Promise<string> {
  const hdrs = await headers();
  const rawHost = hdrs.get("x-forwarded-host") || hdrs.get("host");
  const host = rawHost?.split(",")[0]?.trim();
  const rawProto = hdrs.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = rawProto === "https" ? "https" : "http";

  if (host && !/[\s/\\]/.test(host)) {
    return `${proto}://${host}`;
  }
  return getEnv().APP_URL.replace(/\/+$/, "");
}

export default async function LedModPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const sp = await searchParams;
  const requestedInvitationId =
    typeof sp.invitationId === "string" ? sp.invitationId.trim() : undefined;
  const requestedSlug = typeof sp.slug === "string" ? sp.slug.trim() : undefined;

  const userInvitations = await db
    .select({
      id: invitations.id,
      slug: invitations.slug,
      title: invitations.title,
      status: invitations.status,
    })
    .from(invitations)
    .where(eq(invitations.userId, user.id))
    .orderBy(desc(invitations.updatedAt));

  const invIds = userInvitations.map((inv) => inv.id);
  const sessionRows =
    invIds.length > 0
      ? await db.select().from(ledSessions).where(inArray(ledSessions.invitationId, invIds))
      : [];

  const sessionMap = new Map(sessionRows.map((s) => [s.invitationId, s]));

  // Determine initial selected invitation
  const selectedInv =
    userInvitations.find((inv) => inv.id === requestedInvitationId) ??
    userInvitations.find((inv) => inv.slug === requestedSlug) ??
    userInvitations.find((inv) => sessionMap.has(inv.id)) ??
    userInvitations[0] ??
    null;

  let initialFeed: LedModInitialFeed | null = null;

  if (selectedInv) {
    const activeSession = sessionMap.get(selectedInv.id);
    if (activeSession) {
      const [pendingRows, approvedRows, rejectedRows, counts] = await Promise.all([
        db
          .select()
          .from(ledCheckins)
          .where(
            and(
              eq(ledCheckins.ledSessionId, activeSession.id),
              eq(ledCheckins.status, "pending"),
            ),
          )
          .orderBy(desc(ledCheckins.createdAt))
          .limit(200),
        db
          .select()
          .from(ledCheckins)
          .where(
            and(
              eq(ledCheckins.ledSessionId, activeSession.id),
              eq(ledCheckins.status, "approved"),
            ),
          )
          .orderBy(desc(ledCheckins.moderatedAt), desc(ledCheckins.createdAt))
          .limit(200),
        db
          .select()
          .from(ledCheckins)
          .where(
            and(
              eq(ledCheckins.ledSessionId, activeSession.id),
              eq(ledCheckins.status, "rejected"),
            ),
          )
          .orderBy(desc(ledCheckins.moderatedAt), desc(ledCheckins.createdAt))
          .limit(200),
        getLedSessionCounts(activeSession.id),
      ]);

      initialFeed = {
        pending: pendingRows.map((r) => toLedCheckinCard(selectedInv.slug, r)),
        approved: approvedRows.map((r) => toLedCheckinCard(selectedInv.slug, r)),
        rejected: rejectedRows.map((r) => toLedCheckinCard(selectedInv.slug, r)),
        counts,
      };
    }
  }

  const effectivePlan = getEffectivePlan(user.plan, user.planExpiresAt);
  const planCfg = getPlanConfig(effectivePlan);
  const publicOrigin = await resolvePublicOrigin();

  const serializedInvitations: LedModInvitationItem[] = userInvitations;
  const serializedSessions: LedModSessionItem[] = sessionRows.map((s) => ({
    id: s.id,
    invitationId: s.invitationId,
    stageCode: s.stageCode,
    themeMode: s.themeMode as LedThemeMode,
    autoApprove: s.autoApprove,
    blockedWords: s.blockedWords ?? [],
    luckyDrawState: s.luckyDrawState ?? {},
    isActive: s.isActive,
  }));

  const emptyCounts: LedCheckinCounts = { pending: 0, approved: 0, rejected: 0, total: 0 };

  return (
    <div className="mx-auto max-w-6xl space-y-6 text-ink">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded px-1 text-xs font-semibold text-burgundy transition-colors duration-200 hover:underline focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 motion-reduce:transition-none"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Quay lại Bảng điều khiển
          </Link>
          <h1 className="mt-1 flex items-center gap-2.5 font-serif text-3xl font-bold text-ink">
            <MonitorPlay className="h-6 w-6 shrink-0 text-burgundy" aria-hidden="true" />
            Bảng điều khiển Màn hình LED &amp; MC
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Kiểm duyệt ảnh check-in 1 chạm, đổi giao diện sân khấu, in biển QR bàn tiệc và quay số
            Lucky Draw trực tiếp.
          </p>
        </div>

        <span className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-amber-surface px-4 py-2 text-xs font-semibold tabular-nums text-amber-text">
          Gói {planCfg.name},{" "}
          {planCfg.ledCheckinLimit === -1
            ? "Check-in LED không giới hạn"
            : `Tối đa ${planCfg.ledCheckinLimit} check-in`}
        </span>
      </div>

      <LedModConsole
        invitations={serializedInvitations}
        initialSessions={serializedSessions}
        initialSelectedInvitationId={selectedInv?.id ?? null}
        initialFeed={initialFeed ?? { pending: [], approved: [], rejected: [], counts: emptyCounts }}
        planFeatures={{
          effectivePlan,
          planName: planCfg.name,
          ledLuckyDraw: planCfg.features.ledLuckyDraw,
          ledCheckinLimit: planCfg.ledCheckinLimit,
        }}
        publicOrigin={publicOrigin}
      />
    </div>
  );
}
