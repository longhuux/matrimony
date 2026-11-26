import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft, MonitorPlay, Sparkles } from "lucide-react";
import { StageWall } from "@/components/led/stage-wall";
import { getEnv } from "@/lib/env";
import { SITE_CONFIG } from "@/lib/site-config";
import { fetchLedPublicFeed } from "@/modules/led-realtime";
import { renderQrDataUrl } from "@/modules/vietqr/qr-render";

export const dynamic = "force-dynamic";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const feed = await fetchLedPublicFeed(slug);

  return {
    title: feed
      ? `Màn hình LED | ${feed.invitation.title}`
      : `Màn hình LED Sảnh Tiệc | ${SITE_CONFIG.brandName}`,
    description:
      "Màn hình LED tương tác Realtime hiển thị ảnh kỷ niệm, lời chúc và quay số Lucky Draw tại sảnh tiệc cưới.",
  };
}

export default async function StageWallPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<React.ReactElement> {
  const { slug } = await params;
  const feed = await fetchLedPublicFeed(slug);

  if (!feed) {
    return (
      <div className="min-h-dvh bg-stage-bg text-stage-text">
        <a
          href="#stage-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-stage-accent focus:px-4 focus:py-2.5 focus:text-xs focus:font-semibold focus:text-stage-bg focus-visible:outline-2 focus-visible:outline-stage-text focus-visible:outline-offset-2"
        >
          Chuyển đến nội dung chính
        </a>
        <main
          id="stage-main"
          className="flex min-h-dvh items-center justify-center px-4 pt-12 pb-[calc(3rem+env(safe-area-inset-bottom))]"
        >
          <div className="w-full max-w-md rounded-2xl border border-stage-accent/35 bg-stage-surface p-8 text-center shadow-[var(--shadow-elevated)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-stage-accent/40 bg-stage-bg text-stage-accent">
              <MonitorPlay className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-stage-accent/30 bg-stage-bg px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-stage-accent">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Live LED Stage
            </span>
            <h1 className="mt-4 font-serif text-2xl font-bold text-stage-text">
              Màn hình LED chưa được kích hoạt
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-stage-muted">
              Phiên màn hình LED cho thiệp cưới này chưa tồn tại hoặc chưa được cô dâu chú rể mở
              trong bảng điều khiển MC.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/dashboard/led-mod"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-stage-accent px-5 text-xs font-semibold text-stage-bg transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-stage-accent focus-visible:outline-offset-2 motion-reduce:transition-none"
              >
                Mở Bảng điều khiển LED
              </Link>
              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-stage-muted/30 px-5 text-xs font-medium text-stage-text transition-colors duration-200 hover:bg-stage-text/10 focus-visible:outline-2 focus-visible:outline-stage-accent focus-visible:outline-offset-2 motion-reduce:transition-none"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Trang chủ
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const origin = await resolvePublicOrigin();
  const checkinPath = `/checkin/${encodeURIComponent(feed.invitation.slug)}`;
  const checkinUrl = `${origin}${checkinPath}`;
  const qrDataUrl = await renderQrDataUrl(checkinUrl, 260);

  return (
    <StageWall
      initialFeed={{
        invitation: feed.invitation,
        session: feed.session,
        approved: feed.approved,
      }}
      qrDataUrl={qrDataUrl}
      checkinPath={checkinPath}
      checkinUrl={checkinUrl}
    />
  );
}
