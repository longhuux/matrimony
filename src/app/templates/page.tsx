import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Heart } from "lucide-react";
import {
  TemplateGallery,
  type GalleryTemplateItem,
} from "@/components/templates/template-gallery";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { SITE_CONFIG } from "@/lib/site-config";
import { getCurrentUser } from "@/modules/auth/session";
import { FLAGSHIP_TEMPLATES } from "@/modules/invitation-engine/templates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Thư viện Mẫu Thiệp Cưới | ${SITE_CONFIG.brandName}`,
  description:
    "Khám phá bộ sưu tập mẫu thiệp cưới số Matrimony: đổi giao diện 1 chạm không mất dữ liệu, tối ưu cho điện thoại và chia sẻ Zalo.",
};

const FOCUS_RING_CLASS =
  "focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2";

const FALLBACK_BY_SLUG = new Map(
  FLAGSHIP_TEMPLATES.map((tpl) => [tpl.slug, tpl]),
);

async function loadTemplates(): Promise<GalleryTemplateItem[]> {
  try {
    const rows = await db
      .select({
        slug: templates.slug,
        name: templates.name,
        description: templates.description,
        category: templates.category,
        tier: templates.tier,
        thumbnailUrl: templates.thumbnailUrl,
        defaultDoc: templates.defaultDoc,
      })
      .from(templates)
      .where(eq(templates.isActive, true))
      .orderBy(asc(templates.createdAt));

    if (rows.length > 0) {
      return rows.map((row) => {
        const fallback = FALLBACK_BY_SLUG.get(row.slug);
        const thumbnailUrl =
          row.thumbnailUrl?.trim() ||
          fallback?.thumbnailUrl ||
          "/images/wedding/hero-couple.webp";

        return {
          slug: row.slug,
          name: row.name,
          description: row.description,
          category: row.category,
          tier: row.tier === "pro" ? "pro" : "free",
          thumbnailUrl,
          defaultDoc: row.defaultDoc,
        };
      });
    }
  } catch {
    // Fall back gracefully to built-in flagship templates when DB is unavailable
  }

  return FLAGSHIP_TEMPLATES.map((tpl) => ({
    slug: tpl.slug,
    name: tpl.name,
    description: tpl.description,
    category: tpl.category,
    tier: tpl.tier,
    thumbnailUrl: tpl.thumbnailUrl,
    defaultDoc: tpl.defaultDoc,
  }));
}

interface TemplatesPageProps {
  searchParams: Promise<{ highlight?: string }>;
}

export default async function TemplatesPage({
  searchParams,
}: TemplatesPageProps): Promise<React.ReactElement> {
  const [user, templateItems, resolvedParams] = await Promise.all([
    getCurrentUser(),
    loadTemplates(),
    searchParams,
  ]);

  return (
    <div className="min-h-dvh bg-ivory text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:rounded-full focus:bg-burgundy focus:px-5 focus:text-sm focus:font-semibold focus:text-ivory"
      >
        Chuyển thẳng tới nội dung chính
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-ivory/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6 sm:py-3.5">
          <Link
            href="/"
            className={`flex min-w-0 shrink-0 items-center gap-2 rounded-full py-0.5 sm:gap-2.5 ${FOCUS_RING_CLASS}`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-burgundy text-ivory sm:h-9 sm:w-9">
              <Heart className="h-3.5 w-3.5 fill-current sm:h-4 sm:w-4" aria-hidden="true" />
            </span>
            <span className="font-serif text-lg font-bold tracking-tight text-ink sm:text-xl">
              {SITE_CONFIG.brandName}
            </span>
          </Link>

          <nav
            aria-label="Điều hướng chính"
            className="hidden items-center gap-7 text-sm font-medium text-ink-secondary md:flex"
          >
            <Link
              href="/"
              className={`rounded-md px-1.5 py-1 transition-colors hover:text-burgundy ${FOCUS_RING_CLASS}`}
            >
              Trang chủ
            </Link>
            <Link
              href="/stage/minh-anh-gia-huy"
              className={`rounded-md px-1.5 py-1 transition-colors hover:text-burgundy ${FOCUS_RING_CLASS}`}
            >
              Màn hình LED
            </Link>
            <Link
              href="/tools/tao-qr-mung-cuoi"
              className={`rounded-md px-1.5 py-1 transition-colors hover:text-burgundy ${FOCUS_RING_CLASS}`}
            >
              Công cụ miễn phí
            </Link>
          </nav>

          <Link
            href={user ? "/dashboard" : "/login"}
            className={`inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-full bg-burgundy px-4 text-xs font-semibold text-ivory transition-colors hover:bg-burgundy-dark sm:px-5 sm:text-sm ${FOCUS_RING_CLASS}`}
          >
            {user ? "Dashboard" : "Tạo thiệp"}
          </Link>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="mb-8 max-w-2xl">
          <h1 className="min-w-0 break-words font-serif text-4xl font-bold leading-[1.15] tracking-[-0.02em] text-ink sm:text-5xl">
            Thư viện Mẫu Thiệp Cưới
          </h1>
          <p className="mt-3 text-base leading-relaxed text-ink-secondary">
            Chọn phong cách phù hợp với lễ cưới của bạn và xem thử trực tiếp trên khung di động trước khi bắt đầu.
          </p>
        </section>

        <TemplateGallery
          templates={templateItems}
          isLoggedIn={Boolean(user)}
          initialHighlightSlug={resolvedParams.highlight}
        />
      </main>
    </div>
  );
}
