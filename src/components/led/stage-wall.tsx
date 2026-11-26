"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  QrCode,
  Radio,
  Sparkles,
  Ticket,
  Trophy,
  WifiOff,
  X,
} from "lucide-react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import type { LedCheckinCard, LedThemeMode } from "@/modules/led-realtime";

export interface StageWallFeedData {
  invitation: {
    title: string;
    slug: string;
  };
  session: {
    themeMode: LedThemeMode | string;
    stageCode: string;
    autoApprove: boolean;
    isActive: boolean;
    luckyDrawState: {
      winnerTicket?: string;
      winnerName?: string;
      drawnAt?: string;
    };
  };
  approved: LedCheckinCard[];
}

export interface StageWallProps {
  initialFeed: StageWallFeedData;
  qrDataUrl: string;
  checkinPath: string;
  checkinUrl: string;
}

interface LuckyDrawWinnerOverlay {
  winnerTicket: string;
  winnerName: string;
  drawnAt: string;
  photoUrl?: string | null;
}

const VALID_THEMES: readonly LedThemeMode[] = ["aurora", "velvet", "starlight", "crimson"];

const THEME_PRESETS: Record<
  LedThemeMode,
  {
    label: string;
    ambientGradient: string;
    accentHex: string;
    pillBg: string;
    borderAccent: string;
  }
> = {
  aurora: {
    label: "Aurora",
    ambientGradient:
      "radial-gradient(circle at 18% 20%, rgba(200, 157, 102, 0.18), transparent 46%), radial-gradient(circle at 82% 78%, rgba(155, 74, 91, 0.18), transparent 48%)",
    accentHex: "#C89D66",
    pillBg: "rgba(200, 157, 102, 0.16)",
    borderAccent: "rgba(200, 157, 102, 0.4)",
  },
  velvet: {
    label: "Velvet",
    ambientGradient:
      "radial-gradient(circle at 20% 25%, rgba(139, 38, 53, 0.28), transparent 50%), radial-gradient(circle at 80% 75%, rgba(200, 157, 102, 0.14), transparent 46%)",
    accentHex: "#C89D66",
    pillBg: "rgba(139, 38, 53, 0.34)",
    borderAccent: "rgba(200, 157, 102, 0.45)",
  },
  starlight: {
    label: "Starlight",
    ambientGradient:
      "radial-gradient(circle at 50% 15%, rgba(255, 252, 249, 0.12), transparent 50%), radial-gradient(circle at 85% 80%, rgba(200, 157, 102, 0.2), transparent 46%)",
    accentHex: "#E3BE8A",
    pillBg: "rgba(227, 190, 138, 0.18)",
    borderAccent: "rgba(227, 190, 138, 0.45)",
  },
  crimson: {
    label: "Crimson",
    ambientGradient:
      "radial-gradient(circle at 25% 80%, rgba(158, 42, 59, 0.32), transparent 52%), radial-gradient(circle at 78% 18%, rgba(200, 157, 102, 0.22), transparent 45%)",
    accentHex: "#C89D66",
    pillBg: "rgba(158, 42, 59, 0.36)",
    borderAccent: "rgba(200, 157, 102, 0.5)",
  },
};

function normalizeThemeMode(raw: string | undefined): LedThemeMode {
  if (raw && (VALID_THEMES as readonly string[]).includes(raw)) {
    return raw as LedThemeMode;
  }
  return "aurora";
}

