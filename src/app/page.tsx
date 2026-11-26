import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Heart,
  ImageDown,
  MonitorPlay,
  QrCode,
  Sparkles,
} from "lucide-react";
import {
  InteractiveStyleSwitcher,
  type SwitcherStyleItem,
} from "@/components/landing/interactive-style-switcher";
import { SITE_CONFIG } from "@/lib/site-config";
import { formatVnd } from "@/lib/utils";
import { getCurrentUser } from "@/modules/auth/session";
import { PLAN_CONFIGS } from "@/modules/billing/plans";
import { FLAGSHIP_TEMPLATES } from "@/modules/invitation-engine/templates";

const PILLARS = [
  {
    code: "01",
    title: "Màn hình LED Tương tác Realtime",
    desc: "Khách mời quét mã QR trên bàn tiệc để gửi ảnh và lời chúc lên màn hình hội trường trong tích tắc, kèm duyệt 1 chạm và quay số Lucky Draw.",
  },
  {
    code: "02",
    title: "Thiệp di động & Zalo OG cá nhân hóa",
    desc: "Soạn thiệp gọn trên điện thoại, đổi mẫu không mất nội dung. Mỗi liên kết mời tự tạo ảnh xem trước Zalo in sẵn tên từng vị khách.",
  },
  {
    code: "03",
    title: "AI phối màu và Lịch Âm Can Chi",
    desc: "Trích xuất bảng màu hài hòa từ ảnh bìa, nhận diện khuôn mặt để căn khung không cắt mặt và quy đổi ngày Âm Can Chi chuẩn xác.",
  },
  {
    code: "04",
    title: "Gói Miễn phí 5.000 lượt xem & VietQR 0% phí",
    desc: "Chia sẻ thoải mái tới 5.000 lượt xem miễn phí và mở hộp mừng VietQR chuyển thẳng về tài khoản ngân hàng, không phí trung gian.",
  },
] as const;

const COMPARISON_ROWS = [
  {
    criterion: "Soạn thiệp trên điện thoại",
    matrimony: "Bố cục tự co giãn theo màn hình, thao tác gọn một tay",
    traditional: "Khung vẽ cố định ngang, chữ và ảnh dễ xô lệch trên di động",
  },
  {
    criterion: "Đổi phong cách mẫu thiệp",
    matrimony: "Chuyển qua lại 8 mẫu chỉ 1 chạm, giữ nguyên ảnh và lời mời",
    traditional: "Phải dàn trang và căn lề lại từng phần tử khi đổi mẫu",
  },
  {
    criterion: "Gửi link mời qua Zalo",
    matrimony: "Tự tạo ảnh xem trước 1200×630 in sẵn tên riêng từng khách",
    traditional: "Dùng chung một ảnh bìa mặc định cho mọi khách mời",
  },
  {
    criterion: "Trình chiếu tại sảnh tiệc",
    matrimony: "Tích hợp sẵn Check-in QR, duyệt ảnh lên LED và Lucky Draw",
    traditional: "Chỉ dừng ở trang thiệp tĩnh, cần công cụ rời tại tiệc",
  },
  {
    criterion: "Gia đình hai bên & Lịch Âm",
    matrimony: "Hiển thị cân xứng Nhà Trai / Nhà Gái, đa nghi lễ và Âm lịch Can Chi",
    traditional: "Phải tự kẻ khung, tự nhập và tự quy đổi ngày âm thủ công",
  },
  {
    criterion: "Hộp mừng cưới VietQR",
    matrimony: "Chuẩn EMVCo Napas 0% phí, tách riêng tài khoản hai họ",
    traditional: "Phải tự chèn ảnh QR tĩnh hoặc chịu phí ví trung gian",
  },
  {
    criterion: "Hạn mức gói Miễn phí",
    matrimony: "5.000 lượt xem, 30 khách cá nhân hóa, 10 ảnh LED check-in",
    traditional: "Thường giới hạn lượt xem thấp hoặc chèn quảng cáo che nội dung",
  },
] as const;

