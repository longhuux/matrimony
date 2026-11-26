"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ExternalLink,
  Music,
  Sparkles,
  X,
} from "lucide-react";
import { InvitationRenderer } from "@/components/invitation/invitation-renderer";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import {
  hydrateDocumentWithProfile,
  weddingProfileDataSchema,
  type InvitationDocumentV2,
} from "@/modules/invitation-engine/schema";

export interface GalleryTemplateItem {
  slug: string;
  name: string;
  description: string;
  category: string;
  tier: "free" | "pro";
  thumbnailUrl: string;
  defaultDoc: InvitationDocumentV2;
}

export interface TemplateGalleryProps {
  templates: GalleryTemplateItem[];
  isLoggedIn?: boolean;
  initialHighlightSlug?: string;
}

type FilterKey = "all" | "free" | "pro" | "traditional";

const FILTER_TABS: readonly { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "free", label: "Miễn phí" },
  { key: "pro", label: "Cao cấp" },
  { key: "traditional", label: "Truyền thống" },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  modern: "Hiện đại",
  traditional: "Truyền thống",
  romantic: "Lãng mạn",
  classic: "Cổ điển",
  editorial: "Tạp chí",
  luxury: "Sang trọng",
};

const OPENING_LABELS: Record<string, string> = {
  envelope: "Mở phong bì truyền thống",
  door: "Mở cánh cửa song hỷ",
  curtain: "Vén màn sân khấu",
  "photo-cover": "Chuyển cảnh bìa tạp chí",
  none: "Hiển thị trực tiếp",
};

const FOCUS_RING_CLASS =
  "focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2";

const PREVIEW_SAMPLE_PROFILE = weddingProfileDataSchema.parse({
  groom: {
    fullName: "Nguyễn Gia Huy",
    shortName: "Gia Huy",
    phone: "0901234567",
    fatherName: "Ông Nguyễn Văn Thành",
    motherName: "Bà Lê Thị Hồng",
    homeAddress: "24 Trần Hưng Đạo, Quận 5, TP. Hồ Chí Minh",
    homeMapUrl: "https://maps.google.com/?q=24+Tran+Hung+Dao+Quan+5+HCMC",
  },
  bride: {
    fullName: "Trần Minh Anh",
    shortName: "Minh Anh",
    phone: "0907654321",
    fatherName: "Ông Trần Quốc Tuấn",
    motherName: "Bà Phạm Thanh Mai",
    homeAddress: "48 Nguyễn Du, Quận 1, TP. Hồ Chí Minh",
    homeMapUrl: "https://maps.google.com/?q=48+Nguyen+Du+Quan+1+HCMC",
  },
  events: [
    {
      id: "ev_vu_quy",
      type: "vu_quy",
      title: "Lễ Vu Quy",
      date: "2026-10-18",
      welcomeTime: "08:00",
      time: "08:30",
      venueName: "Tư gia Nhà Gái",
      venueAddress: "48 Nguyễn Du, Bến Nghé, Quận 1, TP. Hồ Chí Minh",
      venueMapUrl: "https://maps.google.com/?q=48+Nguyen+Du+Quan+1+HCMC",
    },
    {
      id: "ev_thanh_hon",
      type: "tiec_cuoi",
      title: "Tiệc Cưới Thành Hôn",
      date: "2026-10-25",
      welcomeTime: "17:30",
      time: "18:30",
      venueName: "Trung tâm Hội nghị Gem Center",
      venueAddress: "8 Nguyễn Bỉnh Khiêm, Đa Kao, Quận 1, TP. Hồ Chí Minh",
      venueMapUrl: "https://maps.google.com/?q=Gem+Center+Ho+Chi+Minh",
    },
  ],
  mainEventId: "ev_thanh_hon",
  bankAccounts: [
    {
      side: "groom",
      bankBin: "970436",
      bankShortName: "VCB",
      accountNumber: "0071001234567",
      accountHolder: "NGUYEN GIA HUY",
    },
    {
      side: "bride",
      bankBin: "970407",
      bankShortName: "TCB",
      accountNumber: "19036888999001",
      accountHolder: "TRAN MINH ANH",
    },
  ],
});

function buildPreviewDocument(template: GalleryTemplateItem): InvitationDocumentV2 {
  const hydrated = hydrateDocumentWithProfile(template.defaultDoc, PREVIEW_SAMPLE_PROFILE);
  const fallbackCover = template.thumbnailUrl || "/images/wedding/hero-couple.webp";

  return {
    ...hydrated,
    sections: hydrated.sections.map((section) => {
      if (section.type === "hero") {
        const existingCover =
          typeof section.data.coverPhotoUrl === "string"
            ? section.data.coverPhotoUrl.trim()
            : "";
        return {
          ...section,
          data: {
            ...section.data,
            coverPhotoUrl: existingCover || fallbackCover,
          },
        };
      }
      return section;
    }),
  };
}