export function StageWall({
  initialFeed,
  qrDataUrl,
  checkinPath,
  checkinUrl,
}: StageWallProps): React.ReactElement {
  const slug = initialFeed.invitation.slug;

  const [approved, setApproved] = React.useState<LedCheckinCard[]>(initialFeed.approved);
  const [themeMode, setThemeMode] = React.useState<LedThemeMode>(() =>
    normalizeThemeMode(initialFeed.session.themeMode),
  );
  const [isActive, setIsActive] = React.useState<boolean>(initialFeed.session.isActive);
  const [activeIndex, setActiveIndex] = React.useState<number>(0);
  const [isPaused, setIsPaused] = React.useState<boolean>(false);
  const [isInteracting, setIsInteracting] = React.useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState<boolean>(false);
  const [connectionState, setConnectionState] = React.useState<
    "connecting" | "live" | "reconnecting"
  >("connecting");

  const [winnerOverlay, setWinnerOverlay] = React.useState<LuckyDrawWinnerOverlay | null>(null);
  const lastSeenDrawAtRef = React.useRef<string | undefined>(
    initialFeed.session.luckyDrawState?.drawnAt,
  );
  const stageRootRef = React.useRef<HTMLDivElement | null>(null);
  const winnerModalRef = React.useRef<HTMLDivElement | null>(null);

  useDialogFocus(Boolean(winnerOverlay), winnerModalRef, {
    onClose: () => setWinnerOverlay(null),
  });

  // Detect prefers-reduced-motion
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const onChange = (event: MediaQueryListEvent): void => {
      setPrefersReducedMotion(event.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Track fullscreen changes
  React.useEffect(() => {
    const onFsChange = (): void => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Trigger auto-dismiss timer when Lucky Draw Winner Overlay opens
  React.useEffect(() => {
    if (!winnerOverlay) return;
    const timer = window.setTimeout(() => {
      setWinnerOverlay(null);
    }, 15_000);
    return () => window.clearTimeout(timer);
  }, [winnerOverlay]);

  // True SSE Consumer with named event listeners
  React.useEffect(() => {
    const url = `/api/led/${encodeURIComponent(slug)}/stream`;
    const es = new EventSource(url);

    es.onopen = () => {
      setConnectionState("live");
    };

    es.onerror = () => {
      setConnectionState("reconnecting");
    };

    es.addEventListener("init", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as StageWallFeedData;
        setConnectionState("live");
        if (Array.isArray(data.approved)) {
          setApproved(data.approved);
        }
        if (data.session) {
          setThemeMode(normalizeThemeMode(data.session.themeMode));
          setIsActive(Boolean(data.session.isActive));
          if (data.session.luckyDrawState?.drawnAt) {
            lastSeenDrawAtRef.current = data.session.luckyDrawState.drawnAt;
          }
        }
      } catch {
        // Ignore malformed SSE frame
      }
    });

    es.addEventListener("checkin_approved", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { checkin?: LedCheckinCard };
        if (!data.checkin) return;
        const incoming = data.checkin;
        setApproved((prev) => {
          const filtered = prev.filter((item) => item.id !== incoming.id);
          return [incoming, ...filtered];
        });
        setActiveIndex(0);
      } catch {
        // Ignore malformed frame
      }
    });

    es.addEventListener("checkin_removed", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { id?: string };
        if (!data.id) return;
        setApproved((prev) => {
          const next = prev.filter((item) => item.id !== data.id);
          setActiveIndex((curr) => (next.length === 0 ? 0 : Math.min(curr, next.length - 1)));
          return next;
        });
      } catch {
        // Ignore malformed frame
      }
    });

    es.addEventListener("lucky_draw", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as {
          winnerTicket?: string;
          winnerName?: string;
          drawnAt?: string;
          photoUrl?: string | null;
        };
        if (!data.winnerTicket || !data.winnerName) return;
        const drawnAt = data.drawnAt ?? new Date().toISOString();
        lastSeenDrawAtRef.current = drawnAt;
        setWinnerOverlay({
          winnerTicket: data.winnerTicket,
          winnerName: data.winnerName,
          drawnAt,
          photoUrl: data.photoUrl ?? null,
        });
      } catch {
        // Ignore malformed frame
      }
    });

    es.addEventListener("theme_changed", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as {
          themeMode?: string;
          isActive?: boolean;
        };
        if (data.themeMode) {
          setThemeMode(normalizeThemeMode(data.themeMode));
        }
        if (typeof data.isActive === "boolean") {
          setIsActive(data.isActive);
        }
      } catch {
        // Ignore malformed frame
      }
    });

    return () => {
      es.close();
    };
  }, [slug]);

  // Automatic 5s /api/led/[slug]/feed polling fallback when SSE drops
  React.useEffect(() => {
    if (connectionState !== "reconnecting") return;

    let cancelled = false;
    const poll = async (): Promise<void> => {
      try {
        const res = await fetch(`/api/led/${encodeURIComponent(slug)}/feed`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as StageWallFeedData;
        if (cancelled) return;
        if (Array.isArray(data.approved)) {
          setApproved(data.approved);
        }
        if (data.session) {
          setThemeMode(normalizeThemeMode(data.session.themeMode));
          setIsActive(Boolean(data.session.isActive));
          const drawnAt = data.session.luckyDrawState?.drawnAt;
          if (
            drawnAt &&
            drawnAt !== lastSeenDrawAtRef.current &&
            data.session.luckyDrawState.winnerTicket &&
            data.session.luckyDrawState.winnerName
          ) {
            lastSeenDrawAtRef.current = drawnAt;
            setWinnerOverlay({
              winnerTicket: data.session.luckyDrawState.winnerTicket,
              winnerName: data.session.luckyDrawState.winnerName,
              drawnAt,
            });
          }
        }
      } catch {
        // Retry on next 5s tick
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [connectionState, slug]);

  // Clamp activeIndex if approved shrinks
  React.useEffect(() => {
    if (approved.length === 0) {
      setActiveIndex(0);
    } else if (activeIndex >= approved.length) {
      setActiveIndex(0);
    }
  }, [approved.length, activeIndex]);

  // Auto-cycle spotlight every 6s (paused when reduced motion, user paused, or hovered/focused)
  React.useEffect(() => {
    if (isPaused || isInteracting || prefersReducedMotion || approved.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % approved.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [isPaused, isInteracting, prefersReducedMotion, approved.length]);

  const toggleFullscreen = async (): Promise<void> => {
    try {
      if (!document.fullscreenElement) {
        const target = stageRootRef.current ?? document.documentElement;
        await target.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen may be blocked in embedded previews
    }
  };

  const preset = THEME_PRESETS[themeMode];
  const spotlight = approved[activeIndex] ?? null;

  return (
    <div
      ref={stageRootRef}
      className="group relative flex min-h-dvh w-full flex-col overflow-hidden bg-stage-bg pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-stage-text select-none"
      style={{ backgroundImage: preset.ambientGradient }}
    >
      <a
        href="#stage-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-stage-accent focus:px-4 focus:py-2.5 focus:text-xs focus:font-semibold focus:text-stage-bg focus-visible:outline-2 focus-visible:outline-stage-text focus-visible:outline-offset-2"
      >
        Chuyển đến nội dung chính
      </a>

      {/* Top Stage Header + Subtle Hover Toolbar */}
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-4 border-b border-stage-text/10 px-6 py-4 lg:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]"
            style={{
              backgroundColor: preset.pillBg,
              borderColor: preset.borderAccent,
              color: preset.accentHex,
            }}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {initialFeed.session.stageCode}
          </span>
          <h1 className="font-serif text-xl font-bold tracking-tight text-stage-text sm:text-2xl lg:text-3xl">
            {initialFeed.invitation.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Connection Indicator */}
          <div
            role="status"
            aria-live="polite"
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium ${
              connectionState === "live"
                ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                : "border-amber-400/30 bg-amber-500/15 text-amber-300"
            }`}
          >
            {connectionState === "live" ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                <Radio className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                <span>Live Realtime</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
                <WifiOff className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                <span>Đang kết nối lại...</span>
              </>
            )}
          </div>

          {/* Subtle Hover Toolbar */}
          <div className="flex flex-wrap items-center gap-1 rounded-full border border-stage-text/15 bg-stage-surface/90 p-1 opacity-85 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100 motion-reduce:transition-none">
            {VALID_THEMES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setThemeMode(mode)}
                className={`inline-flex min-h-[44px] items-center rounded-full px-3 text-xs font-semibold transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-stage-accent focus-visible:outline-offset-2 motion-reduce:transition-none ${
                  themeMode === mode
                    ? "bg-stage-accent text-stage-bg"
                    : "text-stage-muted hover:bg-stage-text/10"
                }`}
              >
                {THEME_PRESETS[mode].label}
              </button>
            ))}

            <span className="mx-0.5 h-5 w-px bg-stage-text/15" aria-hidden="true" />

            <button
              type="button"
              onClick={() => setIsPaused((prev) => !prev)}
              aria-label={isPaused ? "Tiếp tục tự động chuyển" : "Tạm dừng tự động chuyển"}
              title={isPaused ? "Tiếp tục chuyển tự động" : "Tạm dừng chuyển tự động"}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-stage-text transition-colors duration-200 hover:bg-stage-text/10 cursor-pointer focus-visible:outline-2 focus-visible:outline-stage-accent focus-visible:outline-offset-2 motion-reduce:transition-none"
            >
              {isPaused ? (
                <>
                  <Play className="h-3.5 w-3.5 text-stage-accent" aria-hidden="true" />
                  <span className="hidden sm:inline">Phát</span>
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5 text-stage-accent" aria-hidden="true" />
                  <span className="hidden sm:inline">Tạm dừng</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
              title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình 16:9"}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-stage-text transition-colors duration-200 hover:bg-stage-text/10 cursor-pointer focus-visible:outline-2 focus-visible:outline-stage-accent focus-visible:outline-offset-2 motion-reduce:transition-none"
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5 text-stage-accent" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5 text-stage-accent" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">
                {isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
              </span>
            </button>

            <Link
              href={checkinPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-burgundy px-3.5 text-xs font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark focus-visible:outline-2 focus-visible:outline-stage-accent focus-visible:outline-offset-2 motion-reduce:transition-none"
            >
              <span>Demo Check-in</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main 16:9 Stage Content */}
      <main
        id="stage-main"
        className="relative z-10 mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-12 lg:px-10 lg:py-8"
      >
        {/* Hero Spotlight (8 cols on desktop) */}
        <section
          aria-label="Lời chúc & ảnh nổi bật trên sân khấu"
          onMouseEnter={() => setIsInteracting(true)}
          onMouseLeave={() => setIsInteracting(false)}
          onFocus={() => setIsInteracting(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setIsInteracting(false);
            }
          }}
          className="relative flex flex-col justify-between rounded-3xl border bg-stage-surface/95 p-6 shadow-[var(--shadow-elevated)] sm:p-8 lg:col-span-8"
          style={{ borderColor: preset.borderAccent }}
        >
          {!isActive ? (
            <div className="mb-4 rounded-xl border border-stage-accent/35 bg-stage-bg px-4 py-2 text-xs font-medium text-stage-accent">
              Phiên check-in mới đang tạm khóa bởi MC — các lời chúc đã duyệt vẫn tiếp tục trình
              chiếu.
            </div>
          ) : null}

          {spotlight ? (
            <div className="flex flex-1 flex-col justify-between gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border bg-stage-bg px-3.5 py-1 text-xs font-bold tracking-wider tabular-nums"
                  style={{
                    borderColor: preset.borderAccent,
                    color: preset.accentHex,
                  }}
                >
                  <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
                  {spotlight.ticketNumber}
                </span>

                {approved.length > 1 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs tabular-nums text-stage-muted">
                      {activeIndex + 1} / {approved.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveIndex((prev) => (prev - 1 + approved.length) % approved.length)
                      }
                      aria-label="Lời chúc trước"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-stage-text/15 bg-stage-bg text-stage-text transition-colors duration-200 hover:bg-stage-text/10 cursor-pointer focus-visible:outline-2 focus-visible:outline-stage-accent focus-visible:outline-offset-2 motion-reduce:transition-none"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveIndex((prev) => (prev + 1) % approved.length)}
                      aria-label="Lời chúc tiếp theo"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-stage-text/15 bg-stage-bg text-stage-text transition-colors duration-200 hover:bg-stage-text/10 cursor-pointer focus-visible:outline-2 focus-visible:outline-stage-accent focus-visible:outline-offset-2 motion-reduce:transition-none"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </div>

              <div
                className={`grid flex-1 items-center gap-6 ${
                  spotlight.photoUrl ? "md:grid-cols-12" : "grid-cols-1"
                }`}
              >
                {spotlight.photoUrl ? (
                  <div
                    className="overflow-hidden rounded-2xl border bg-stage-bg md:col-span-6"
                    style={{ borderColor: preset.borderAccent }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={spotlight.photoUrl}
                      alt={`Khoảnh khắc check-in của ${spotlight.guestName}`}
                      decoding="async"
                      className="aspect-[4/3] max-h-[460px] w-full object-cover"
                    />
                  </div>
                ) : null}

                <div
                  className={`flex flex-col justify-center ${
                    spotlight.photoUrl ? "md:col-span-6" : "mx-auto max-w-2xl text-center"
                  }`}
                >
                  <p className="font-serif text-2xl font-medium leading-[1.4] text-stage-text sm:text-3xl lg:text-4xl">
                    &ldquo;{spotlight.message || "Chúc cô dâu & chú rể trăm năm hạnh phúc!"}&rdquo;
                  </p>
                  <div
                    className={`mt-6 flex items-center gap-3 ${
                      spotlight.photoUrl ? "" : "justify-center"
                    }`}
                  >
                    <div
                      className="h-px w-10"
                      style={{ backgroundColor: preset.accentHex }}
                      aria-hidden="true"
                    />
                    <p
                      className="text-base font-semibold tracking-wide sm:text-lg"
                      style={{ color: preset.accentHex }}
                    >
                      {spotlight.guestName}
                    </p>
                  </div>
                </div>
              </div>

              {/* Subtle progress dots */}
              {approved.length > 1 ? (
                <div className="flex flex-wrap items-center gap-1 pt-2">
                  {approved.slice(0, 12).map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveIndex(idx)}
                      aria-label={`Chọn lời chúc của ${item.guestName}`}
                      aria-current={idx === activeIndex ? "true" : undefined}
                      className="inline-flex min-h-[28px] items-center rounded-full px-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-stage-accent focus-visible:outline-offset-2"
                    >
                      <span
                        className={`block h-1.5 rounded-full transition-colors duration-200 motion-reduce:transition-none ${
                          idx === activeIndex ? "" : "bg-stage-text/25"
                        }`}
                        style={{
                          width: idx === activeIndex ? "28px" : "10px",
                          ...(idx === activeIndex ? { backgroundColor: preset.accentHex } : {}),
                        }}
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
              <Sparkles
                className="h-10 w-10"
                style={{ color: preset.accentHex }}
                aria-hidden="true"
              />
              <h2 className="mt-4 font-serif text-3xl font-bold text-stage-text">
                Chào mừng quý khách đến chung vui
              </h2>
              <p className="mt-2 max-w-md text-base text-stage-muted">
                Hãy quét mã QR bên cạnh để gửi bức ảnh kỷ niệm đầu tiên và lời chúc mừng lên màn
                hình sân khấu!
              </p>
            </div>
          )}
        </section>

        {/* Right Column: Live Wish Ticker + Corner QR Check-in Badge (4 cols) */}
        <aside className="flex flex-col justify-between gap-5 lg:col-span-4">
          {/* Wish Ticker */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-stage-text/12 bg-stage-surface/90 p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-serif text-lg font-semibold text-stage-text">
                Dòng chảy lời chúc
              </h2>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums"
                style={{ backgroundColor: preset.pillBg, color: preset.accentHex }}
              >
                {approved.length} đã duyệt
              </span>
            </div>

            <div className="max-h-[380px] flex-1 space-y-2.5 overflow-y-auto pr-1 lg:max-h-[430px]">
              {approved.length === 0 ? (
                <p className="rounded-2xl border border-stage-text/10 bg-stage-bg/60 p-4 text-sm text-stage-muted">
                  Chưa có lời chúc nào được trình chiếu.
                </p>
              ) : (
                approved.map((item, idx) => {
                  const selected = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveIndex(idx)}
                      className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-stage-accent focus-visible:outline-offset-2 motion-reduce:transition-none ${
                        selected
                          ? "border-stage-accent/65 bg-stage-bg"
                          : "border-stage-text/10 bg-stage-bg/55 hover:bg-stage-bg/90"
                      }`}
                    >
                      {item.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.photoUrl}
                          alt={item.guestName}
                          decoding="async"
                          className="h-12 w-12 shrink-0 rounded-xl object-cover"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-stage-text">
                            {item.guestName}
                          </span>
                          <span
                            className="shrink-0 text-xs font-bold tabular-nums"
                            style={{ color: preset.accentHex }}
                          >
                            {item.ticketNumber}
                          </span>
                        </div>
                        {item.message ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-stage-muted">
                            {item.message}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Corner QR Check-in Sảnh Tiệc Badge */}
          <div
            className="flex items-center gap-4 rounded-3xl border bg-stage-surface p-4 shadow-[var(--shadow-elevated)]"
            style={{ borderColor: preset.borderAccent }}
          >
            <div className="shrink-0 rounded-2xl border-2 border-stage-accent bg-white p-2">
              <Image
                unoptimized
                src={qrDataUrl}
                alt={`Mã QR Check-in ${initialFeed.invitation.title}`}
                width={128}
                height={128}
                className="h-28 w-28 sm:h-32 sm:w-32"
              />
            </div>
            <div className="min-w-0 flex-1">
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em]"
                style={{ color: preset.accentHex }}
              >
                <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                Quét QR Check-in Sảnh Tiệc
              </span>
              <p className="mt-1 font-serif text-lg font-bold leading-snug text-stage-text">
                Gửi ảnh &amp; lời chúc lên LED
              </p>
              <p className="mt-1 text-xs leading-relaxed text-stage-muted">
                Nhận ngay mã số <strong className="text-stage-accent">Lucky Draw</strong> để tham
                gia quay số trúng thưởng.
              </p>
              <Link
                href={checkinPath}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex min-h-[28px] max-w-full items-center truncate rounded text-xs font-medium text-stage-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-stage-accent focus-visible:outline-offset-2"
              >
                <span className="truncate">{checkinUrl}</span>
              </Link>
            </div>
          </div>
        </aside>
      </main>

      {/* Celebratory Lucky Draw Winner Overlay */}
      {winnerOverlay ? (
        <div
          ref={winnerModalRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Kết quả Quay số Lucky Draw"
          className="fixed inset-0 z-50 flex items-center justify-center bg-stage-bg/90 p-4 backdrop-blur-md outline-none"
        >
          <div className="relative w-full max-w-xl rounded-3xl border-2 border-stage-accent bg-stage-surface p-3 shadow-[var(--shadow-elevated)]">
            <div className="rounded-2xl border border-stage-accent/45 px-6 py-10 text-center sm:px-10">
              <button
                type="button"
                onClick={() => setWinnerOverlay(null)}
                aria-label="Đóng thông báo trúng thưởng"
                className="absolute right-6 top-6 inline-flex h-11 w-11 items-center justify-center rounded-full border border-stage-text/20 bg-stage-bg text-stage-text transition-colors duration-200 hover:bg-stage-text/10 cursor-pointer focus-visible:outline-2 focus-visible:outline-stage-accent focus-visible:outline-offset-2 motion-reduce:transition-none"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>

              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-stage-accent bg-stage-bg text-stage-accent">
                <Trophy className="h-8 w-8" aria-hidden="true" />
              </div>

              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-stage-accent">
                Chúc mừng chủ nhân Lucky Draw
              </p>

              <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-2xl border-2 border-stage-accent bg-stage-bg px-8 py-4">
                <Ticket className="h-7 w-7 text-stage-accent" aria-hidden="true" />
                <span className="font-serif text-5xl font-bold tracking-wider tabular-nums text-stage-accent sm:text-6xl">
                  {winnerOverlay.winnerTicket}
                </span>
              </div>

              <h2 className="mt-5 font-serif text-3xl font-bold text-stage-text sm:text-4xl">
                {winnerOverlay.winnerName}
              </h2>

              {winnerOverlay.photoUrl ? (
                <div className="mx-auto mt-6 max-w-xs overflow-hidden rounded-2xl border border-stage-accent/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={winnerOverlay.photoUrl}
                    alt={winnerOverlay.winnerName}
                    decoding="async"
                    className="aspect-[4/3] w-full object-cover"
                  />
                </div>
              ) : null}

              <div className="mt-7">
                <button
                  type="button"
                  onClick={() => setWinnerOverlay(null)}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-stage-accent px-7 text-sm font-semibold text-stage-bg transition-opacity duration-200 hover:opacity-90 cursor-pointer focus-visible:outline-2 focus-visible:outline-stage-text focus-visible:outline-offset-2 motion-reduce:transition-none"
                >
                  Tiếp tục trình chiếu
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