const FREE_TOOLS = [
  {
    href: "/tools/nen-anh",
    icon: ImageDown,
    title: "Nén ảnh cưới & Chuyển WebP",
    desc: "Giảm dung lượng ảnh album cưới ngay trên trình duyệt để thiệp mở nhanh trên 4G Zalo mà vẫn giữ độ nét.",
    cta: "Mở công cụ nén ảnh",
  },
  {
    href: "/tools/tao-qr-mung-cuoi",
    icon: QrCode,
    title: "Tạo thẻ QR Mừng cưới để bàn",
    desc: "Thiết kế thiệp QR VietQR chuẩn ngân hàng với 3 phong cách trang nhã, tải PNG nét cao hoặc in trực tiếp.",
    cta: "Tạo thẻ QR miễn phí",
  },
  {
    href: "/tools/xem-ngay-cuoi",
    icon: CalendarDays,
    title: "Tra cứu Ngày cưới & Lịch Âm",
    desc: "Đổi ngày Dương sang Âm lịch Can Chi, xem khung giờ Hoàng Đạo và lịch tháng cưới hỏi.",
    cta: "Tra cứu ngày cưới",
  },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  modern: "Hiện đại",
  traditional: "Truyền thống",
  classic: "Cổ điển",
  romantic: "Lãng mạn",
  editorial: "Tạp chí",
  luxury: "Sang trọng",
};

const SWITCHER_SLUGS = [
  "modern-ivory",
  "royal-crimson",
  "dalat-garden",
  "midnight-starlight",
] as const;

function formatDuration(months: number): string {
  if (months === 36) return "3 năm";
  if (months === 60) return "5 năm";
  return `${months} tháng`;
}

