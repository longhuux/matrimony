import { count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MonitorOff, Sparkles } from "lucide-react";
import { CheckinClient } from "@/components/led/checkin-client";
import { db } from "@/db";
import { invitations, ledCheckins, ledSessions, users } from "@/db/schema";
import { SITE_CONFIG } from "@/lib/site-config";
import { getEffectivePlan, getPlanConfig } from "@/modules/billing/plans";

export const dynamic = "force-dynamic";

async function loadCheckinTarget(slug: string) {
  const [row] = await db
    .select({
      invitationId: invitations.id,
      slug: invitations.slug,
      title: invitations.title,
      status: invitations.status,
      docJson: invitations.docJson,
      sessionId: ledSessions.id,
      stageCode: ledSessions.stageCode,
      autoApprove: ledSessions.autoApprove,
      isActive: ledSessions.isActive,
      ownerPlan: users.plan,
      ownerPlanExpiresAt: users.planExpiresAt,
    })
    .from(invitations)
    .innerJoin(users, eq(invitations.userId, users.id))
    .leftJoin(ledSessions, eq(ledSessions.invitationId, invitations.id))
    .where(eq(invitations.slug, slug))
    .limit(1);

  return row ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const target = await loadCheckinTarget(slug);

  return {
    title: target
      ? `Check-in Sảnh Tiệc | ${target.title}`
      : `Check-in Sảnh Tiệc | ${SITE_CONFIG.brandName}`,
    description:
      "Gửi ảnh kỷ niệm và lời chúc mừng trực tiếp lên màn hình LED sân khấu tiệc cưới và nhận mã số Lucky Draw.",
  };
}

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<React.ReactElement> {
  const { slug } = await params;
  const target = await loadCheckinTarget(slug);

  if (!target || target.status !== "published" || !target.sessionId || !target.isActive) {
    const canViewInvitation = target && target.status === "published";
    return (
      <div className="min-h-dvh bg-ivory text-ink">
        <a
          href="#checkin-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-burgundy focus:px-4 focus:py-2.5 focus:text-xs focus:font-semibold focus:text-ivory focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2"
        >
          Chuyển đến nội dung chính
        </a>
        <main
          id="checkin-main"
          className="flex min-h-dvh items-center justify-center px-4 pt-12 pb-[calc(3rem+env(safe-area-inset-bottom))]"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-[var(--shadow-card)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blush text-burgundy">
              <MonitorOff className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-surface px-3 py-1 text-xs font-semibold text-amber-text">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Check-in LED Sảnh Tiệc
            </span>
            <h1 className="mt-4 font-serif text-2xl font-bold text-ink">
              {target ? target.title : "Không tìm thấy phòng tiệc"}
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-secondary">
              {!target || target.status !== "published"
                ? "Thiệp cưới chưa được phát hành hoặc liên kết check-in không còn hiệu lực."
                : "Màn hình LED Sảnh Tiệc hiện chưa mở hoặc đang tạm nghỉ. Quý khách vui lòng chờ MC thông báo trong giây lát."}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {canViewInvitation ? (
                <Link
                  href={`/s/${encodeURIComponent(target.slug)}`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-burgundy px-5 text-xs font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 motion-reduce:transition-none"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Xem thiệp cưới
                </Link>
              ) : (
                <Link
                  href="/"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-burgundy px-5 text-xs font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 motion-reduce:transition-none"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Về trang chủ
                </Link>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const effectivePlan = getEffectivePlan(target.ownerPlan, target.ownerPlanExpiresAt);
  const planCfg = getPlanConfig(effectivePlan);
  const [{ value: currentCheckinCount }] = await db
    .select({ value: count() })
    .from(ledCheckins)
    .where(eq(ledCheckins.ledSessionId, target.sessionId));

  const isLimitReached =
    planCfg.ledCheckinLimit !== -1 && Number(currentCheckinCount) >= planCfg.ledCheckinLimit;

  const heroSection = target.docJson.sections.find((s) => s.type === "hero");
  const coupleHeadline =
    typeof heroSection?.data?.headline === "string" &&
    heroSection.data.headline.trim() &&
    !/\{\{[^}]+\}\}/.test(heroSection.data.headline)
      ? heroSection.data.headline.trim()
      : target.title;

  return (
    <CheckinClient
      slug={target.slug}
      invitationTitle={target.title}
      coupleHeadline={coupleHeadline}
      stageCode={target.stageCode ?? "LED-STAGE"}
      autoApprove={Boolean(target.autoApprove)}
      isLimitReached={isLimitReached}
    />
  );
}
