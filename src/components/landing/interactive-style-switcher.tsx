"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SwitcherStyleItem {
  slug: string;
  name: string;
  categoryLabel: string;
  tier: "free" | "pro";
  description: string;
  thumbnailUrl: string;
  lunarNote: string;
  ceremonyDate: string;
}

interface InteractiveStyleSwitcherProps {
  styles: readonly SwitcherStyleItem[];
  primaryCreateHref: string;
}

const PREVIEW_SURFACE_CLASSES: Record<
  string,
  {
    container: string;
    heading: string;
    muted: string;
    accent: string;
    divider: string;
    badge: string;
  }
> = {
  "modern-ivory": {
    container: "bg-ivory text-ink",
    heading: "text-ink",
    muted: "text-ink-secondary",
    accent: "text-burgundy",
    divider: "border-border",
    badge: "bg-amber-surface text-amber-text",
  },
  "royal-crimson": {
    container: "bg-amber-surface text-ink",
    heading: "text-burgundy-dark",
    muted: "text-ink-secondary",
    accent: "text-burgundy",
    divider: "border-border-strong",
    badge: "bg-burgundy text-ivory",
  },
  "dalat-garden": {
    container: "bg-surface text-ink",
    heading: "text-ink",
    muted: "text-ink-secondary",
    accent: "text-amber-text",
    divider: "border-border",
    badge: "bg-blush text-ink",
  },
  "midnight-starlight": {
    container: "bg-stage-bg text-stage-text",
    heading: "text-stage-text",
    muted: "text-stage-muted",
    accent: "text-stage-accent",
    divider: "border-stage-muted/20",
    badge: "bg-stage-surface text-stage-accent",
  },
};

/**
 * Interactive 1-click template style switcher on the landing page,
 * proving live theme & photography switching without losing invitation content.
 */
export function InteractiveStyleSwitcher({
  styles,
  primaryCreateHref,
}: InteractiveStyleSwitcherProps): React.ReactElement | null {
  const [activeSlug, setActiveSlug] = useState<string>(styles[0]?.slug ?? "modern-ivory");

  if (styles.length === 0) return null;

  const active = styles.find((item) => item.slug === activeSlug) ?? styles[0];
  const surface = PREVIEW_SURFACE_CLASSES[active.slug] ?? PREVIEW_SURFACE_CLASSES["modern-ivory"];

  return (
    <section className="bg-blush py-20 lg:py-28" aria-labelledby="style-switcher-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-14">
          <div className="min-w-0">
            <h2
              id="style-switcher-heading"
              className="min-w-0 break-words font-serif text-3xl font-bold leading-[1.2] tracking-[-0.015em] text-ink sm:text-4xl"
            >
              Đổi phong cách một chạm, giữ nguyên mọi kỷ niệm
            </h2>
            <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-ink-secondary">
              Thử chuyển giữa bốn chất liệu thiệp bên dưới. Ảnh cưới, tên hai họ và lịch Âm Can Chi luôn tự động thích ứng theo từng phong cách.
            </p>

            <div
              role="tablist"
              aria-label="Chọn phong cách thiệp mẫu"
              className="mt-8 divide-y divide-border-strong border-t border-b border-border-strong"
            >
              {styles.map((style, index) => {
                const isSelected = style.slug === active.slug;
                return (
                  <button
                    key={style.slug}
                    type="button"
                    role="tab"
                    id={`tab-${style.slug}`}
                    aria-selected={isSelected}
                    aria-controls="style-switcher-panel"
                    onClick={() => setActiveSlug(style.slug)}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left transition-colors duration-200",
                      isSelected ? "text-burgundy" : "text-ink hover:text-burgundy",
                    )}
                  >
                    <span className="flex min-w-0 items-baseline gap-3">
                      <span className="shrink-0 font-mono text-xs text-ink-muted">
                        0{index + 1}
                      </span>
                      <span className="min-w-0 truncate font-serif text-xl font-semibold">
                        {style.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-ink-muted">
                      {style.categoryLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href={`/templates?highlight=${active.slug}`}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-burgundy px-6 text-sm font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark"
              >
                <span>Dùng phong cách này</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href={primaryCreateHref}
                className="inline-flex h-11 items-center rounded-full border border-border-strong bg-surface px-5 text-sm font-semibold text-ink transition-colors duration-200 hover:bg-blush-hover"
              >
                Tạo thiệp ngay
              </Link>
            </div>
          </div>

          <div
            id="style-switcher-panel"
            role="tabpanel"
            aria-labelledby={`tab-${active.slug}`}
            className={cn(
              "min-w-0 overflow-hidden rounded-2xl p-5 transition-colors duration-300 sm:p-7",
              surface.container,
            )}
          >
            <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-blush">
                <Image
                  src={active.thumbnailUrl}
                  alt={active.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 28vw"
                  className="object-cover object-center transition-transform duration-500 motion-reduce:transition-none"
                />
              </div>

              <div className="min-w-0 py-2">
                <span
                  className={cn(
                    "inline-block rounded-full px-3 py-1 text-xs font-semibold",
                    surface.badge,
                  )}
                >
                  {active.tier === "free" ? "Gói Miễn phí" : "Gói Pro"}
                </span>

                <p className={cn("mt-4 font-serif text-2xl font-bold leading-snug", surface.heading)}>
                  Minh Anh &amp; Gia Huy
                </p>
                <p className={cn("mt-2 text-sm leading-relaxed", surface.muted)}>
                  {active.description}
                </p>

                <dl className={cn("mt-6 space-y-3 border-t pt-4 text-sm", surface.divider)}>
                  <div>
                    <dt className={cn("text-xs", surface.muted)}>Ngày thành hôn</dt>
                    <dd className={cn("mt-0.5 font-medium", surface.heading)}>
                      {active.ceremonyDate}
                    </dd>
                  </div>
                  <div>
                    <dt className={cn("text-xs", surface.muted)}>Âm lịch Can Chi</dt>
                    <dd className={cn("mt-0.5 font-medium", surface.accent)}>
                      {active.lunarNote}
                    </dd>
                  </div>
                  <div>
                    <dt className={cn("text-xs", surface.muted)}>Kiểu chữ</dt>
                    <dd className={cn("mt-0.5 font-medium", surface.heading)}>
                      Playfair Display &amp; Be Vietnam Pro
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