export default async function HomePage(): Promise<React.ReactElement> {
  const user = await getCurrentUser();
  const plans = [
    PLAN_CONFIGS.free,
    PLAN_CONFIGS.pro,
    PLAN_CONFIGS.combo,
    PLAN_CONFIGS.studio_pilot,
  ];
  const primaryCreateHref = user ? "/dashboard/invitations" : "/login";

  const switcherStyles: SwitcherStyleItem[] = SWITCHER_SLUGS.map((slug) => {
    const tpl = FLAGSHIP_TEMPLATES.find((item) => item.slug === slug) ?? FLAGSHIP_TEMPLATES[0];
    return {
      slug: tpl.slug,
      name: tpl.name,
      categoryLabel: CATEGORY_LABELS[tpl.category] ?? tpl.category,
      tier: tpl.tier,
      description: tpl.description,
      thumbnailUrl: tpl.thumbnailUrl,
      ceremonyDate: "Thứ Bảy, 28 tháng 11, 2026",
      lunarNote: "19 tháng 10 năm Bính Ngọ",
    };
  });

  return (
    <div className="min-h-dvh bg-ivory text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:rounded-full focus:bg-burgundy focus:px-5 focus:text-sm focus:font-semibold focus:text-ivory"
      >
        Chuyển thẳng tới nội dung chính
      </a>

      <header className="sticky top-0 z-30 h-[72px] border-b border-border bg-ivory/95 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 rounded-full py-1"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-burgundy text-ivory">
              <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
            </span>
            <span className="font-serif text-xl font-bold tracking-tight text-ink">
              {SITE_CONFIG.brandName}
            </span>
          </Link>

          <nav
            aria-label="Điều hướng chính"
            className="hidden items-center gap-7 text-sm font-medium text-ink-secondary md:flex"
          >
            <Link
              href="/templates"
              className="rounded-md px-1.5 py-1 transition-colors duration-200 hover:text-burgundy"
            >
              Mẫu thiệp
            </Link>
            <Link
              href="/stage/minh-anh-gia-huy"
              className="rounded-md px-1.5 py-1 transition-colors duration-200 hover:text-burgundy"
            >
              Màn hình LED
            </Link>
            <a
              href="#cong-cu"
              className="rounded-md px-1.5 py-1 transition-colors duration-200 hover:text-burgundy"
            >
              Công cụ
            </a>
            <a
              href="#bang-gia"
              className="rounded-md px-1.5 py-1 transition-colors duration-200 hover:text-burgundy"
            >
              Bảng giá
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center rounded-full bg-burgundy px-4 text-sm font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark sm:px-5"
              >
                Vào Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-ink-secondary transition-colors duration-200 hover:text-burgundy sm:inline-flex"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center rounded-full bg-burgundy px-4 text-sm font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark sm:px-5"
                >
                  <span className="sm:hidden">Tạo thiệp</span>
                  <span className="hidden sm:inline">Tạo thiệp miễn phí</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* Screen 1: Editorial Hero filling the viewport cleanly above the fold */}
        <section className="mx-auto flex min-h-[calc(100svh-72px)] max-w-6xl items-center px-4 py-8 sm:px-6 lg:py-10">
          <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
            <div className="min-w-0" data-enter="">
              <h1 className="min-w-0 break-words font-serif text-4xl font-bold leading-[1.12] tracking-[-0.02em] text-ink text-balance sm:text-5xl lg:text-[3.5rem]">
                Thiệp cưới chạm khẽ, sảnh tiệc bừng sáng.
              </h1>
              <p className="mt-5 max-w-[44ch] text-base leading-relaxed text-ink-secondary sm:text-lg">
                Tạo thiệp cưới di động trong vài phút, gửi link Zalo in sẵn tên từng vị khách và chiếu ảnh chúc mừng trực tiếp lên màn hình LED hội trường.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                <Link
                  href={primaryCreateHref}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-burgundy px-7 text-sm font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark sm:text-base"
                >
                  <span>Tạo thiệp miễn phí</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/s/minh-anh-gia-huy"
                  className="inline-flex h-12 items-center rounded-full border border-border-strong bg-surface px-6 text-sm font-semibold text-ink transition-colors duration-200 hover:bg-blush-hover sm:text-base"
                >
                  Xem thiệp mẫu sống
                </Link>
              </div>
            </div>

            <div
              className="group min-w-0"
              data-enter=""
              style={{ "--enter-delay": "90ms" } as React.CSSProperties}
            >
              <div className="relative aspect-[4/5] max-h-[74svh] w-full overflow-hidden rounded-2xl bg-blush">
                <Image
                  src="/images/wedding/hero-couple.webp"
                  alt="Ảnh cưới biên tập trong nhà kính ngập nắng"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 48vw"
                  className="object-cover object-[50%_26%] transition-transform duration-500 motion-reduce:transition-none group-hover:scale-[1.02]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Screen 2: Dealt Moment 1 - Interactive 1-Click Style Switcher */}
        <InteractiveStyleSwitcher
          styles={switcherStyles}
          primaryCreateHref={primaryCreateHref}
        />

        {/* Screen 3: 4 Core Pillars Editorial Split */}
        <section id="tinh-nang" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
            <div className="min-w-0">
              <h2 className="min-w-0 break-words font-serif text-3xl font-bold leading-[1.2] tracking-[-0.015em] text-ink sm:text-4xl">
                Bốn điểm cốt lõi cho ngày chung đôi trọn vẹn
              </h2>

              <ol className="mt-8 divide-y divide-border border-t border-b border-border">
                {PILLARS.map((pillar) => (
                  <li key={pillar.code} className="py-5">
                    <div className="flex items-start gap-4">
                      <span className="mt-1 shrink-0 font-mono text-xs font-semibold text-burgundy">
                        {pillar.code}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-serif text-xl font-semibold text-ink">
                          {pillar.title}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                          {pillar.desc}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="min-w-0">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-blush">
                <Image
                  src="/images/wedding/stationery-detail.webp"
                  alt="Bộ thiệp cưới giấy cotton đặt cùng hoa khô và dấu sáp niêm phong"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover object-center"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Screen 4: Dealt Moment 2 - Dark Banquet LED Stage Band */}
        <section className="bg-stage-bg py-20 text-stage-text lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
              <div className="min-w-0">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-stage-surface">
                  <Image
                    src="/images/wedding/midnight-starlight.webp"
                    alt="Không gian dạ tiệc tối với ánh nến vàng và màn hình trình chiếu"
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover object-center"
                  />
                </div>
              </div>

              <div className="min-w-0">
                <h2 className="min-w-0 break-words font-serif text-3xl font-bold leading-[1.2] tracking-[-0.015em] text-stage-text sm:text-4xl">
                  Không khí sảnh tiệc bừng sáng theo từng lời chúc
                </h2>
                <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-stage-muted">
                  Khách tại bàn tiệc quét mã QR gửi ảnh kỷ niệm lên màn hình LED 16:9 theo thời gian thực. MC kiểm duyệt chỉ một chạm và quay số Lucky Draw ngay trên sân khấu.
                </p>

                <blockquote className="mt-8 border-l-2 border-stage-accent pl-5">
                  <p className="font-serif text-xl leading-snug text-stage-text">
                    Chúc Minh Anh và Gia Huy trăm năm hạnh phúc, sớm đón tin vui!
                  </p>
                  <footer className="mt-2 text-xs font-semibold text-stage-accent">
                    Bàn số 06, Bạn thân chú rể
                  </footer>
                </blockquote>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    href="/stage/minh-anh-gia-huy"
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-stage-accent px-6 text-sm font-semibold text-stage-bg transition-colors duration-200 hover:bg-ivory"
                  >
                    <MonitorPlay className="h-4 w-4" aria-hidden="true" />
                    <span>Trải nghiệm Màn hình LED</span>
                  </Link>
                  <Link
                    href="/s/minh-anh-gia-huy"
                    className="inline-flex h-12 items-center px-2 text-sm font-semibold text-stage-text transition-colors duration-200 hover:text-stage-accent"
                  >
                    Mở thiệp mẫu sống
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Screen 5: 8 Flagship Templates Photography Lookbook */}
        <section id="mau-thiep" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <h2 className="min-w-0 break-words font-serif text-3xl font-bold leading-[1.2] tracking-[-0.015em] text-ink sm:text-4xl">
                Tám mẫu thiệp chủ đạo
              </h2>
              <p className="mt-3 text-base text-ink-secondary">
                Từ sắc son truyền thống đến bố cục tạp chí hiện đại, tất cả đều sẵn sàng trên di động.
              </p>
            </div>
            <Link
              href="/templates"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-burgundy px-6 text-sm font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark"
            >
              <span>Khám phá toàn bộ mẫu</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-5 gap-y-10 sm:gap-x-6 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
            {FLAGSHIP_TEMPLATES.map((tpl) => (
              <Link
                key={tpl.slug}
                href={`/templates?highlight=${tpl.slug}`}
                className="group block min-w-0"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-blush">
                  <Image
                    src={tpl.thumbnailUrl}
                    alt={tpl.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover object-center transition-transform duration-500 motion-reduce:transition-none group-hover:scale-[1.03]"
                  />
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-serif text-base font-semibold text-ink transition-colors duration-200 group-hover:text-burgundy sm:text-lg">
                    {tpl.name}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-ink-muted">
                    {tpl.tier === "free" ? "Miễn phí" : "Pro"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Screen 6: Comparison, 3 Free Tools & Transparent Pricing */}
        <section className="mx-auto max-w-6xl border-t border-border px-4 py-20 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <h2 className="min-w-0 break-words font-serif text-3xl font-bold leading-[1.2] tracking-[-0.015em] text-ink sm:text-4xl">
              So sánh với công cụ kéo-thả khung cố định
            </h2>
            <p className="mt-3 text-base text-ink-secondary">
              Khác biệt đến từ cấu trúc thiệp di động chuyên biệt cho cưới hỏi Việt Nam và trải nghiệm tương tác ngay tại tiệc.
            </p>
          </div>

          {/* Mobile stacked hairline comparison (prevents horizontal overflow on 320px/390px) */}
          <div className="divide-y divide-border border-t border-b border-border md:hidden">
            {COMPARISON_ROWS.map((row) => (
              <div key={row.criterion} className="py-5">
                <h3 className="font-serif text-lg font-semibold text-ink">{row.criterion}</h3>
                <p className="mt-2.5 flex items-start gap-2 text-sm text-ink">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" aria-hidden="true" />
                  <span>
                    <strong className="font-semibold text-burgundy">Matrimony:</strong> {row.matrimony}
                  </span>
                </p>
                <p className="mt-1.5 text-sm text-ink-muted">
                  Khung cố định: {row.traditional}
                </p>
              </div>
            ))}
          </div>

          {/* Desktop 3-column hairline table */}
          <div className="hidden md:block">
            <table className="w-full border-collapse border-t border-b border-border text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-blush/70">
                  <th scope="col" className="px-5 py-4 font-semibold text-ink">
                    Tiêu chí trải nghiệm
                  </th>
                  <th scope="col" className="px-5 py-4 font-semibold text-burgundy">
                    Matrimony
                  </th>
                  <th scope="col" className="px-5 py-4 font-semibold text-ink-secondary">
                    Công cụ kéo-thả khung cố định
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.criterion}>
                    <th scope="row" className="px-5 py-4 font-semibold text-ink">
                      {row.criterion}
                    </th>
                    <td className="px-5 py-4 text-ink">
                      <span className="inline-flex items-start gap-2">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-burgundy"
                          aria-hidden="true"
                        />
                        <span>{row.matrimony}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4 text-ink-muted">{row.traditional}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="cong-cu" className="mx-auto max-w-6xl border-t border-border px-4 py-20 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <h2 className="min-w-0 break-words font-serif text-3xl font-bold leading-[1.2] tracking-[-0.015em] text-ink sm:text-4xl">
              Bộ ba công cụ chuẩn bị đám cưới miễn phí
            </h2>
            <p className="mt-3 text-base text-ink-secondary">
              Dùng ngay không cần đăng nhập, xử lý trực tiếp trên trình duyệt để nén ảnh, in thẻ QR bàn tiệc và chọn ngày đẹp.
            </p>
          </div>

          <div className="grid gap-10 md:grid-cols-3">
            {FREE_TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <div
                  key={tool.href}
                  className="flex flex-col justify-between border-t border-border pt-6"
                >
                  <div>
                    <Icon className="h-5 w-5 text-burgundy" aria-hidden="true" />
                    <h3 className="mt-4 font-serif text-xl font-semibold text-ink">
                      {tool.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{tool.desc}</p>
                  </div>
                  <Link
                    href={tool.href}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-burgundy transition-colors duration-200 hover:text-burgundy-dark"
                  >
                    <span>{tool.cta}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        <section id="bang-gia" className="mx-auto max-w-6xl border-t border-border px-4 py-20 sm:px-6 lg:py-24">
          <div className="mb-12 max-w-2xl">
            <h2 className="min-w-0 break-words font-serif text-3xl font-bold leading-[1.2] tracking-[-0.015em] text-ink sm:text-4xl">
              Bảng giá minh bạch, thanh toán một lần
            </h2>
            <p className="mt-3 text-base text-ink-secondary">
              Mọi gói đều miễn phí hộp mừng VietQR chuyển thẳng về tài khoản cô dâu chú rể với 0% phí trung gian.
            </p>
          </div>

          <div className="grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const highlight = plan.sku === "pro";
              return (
                <div
                  key={plan.sku}
                  className={`flex flex-col justify-between pt-6 ${
                    highlight ? "border-t-2 border-burgundy" : "border-t border-border"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-serif text-lg font-bold text-ink">{plan.name}</h3>
                      {highlight && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blush px-2.5 py-0.5 text-xs font-semibold text-burgundy">
                          <Sparkles className="h-3 w-3" aria-hidden="true" />
                          <span>Phổ biến</span>
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-3xl font-bold tabular-nums text-burgundy">
                      {formatVnd(plan.priceVnd)}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Lưu trữ {formatDuration(plan.durationMonths)}
                    </p>

                    <ul className="mt-6 space-y-2.5 text-sm text-ink-secondary">
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" aria-hidden="true" />
                        <span>{plan.maxWebsites} thiệp cưới</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" aria-hidden="true" />
                        <span>
                          {plan.maxViews === -1
                            ? "Lượt xem không giới hạn"
                            : `${new Intl.NumberFormat("vi-VN").format(plan.maxViews)} lượt xem`}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" aria-hidden="true" />
                        <span>{plan.maxImages} ảnh WebP tốc độ cao</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" aria-hidden="true" />
                        <span>
                          {plan.maxGuestsPerInvitation === -1
                            ? "Khách cá nhân hóa không giới hạn"
                            : `${plan.maxGuestsPerInvitation} khách cá nhân hóa`}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" aria-hidden="true" />
                        <span>
                          {plan.ledCheckinLimit === -1
                            ? "LED Realtime không giới hạn và Lucky Draw"
                            : `LED Realtime (${plan.ledCheckinLimit} ảnh)`}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" aria-hidden="true" />
                        <span>VietQR mừng cưới 0% phí</span>
                      </li>
                    </ul>
                  </div>

                  <Link
                    href={primaryCreateHref}
                    className={`mt-7 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition-colors duration-200 ${
                      highlight
                        ? "bg-burgundy text-ivory hover:bg-burgundy-dark"
                        : "border border-border-strong bg-surface text-ink hover:bg-blush-hover"
                    }`}
                  >
                    {plan.priceVnd === 0 ? "Dùng thử miễn phí" : "Chọn gói này"}
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-blush pb-[calc(3rem+env(safe-area-inset-bottom))] pt-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="font-serif text-lg font-bold text-ink">{SITE_CONFIG.brandName}</p>
            <p className="mt-1 text-xs text-ink-muted">
              Nền tảng thiệp cưới thông minh và Màn hình LED Realtime Việt Nam, {SITE_CONFIG.supportEmail}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-ink-secondary">
            <Link href="/templates" className="transition-colors duration-200 hover:text-burgundy">
              Thư viện mẫu thiệp
            </Link>
            <Link
              href="/s/minh-anh-gia-huy"
              className="transition-colors duration-200 hover:text-burgundy"
            >
              Thiệp mẫu sống
            </Link>
            <Link
              href="/stage/minh-anh-gia-huy"
              className="transition-colors duration-200 hover:text-burgundy"
            >
              Demo Màn hình LED
            </Link>
            <Link
              href="/tools/nen-anh"
              className="transition-colors duration-200 hover:text-burgundy"
            >
              Nén ảnh WebP
            </Link>
            <Link
              href="/tools/tao-qr-mung-cuoi"
              className="transition-colors duration-200 hover:text-burgundy"
            >
              Tạo QR bàn tiệc
            </Link>
            <Link
              href="/tools/xem-ngay-cuoi"
              className="transition-colors duration-200 hover:text-burgundy"
            >
              Xem ngày cưới Âm lịch
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
