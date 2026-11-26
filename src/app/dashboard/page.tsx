import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarHeart,
  Crown,
  ExternalLink,
  Eye,
  ImageIcon,
  LayoutTemplate,
  MessageSquareHeart,
  MonitorPlay,
  Pencil,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { db } from "@/db";
import { guests, invitations, mediaAssets, weddingProfiles, wishes } from "@/db/schema";
import { getCurrentUser } from "@/modules/auth/session";
import { getEffectivePlan, getPlanConfig } from "@/modules/billing/plans";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  published: {
    label: "Đang phát hành",
    className: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  draft: {
    label: "Bản nháp",
    className: "border border-border bg-amber-surface text-amber-text",
  },
  paused: {
    label: "Tạm dừng",
    className: "border border-border bg-blush text-ink-secondary",
  },
};

function computeProgressPercent(used: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

export default async function DashboardPage(): Promise<React.ReactElement> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const effectivePlan = getEffectivePlan(user.plan, user.planExpiresAt);
  const plan = getPlanConfig(effectivePlan);

  const [invList, [mediaStats], [profileStats]] = await Promise.all([
    db
      .select({
        id: invitations.id,
        title: invitations.title,
        slug: invitations.slug,
        status: invitations.status,
        viewCount: invitations.viewCount,
        updatedAt: invitations.updatedAt,
      })
      .from(invitations)
      .where(eq(invitations.userId, user.id))
      .orderBy(desc(invitations.updatedAt)),
    db
      .select({ value: count() })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.userId, user.id), eq(mediaAssets.kind, "image"))),
    db
      .select({ value: count() })
      .from(weddingProfiles)
      .where(eq(weddingProfiles.userId, user.id)),
  ]);

  const invIds = invList.map((inv) => inv.id);

  const [guestStats, wishStats] =
    invIds.length === 0
      ? [{ total: 0, attending: 0 }, { total: 0 }]
      : await Promise.all([
          db
            .select({
              total: sql<number>`count(*)::int`,
              attending: sql<number>`count(*) filter (where ${guests.rsvpStatus} = 'attending')::int`,
            })
            .from(guests)
            .where(inArray(guests.invitationId, invIds))
            .then((rows) => rows[0] ?? { total: 0, attending: 0 }),
          db
            .select({
              total: sql<number>`count(*)::int`,
            })
            .from(wishes)
            .where(inArray(wishes.invitationId, invIds))
            .then((rows) => rows[0] ?? { total: 0 }),
        ]);

  const totalViews = invList.reduce((sum, inv) => sum + inv.viewCount, 0);
  const mediaCount = Number(mediaStats?.value ?? 0);
  const profileCount = Number(profileStats?.value ?? 0);

  const invProgress = computeProgressPercent(invList.length, plan.maxWebsites);
  const viewProgress = computeProgressPercent(totalViews, plan.maxViews);
  const mediaProgress = computeProgressPercent(mediaCount, plan.maxImages);
  const viewBarValue = plan.maxViews === -1 ? 25 : viewProgress;

  return (
    <div className="space-y-8">
      {/* Greeting Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">
            Xin chào, {user.name || "Cô dâu & Chú rể"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Quản lý thiệp cưới số, danh sách khách mời Zalo OG và màn hình LED sảnh tiệc tại một nơi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/dashboard/billing"
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-blush px-4 py-2 text-xs font-semibold text-burgundy transition-colors duration-200 hover:bg-border motion-reduce:transition-none ${FOCUS_RING}`}
          >
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Gói: {plan.name}</span>
          </Link>
          <Link
            href="/dashboard/ai-magic"
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-full bg-burgundy px-5 py-2 text-xs font-semibold text-ivory shadow-sm transition-colors duration-200 hover:bg-burgundy-dark motion-reduce:transition-none ${FOCUS_RING}`}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tạo bằng AI Magic 30s</span>
          </Link>
        </div>
      </div>

      {/* 3-Column Hairline Quick-Action Strip */}
      <section aria-label="Thao tác nhanh">
        <div className="grid divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Link
            href="/dashboard/ai-magic"
            className={`group flex min-h-[44px] items-center justify-between gap-4 p-5 text-ink transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none ${FOCUS_RING}`}
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-burgundy">
                AI Magic 30s
              </p>
              <p className="mt-1 font-serif text-base font-bold text-ink">
                Tạo bằng AI Magic 30s
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Trích xuất màu &amp; viết lời mời tự động
              </p>
            </div>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-burgundy transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </Link>

          <Link
            href="/dashboard/invitations?create=1"
            className={`group flex min-h-[44px] items-center justify-between gap-4 p-5 text-ink transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none ${FOCUS_RING}`}
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-muted">
                Bộ sưu tập mẫu
              </p>
              <p className="mt-1 font-serif text-base font-bold text-ink">
                Tạo từ 8 mẫu chủ đạo
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Đổi giao diện 1 chạm không vỡ bố cục
              </p>
            </div>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink motion-reduce:transition-none"
              aria-hidden="true"
            />
          </Link>

          <Link
            href="/dashboard/led-mod"
            className={`group flex min-h-[44px] items-center justify-between gap-4 p-5 text-ink transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none ${FOCUS_RING}`}
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-text">
                Sân khấu tiệc cưới
              </p>
              <p className="mt-1 font-serif text-base font-bold text-ink">
                Mở Màn hình LED
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Duyệt ảnh check-in &amp; Lucky Draw
              </p>
            </div>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink motion-reduce:transition-none"
              aria-hidden="true"
            />
          </Link>
        </div>
      </section>

      {/* Unified 6-Cell Atelier Ledger */}
      <section aria-label="Chỉ số không gian làm việc">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-surface p-5">
            <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
              <span>Thiệp cưới / hạn mức</span>
              <LayoutTemplate className="h-4 w-4 text-burgundy" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
              {invList.length}{" "}
              <span className="text-sm font-medium text-ink-muted">
                / {plan.maxWebsites === -1 ? "∞" : plan.maxWebsites}
              </span>
            </p>
            <div
              role="progressbar"
              aria-valuenow={invProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Hạn mức thiệp cưới đã sử dụng"
              className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-blush"
            >
              <div
                className="h-full rounded-full bg-burgundy"
                style={{ width: `${invProgress}%` }}
              />
            </div>
          </div>

          <div className="bg-surface p-5">
            <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
              <span>Tổng lượt xem / giới hạn gói</span>
              <Eye className="h-4 w-4 text-burgundy" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
              {new Intl.NumberFormat("vi-VN").format(totalViews)}{" "}
              <span className="text-sm font-medium text-ink-muted">
                /{" "}
                {plan.maxViews === -1
                  ? "Không giới hạn"
                  : new Intl.NumberFormat("vi-VN").format(plan.maxViews)}
              </span>
            </p>
            <div
              role="progressbar"
              aria-valuenow={viewBarValue}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Hạn mức lượt xem đã sử dụng"
              className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-blush"
            >
              <div
                className="h-full rounded-full bg-gold"
                style={{ width: `${viewBarValue}%` }}
              />
            </div>
          </div>

          <div className="bg-surface p-5">
            <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
              <span>Ảnh đã tải / hạn mức</span>
              <ImageIcon className="h-4 w-4 text-burgundy" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
              {mediaCount}{" "}
              <span className="text-sm font-medium text-ink-muted">
                / {plan.maxImages === -1 ? "∞" : plan.maxImages}
              </span>
            </p>
            <div
              role="progressbar"
              aria-valuenow={mediaProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Hạn mức ảnh đã tải lên"
              className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-blush"
            >
              <div
                className="h-full rounded-full bg-burgundy"
                style={{ width: `${mediaProgress}%` }}
              />
            </div>
          </div>

          <div className="bg-surface p-5">
            <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
              <span>Khách xác nhận RSVP</span>
              <UserCheck className="h-4 w-4 text-burgundy" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
              {guestStats.attending}{" "}
              <span className="text-sm font-medium text-ink-muted">
                / {guestStats.total} khách mời
              </span>
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <Link
                href="/dashboard/guests"
                className={`inline-flex min-h-[44px] items-center font-medium text-burgundy hover:underline ${FOCUS_RING}`}
              >
                Quản lý khách mời
              </Link>
              <Link
                href="/dashboard/rsvp"
                className={`inline-flex min-h-[44px] items-center font-medium text-ink-muted hover:text-ink ${FOCUS_RING}`}
              >
                Xem báo cáo RSVP
              </Link>
            </div>
          </div>

          <div className="bg-surface p-5">
            <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
              <span>Hộp lời chúc</span>
              <MessageSquareHeart className="h-4 w-4 text-burgundy" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
              {wishStats.total}{" "}
              <span className="text-sm font-medium text-ink-muted">lời chúc</span>
            </p>
            <div className="mt-2">
              <Link
                href="/dashboard/wishes"
                className={`inline-flex min-h-[44px] items-center text-xs font-medium text-burgundy hover:underline ${FOCUS_RING}`}
              >
                Duyệt &amp; xuất CSV lời chúc
              </Link>
            </div>
          </div>

          <div className="bg-surface p-5">
            <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
              <span>AI Credits khả dụng</span>
              <Sparkles className="h-4 w-4 text-amber-text" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
              {user.aiCredits}{" "}
              <span className="text-sm font-medium text-ink-muted">lượt</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="rounded-full bg-amber-surface px-2.5 py-0.5 text-xs font-semibold tabular-nums text-amber-text">
                {profileCount} hồ sơ cưới
              </span>
              <Link
                href="/dashboard/wedding-profile"
                className={`inline-flex min-h-[44px] items-center font-medium text-burgundy hover:underline ${FOCUS_RING}`}
              >
                Cập nhật hồ sơ
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* User Invitations List */}
      <section aria-labelledby="dashboard-invitations-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="dashboard-invitations-heading" className="font-serif text-xl font-bold text-ink">
              Thiệp cưới của bạn
            </h2>
            <p className="text-xs text-ink-muted">
              Mở nhanh trình chỉnh sửa, trang thiệp công khai hoặc màn hình LED sảnh tiệc.
            </p>
          </div>
          <Link
            href="/dashboard/invitations"
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border-strong bg-surface px-4 py-2 text-xs font-semibold text-ink transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none ${FOCUS_RING}`}
          >
            <span>Quản lý tất cả thiệp</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {invList.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blush text-burgundy">
              <CalendarHeart className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="mt-4 font-serif text-lg font-bold text-ink">
              Bạn chưa tạo thiệp cưới nào
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-secondary">
              Bắt đầu bằng AI Magic Setup 30 giây từ ảnh cưới hoặc chọn một trong 8 mẫu thiệp thiết kế sẵn.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/dashboard/ai-magic"
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full bg-burgundy px-5 text-xs font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark motion-reduce:transition-none ${FOCUS_RING}`}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Tạo bằng AI Magic 30s
              </Link>
              <Link
                href="/dashboard/invitations?create=1"
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border-strong bg-surface px-5 text-xs font-semibold text-ink transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none ${FOCUS_RING}`}
              >
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                Chọn từ 8 mẫu thiệp
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {invList.map((inv) => {
              const badge = STATUS_BADGE[inv.status] ?? STATUS_BADGE.draft;
              return (
                <Card key={inv.id} className="flex flex-col justify-between p-5">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-serif text-lg font-bold text-ink">
                          {inv.title}
                        </h3>
                        <p className="mt-0.5 truncate text-xs tabular-nums text-ink-muted">
                          /s/{inv.slug}, {new Intl.NumberFormat("vi-VN").format(inv.viewCount)} lượt xem
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                    <Link
                      href={`/editor/${inv.id}`}
                      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-burgundy px-4 text-xs font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark motion-reduce:transition-none ${FOCUS_RING}`}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Chỉnh sửa
                    </Link>
                    <Link
                      href={`/s/${inv.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border-strong bg-surface px-4 text-xs font-medium text-ink transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none ${FOCUS_RING}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      Xem thiệp
                    </Link>
                    <Link
                      href={`/stage/${inv.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-blush px-4 text-xs font-medium text-burgundy transition-colors duration-200 hover:bg-border motion-reduce:transition-none ${FOCUS_RING}`}
                    >
                      <MonitorPlay className="h-3.5 w-3.5" aria-hidden="true" />
                      LED Sảnh tiệc
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