export function TemplateGallery({
  templates,
  initialHighlightSlug,
}: TemplateGalleryProps): React.ReactElement {
  const [activeFilter, setActiveFilter] = React.useState<FilterKey>("all");
  const [previewTemplate, setPreviewTemplate] = React.useState<GalleryTemplateItem | null>(() => {
    if (!initialHighlightSlug) return null;
    return templates.find((tpl) => tpl.slug === initialHighlightSlug) ?? null;
  });
  const modalPanelRef = React.useRef<HTMLDivElement | null>(null);

  useDialogFocus(Boolean(previewTemplate), modalPanelRef, {
    onClose: () => setPreviewTemplate(null),
  });

  const filteredTemplates = React.useMemo(() => {
    if (activeFilter === "all") return templates;
    if (activeFilter === "free" || activeFilter === "pro") {
      return templates.filter((tpl) => tpl.tier === activeFilter);
    }
    return templates.filter((tpl) => tpl.category === "traditional");
  }, [templates, activeFilter]);

  const hydratedPreviewDoc = React.useMemo(() => {
    if (!previewTemplate) return null;
    return buildPreviewDocument(previewTemplate);
  }, [previewTemplate]);

  return (
    <div>
      {/* 4 Editorial Filter Tabs */}
      <div
        className="mb-10 flex flex-wrap items-center gap-2 border-b border-border pb-3 sm:gap-6"
        role="group"
        aria-label="Lọc mẫu thiệp"
      >
        {FILTER_TABS.map((tab) => {
          const active = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              aria-pressed={active}
              onClick={() => setActiveFilter(tab.key)}
              className={`inline-flex min-h-[44px] cursor-pointer items-center border-b-2 px-2 pb-1 text-sm font-medium transition-colors ${FOCUS_RING_CLASS} ${
                active
                  ? "border-burgundy font-semibold text-burgundy"
                  : "border-transparent text-ink-secondary hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Lookbook Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-serif text-xl font-semibold text-ink">
            Chưa có mẫu thiệp phù hợp bộ lọc này
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            Chọn lại mục Tất cả để xem đầy đủ bộ sưu tập mẫu thiệp của Matrimony.
          </p>
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`mt-5 inline-flex min-h-[44px] cursor-pointer items-center rounded-full bg-burgundy px-5 text-sm font-semibold text-ivory transition-colors hover:bg-burgundy-dark ${FOCUS_RING_CLASS}`}
          >
            Xem tất cả mẫu
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {filteredTemplates.map((tpl) => {
            const useHref = `/dashboard/invitations?template=${encodeURIComponent(tpl.slug)}`;

            return (
              <article key={tpl.slug} className="min-w-0">
                {/* Editorial 3:4 Photography Frame */}
                <div className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-blush">
                  <button
                    type="button"
                    onClick={() => setPreviewTemplate(tpl)}
                    aria-label={`Xem thử mẫu ${tpl.name}`}
                    className={`relative block h-full w-full cursor-pointer text-left ${FOCUS_RING_CLASS}`}
                  >
                    <Image
                      src={tpl.thumbnailUrl}
                      alt={tpl.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover object-[50%_25%] transition-transform duration-500 motion-reduce:transition-none group-hover:scale-[1.03]"
                    />

                    {/* Subtle Hover Pill */}
                    <span className="pointer-events-none absolute right-3 top-3 inline-flex min-h-[32px] items-center rounded-full bg-ivory px-3 text-xs font-semibold text-ink opacity-0 shadow-sm transition-opacity duration-200 motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100">
                      Xem thử
                    </span>
                  </button>
                </div>

                {/* Clean 2-Row Typography Hierarchy Directly on Ivory Paper */}
                <div className="mt-3.5 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 font-serif text-lg font-semibold leading-snug text-ink">
                      {tpl.name}
                    </h2>
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        tpl.tier === "free"
                          ? "bg-blush text-burgundy"
                          : "bg-amber-surface text-amber-text"
                      }`}
                    >
                      {tpl.tier === "free" ? "Miễn phí" : "Pro"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => setPreviewTemplate(tpl)}
                      className={`inline-flex min-h-[44px] cursor-pointer items-center font-medium text-ink-secondary underline-offset-4 transition-colors hover:text-burgundy hover:underline ${FOCUS_RING_CLASS}`}
                    >
                      Xem thử trực tiếp
                    </button>
                    <Link
                      href={useHref}
                      className={`inline-flex min-h-[44px] items-center gap-1 font-semibold text-burgundy transition-colors hover:text-burgundy-dark ${FOCUS_RING_CLASS}`}
                    >
                      <span>Dùng mẫu này</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Accessible Live Preview Modal */}
      {previewTemplate && hydratedPreviewDoc ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stage-bg/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="template-preview-title"
          onClick={() => setPreviewTemplate(null)}
        >
          <div
            ref={modalPanelRef}
            tabIndex={-1}
            className="relative max-h-[90dvh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-ivory p-5 text-ink shadow-[var(--shadow-elevated)] outline-none sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewTemplate(null)}
              aria-label="Đóng bản xem trước"
              className={`absolute right-4 top-4 z-10 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-blush text-ink transition-colors hover:bg-border ${FOCUS_RING_CLASS}`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
              {/* Left Column: Real Interactive Mobile Frame */}
              <div className="flex justify-center lg:col-span-6">
                <div className="w-full max-w-[390px] max-h-[78vh] overflow-y-auto rounded-2xl border border-border bg-ivory">
                  <InvitationRenderer
                    key={previewTemplate.slug}
                    doc={hydratedPreviewDoc}
                    slug="minh-anh-gia-huy"
                    interactive={false}
                    previewMode={true}
                  />
                </div>
              </div>

              {/* Right Column: Clean Typography Summary */}
              <div className="flex flex-col justify-between space-y-6 lg:col-span-6 lg:pr-8">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blush px-3 py-1 text-xs font-semibold text-burgundy">
                      {CATEGORY_LABELS[previewTemplate.category] ?? previewTemplate.category}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        previewTemplate.tier === "free"
                          ? "bg-blush text-ink"
                          : "bg-amber-surface text-amber-text"
                      }`}
                    >
                      {previewTemplate.tier === "free" ? "Miễn phí" : "Gói Pro"}
                    </span>
                  </div>

                  <h3
                    id="template-preview-title"
                    className="mt-4 font-serif text-3xl font-bold leading-[1.2] text-ink"
                  >
                    {previewTemplate.name}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-ink-secondary">
                    {previewTemplate.description}
                  </p>
                </div>

                {/* Palette Swatches */}
                <div className="border-t border-border pt-5">
                  <p className="text-sm font-semibold text-ink">Bảng màu chủ đạo</p>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    {[
                      { label: "Nền", hex: previewTemplate.defaultDoc.theme.palette.background },
                      { label: "Chính", hex: previewTemplate.defaultDoc.theme.palette.primary },
                      { label: "Phụ", hex: previewTemplate.defaultDoc.theme.palette.secondary },
                      { label: "Nhấn", hex: previewTemplate.defaultDoc.theme.palette.accent },
                      { label: "Chữ", hex: previewTemplate.defaultDoc.theme.palette.text },
                    ].map((swatch) => (
                      <div key={swatch.label} className="flex items-center gap-2">
                        <span
                          className="h-5 w-5 rounded-full border border-border-strong"
                          style={{ backgroundColor: swatch.hex }}
                          title={swatch.hex}
                        />
                        <span className="text-xs font-medium text-ink-secondary">
                          {swatch.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Built-in Features */}
                <div className="border-t border-border pt-5">
                  <p className="text-sm font-semibold text-ink">Tích hợp sẵn trong mẫu</p>
                  <ul className="mt-3 space-y-2.5 text-sm text-ink-secondary">
                    <li className="flex items-start gap-2.5">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" aria-hidden="true" />
                      <span>
                        Hiệu ứng mở thiệp:{" "}
                        {OPENING_LABELS[
                          previewTemplate.defaultDoc.theme.effects?.opening ?? "envelope"
                        ] ?? "Mở phong bì truyền thống"}
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Music className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" aria-hidden="true" />
                      <span>
                        Nhạc nền mặc định:{" "}
                        {previewTemplate.defaultDoc.theme.music?.title ?? "Ánh Nắng Của Anh"}
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" aria-hidden="true" />
                      <span>
                        Đầy đủ {previewTemplate.defaultDoc.sections.filter((s) => s.visible).length} phần nội dung: Song hỷ hai họ, lịch Âm Can Chi, RSVP và hộp mừng VietQR 0% phí.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" aria-hidden="true" />
                      <span>
                        Đổi qua lại 8 mẫu bất kỳ lúc nào mà vẫn giữ nguyên ảnh cưới và lời mời.
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Modal Actions */}
                <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
                  <Link
                    href={`/dashboard/invitations?template=${encodeURIComponent(previewTemplate.slug)}`}
                    className={`inline-flex h-11 items-center justify-center gap-2 rounded-full bg-burgundy px-6 text-sm font-semibold text-ivory transition-colors hover:bg-burgundy-dark ${FOCUS_RING_CLASS}`}
                  >
                    <span>Dùng mẫu này ngay</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link
                    href="/s/minh-anh-gia-huy"
                    className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border-strong bg-surface px-5 text-sm font-semibold text-ink transition-colors hover:bg-blush-hover ${FOCUS_RING_CLASS}`}
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    <span>Xem thiệp mẫu sống</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
