"use client";

import * as React from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  CalendarHeart,
  Check,
  Crown,
  Eye,
  EyeOff,
  ImagePlus,
  Music2,
  Palette,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  compressImageToWebP,
  detectPortraitFocalPoint,
  extractWeddingPaletteFromImage,
} from "@/modules/ai/client-vision";
import type { CopywriterTone, GeneratedWeddingCopy } from "@/modules/ai/copywriter";
import { isoDateToLunar } from "@/modules/invitation-engine/lunar";
import type {
  InvitationDocumentV2,
  InvitationSection,
  WeddingProfileData,
} from "@/modules/invitation-engine/schema";
import { BUILT_IN_MUSIC_TRACKS } from "@/modules/invitation-engine/templates";

export interface QuickPanelTemplateOption {
  slug: string;
  name: string;
  description: string;
  category: string;
  tier: "free" | "pro";
  thumbnailUrl?: string;
  defaultDoc: InvitationDocumentV2;
}

export interface QuickPanelProfileOption {
  id: string;
  name: string;
  data: WeddingProfileData;
}

export interface QuickPanelUserPlan {
  tier: string;
  name: string;
  features: {
    removeWatermark: boolean;
    premiumTemplates: boolean;
    dynamicZaloOg: boolean;
    customMusic: boolean;
  };
}

export interface QuickPanelProps {
  step: 1 | 2 | 3;
  invitationId: string;
  doc: InvitationDocumentV2;
  templates: QuickPanelTemplateOption[];
  profiles: QuickPanelProfileOption[];
  userPlan: QuickPanelUserPlan;
  aiCredits: number;
  onAiCreditsChange: (remaining: number) => void;
  onUpdateDoc: (updater: (draft: InvitationDocumentV2) => void) => void;
  onSwitchTemplate: (templateDoc: InvitationDocumentV2) => void;
  onApplyProfile: (profile: WeddingProfileData) => void;
}

const HEADING_FONT_OPTIONS = [
  "Playfair Display",
  "Cormorant Garamond",
  "Merriweather",
  "Be Vietnam Pro",
] as const;

const BODY_FONT_OPTIONS = [
  "Be Vietnam Pro",
  "Inter",
  "Plus Jakarta Sans",
] as const;

const OPENING_EFFECT_OPTIONS: Array<{
  value: InvitationDocumentV2["theme"]["effects"]["opening"];
  label: string;
}> = [
  { value: "envelope", label: "Mở phong bì" },
  { value: "curtain", label: "Mở rèm lụa" },
  { value: "door", label: "Cổng lễ truyền thống" },
  { value: "photo-cover", label: "Ảnh bìa toàn màn" },
  { value: "none", label: "Không hiệu ứng" },
];

const PARTICLE_EFFECT_OPTIONS: Array<{
  value: InvitationDocumentV2["theme"]["effects"]["particles"];
  label: string;
}> = [
  { value: "petals", label: "Cánh hoa rơi" },
  { value: "hearts", label: "Trái tim bay" },
  { value: "sparkles", label: "Ánh sao lấp lánh" },
  { value: "snow", label: "Tuyết trắng" },
  { value: "confetti", label: "Pháo giấy chúc mừng" },
  { value: "none", label: "Tắt hiệu ứng hạt" },
];

const SECTION_LABELS: Record<InvitationSection["type"], string> = {
  hero: "Mở đầu & Ảnh bìa",
  couple: "Cô dâu, Chú rể & Hai gia đình",
  love_story: "Chuyện tình yêu",
  events_calendar: "Lịch trình & Địa điểm",
  gallery: "Album ảnh cưới",
  rsvp_wish: "Xác nhận tham dự & Lời chúc",
  vietqr_gift: "Hộp mừng cưới VietQR",
  footer: "Chân trang cảm ơn",
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizePhotosList(
  raw: unknown,
): Array<{ url: string; caption: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ url: string; caption: string }> = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      out.push({ url: item.trim(), caption: "" });
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      if (typeof obj.url === "string" && obj.url.trim()) {
        out.push({ url: obj.url.trim(), caption: asString(obj.caption) });
      }
    }
  }
  return out;
}

function getTemplateThumbnail(tpl: QuickPanelTemplateOption): string {
  if (tpl.thumbnailUrl) return tpl.thumbnailUrl;
  const hero = tpl.defaultDoc.sections.find((s) => s.type === "hero");
  const cover = asString(hero?.data.coverPhotoUrl);
  return cover || "/images/wedding/hero-couple.webp";
}

export function QuickPanel({
  step,
  invitationId,
  doc,
  templates,
  profiles,
  userPlan,
  aiCredits,
  onAiCreditsChange,
  onUpdateDoc,
  onSwitchTemplate,
  onApplyProfile,
}: QuickPanelProps): React.ReactElement {
  const [selectedProfileId, setSelectedProfileId] = React.useState<string>(
    profiles[0]?.id ?? "",
  );

  // Media upload states
  const [coverFileCache, setCoverFileCache] = React.useState<File | null>(null);
  const [uploadingCover, setUploadingCover] = React.useState(false);
  const [uploadingGallery, setUploadingGallery] = React.useState(false);
  const [uploadingMusic, setUploadingMusic] = React.useState(false);
  const [extractingPalette, setExtractingPalette] = React.useState(false);
  const [mediaNotice, setMediaNotice] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // AI copywriter states
  const [aiTone, setAiTone] = React.useState<CopywriterTone>("romantic");
  const [aiMeetingStory, setAiMeetingStory] = React.useState("");
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiNotice, setAiNotice] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const coverInputRef = React.useRef<HTMLInputElement | null>(null);
  const galleryInputRef = React.useRef<HTMLInputElement | null>(null);
  const paletteFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const musicInputRef = React.useRef<HTMLInputElement | null>(null);

  const sortedSections = React.useMemo(
    () => [...doc.sections].sort((a, b) => a.order - b.order),
    [doc.sections],
  );

  const heroSection = doc.sections.find((s) => s.type === "hero");
  const coupleSection = doc.sections.find((s) => s.type === "couple");
  const storySection = doc.sections.find((s) => s.type === "love_story");
  const eventsSection = doc.sections.find((s) => s.type === "events_calendar");
  const gallerySection = doc.sections.find((s) => s.type === "gallery");
  const rsvpSection = doc.sections.find((s) => s.type === "rsvp_wish");
  const giftSection = doc.sections.find((s) => s.type === "vietqr_gift");

  const updateSectionData = (
    sectionType: InvitationSection["type"],
    updater: (data: Record<string, unknown>) => void,
  ): void => {
    onUpdateDoc((draft) => {
      const target = draft.sections.find((s) => s.type === sectionType);
      if (target) {
        updater(target.data);
      }
    });
  };

  const toggleSectionVisibility = (sectionId: string): void => {
    onUpdateDoc((draft) => {
      const target = draft.sections.find((s) => s.id === sectionId);
      if (target) {
        target.visible = !target.visible;
      }
    });
  };

  const moveSectionOrder = (sectionId: string, direction: -1 | 1): void => {
    onUpdateDoc((draft) => {
      const ordered = [...draft.sections].sort((a, b) => a.order - b.order);
      const index = ordered.findIndex((s) => s.id === sectionId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
      const [moved] = ordered.splice(index, 1);
      ordered.splice(nextIndex, 0, moved);
      ordered.forEach((sec, idx) => {
        sec.order = idx;
      });
    });
  };

  const uploadMediaBlob = async (
    kind: "image" | "audio",
    blob: Blob,
    mimeType: string,
  ): Promise<string> => {
    const presignRes = await fetch("/api/media/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        mimeType,
        sizeBytes: blob.size,
        invitationId,
      }),
    });
    const presignData = (await presignRes.json().catch(() => ({}))) as {
      uploadUrl?: string;
      publicUrl?: string;
      error?: string;
    };
    if (!presignRes.ok || !presignData.uploadUrl || !presignData.publicUrl) {
      throw new Error(presignData.error || "Không thể tạo liên kết tải tệp lên.");
    }

    const putRes = await fetch(presignData.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body: blob,
    });
    if (!putRes.ok) {
      const errBody = (await putRes.json().catch(() => ({}))) as { error?: string };
      throw new Error(errBody.error || "Tải tệp lên máy chủ thất bại.");
    }

    return presignData.publicUrl;
  };

  const handleCoverUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingCover(true);
    setMediaNotice(null);
    setCoverFileCache(file);

    try {
      const [compressed, focalPoint] = await Promise.all([
        compressImageToWebP(file, { maxDimension: 1600, quality: 0.86 }),
        detectPortraitFocalPoint(file),
      ]);
      const publicUrl = await uploadMediaBlob(
        "image",
        compressed.blob,
        compressed.mimeType,
      );

      onUpdateDoc((draft) => {
        const hero = draft.sections.find((s) => s.type === "hero");
        if (hero) {
          hero.data.coverPhotoUrl = publicUrl;
          hero.data.coverFocalPoint = focalPoint;
        }
        if (!draft.seo) {
          draft.seo = { title: "", description: "", coverPhotoUrl: publicUrl };
        } else if (!draft.seo.coverPhotoUrl) {
          draft.seo.coverPhotoUrl = publicUrl;
        }
      });

      setMediaNotice({
        type: "success",
        text: `Đã tải ảnh bìa & tự động lấy tâm chân dung (${Math.round(focalPoint.x * 100)}%, ${Math.round(focalPoint.y * 100)}%).`,
      });
    } catch (err) {
      setMediaNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Không thể tải ảnh bìa.",
      });
    } finally {
      setUploadingCover(false);
    }
  };

  const handleGalleryUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    setUploadingGallery(true);
    setMediaNotice(null);

    try {
      const uploadedItems: Array<{ url: string; caption: string }> = [];
      for (const file of files.slice(0, 8)) {
        const compressed = await compressImageToWebP(file, {
          maxDimension: 1400,
          quality: 0.84,
        });
        const publicUrl = await uploadMediaBlob(
          "image",
          compressed.blob,
          compressed.mimeType,
        );
        uploadedItems.push({ url: publicUrl, caption: "" });
      }

      onUpdateDoc((draft) => {
        const gallery = draft.sections.find((s) => s.type === "gallery");
        if (gallery) {
          const existing = normalizePhotosList(gallery.data.photos);
          gallery.data.photos = [...existing, ...uploadedItems];
        }
      });

      setMediaNotice({
        type: "success",
        text: `Đã nén WebP và thêm ${uploadedItems.length} ảnh vào album cưới.`,
      });
    } catch (err) {
      setMediaNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Không thể tải ảnh album.",
      });
    } finally {
      setUploadingGallery(false);
    }
  };

  const applyPaletteFromFile = async (file: File): Promise<void> => {
    setExtractingPalette(true);
    setMediaNotice(null);
    try {
      const extracted = await extractWeddingPaletteFromImage(file);
      onUpdateDoc((draft) => {
        draft.theme.palette = extracted;
      });
      setMediaNotice({
        type: "success",
        text: "Đã trích xuất bảng màu hài hòa & đạt chuẩn tương phản WCAG từ ảnh bìa (0đ).",
      });
    } catch {
      setMediaNotice({
        type: "error",
        text: "Không thể phân tích bảng màu từ ảnh này.",
      });
    } finally {
      setExtractingPalette(false);
    }
  };

  const handleOneClickExtractPalette = (): void => {
    if (coverFileCache) {
      void applyPaletteFromFile(coverFileCache);
    } else {
      paletteFileInputRef.current?.click();
    }
  };

  const handleMusicUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingMusic(true);
    setMediaNotice(null);
    try {
      const mimeType = file.type || "audio/mpeg";
      const publicUrl = await uploadMediaBlob("audio", file, mimeType);
      const cleanName = file.name.replace(/\.[^/.]+$/, "");

      onUpdateDoc((draft) => {
        draft.theme.music = {
          trackId: "custom",
          url: publicUrl,
          title: cleanName || "Nhạc nền riêng",
        };
      });
      setMediaNotice({
        type: "success",
        text: "Đã tải lên nhạc nền tùy chỉnh.",
      });
    } catch (err) {
      setMediaNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Không thể tải nhạc nền.",
      });
    } finally {
      setUploadingMusic(false);
    }
  };

  const handleMagicCopy = async (): Promise<void> => {
    const groomRaw = asString(coupleSection?.data.groomName, "Chú Rể");
    const brideRaw = asString(coupleSection?.data.brideName, "Cô Dâu");
    const groomName = groomRaw.includes("{{") ? "Chú Rể" : groomRaw;
    const brideName = brideRaw.includes("{{") ? "Cô Dâu" : brideRaw;

    const primaryEv = getPrimaryEventSnapshot(eventsSection);

    setAiLoading(true);
    setAiNotice(null);
    try {
      const res = await fetch("/api/ai/magic-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groomName,
          brideName,
          tone: aiTone,
          meetingStory: aiMeetingStory.trim() || undefined,
          weddingDate: primaryEv.date || undefined,
          venueName: primaryEv.venueName || undefined,
          createInvitation: false,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        copy?: GeneratedWeddingCopy;
        remainingCredits?: number;
        error?: string;
      };
      if (!res.ok || !data.copy) {
        throw new Error(data.error || "Không thể tạo lời mời AI.");
      }

      const generated = data.copy;
      onUpdateDoc((draft) => {
        const hero = draft.sections.find((s) => s.type === "hero");
        if (hero) {
          hero.data.badge = generated.badge;
          hero.data.headline = generated.headline;
          hero.data.inviteMessage = generated.inviteMessage;
        }
        const story = draft.sections.find((s) => s.type === "love_story");
        if (story) {
          story.data.title = generated.storyTitle;
          story.data.milestones = generated.milestones;
        }
        const rsvp = draft.sections.find((s) => s.type === "rsvp_wish");
        if (rsvp) {
          rsvp.data.wishPrompt = generated.wishPrompt;
        }
        const footer = draft.sections.find((s) => s.type === "footer");
        if (footer) {
          footer.data.note = generated.inviteMessage;
        }
      });

      if (typeof data.remainingCredits === "number") {
        onAiCreditsChange(data.remainingCredits);
      }

      setAiNotice({
        type: "success",
        text: "Đã viết lại lời mở đầu, 3 cột mốc tình yêu & lời mời khách hoàn chỉnh!",
      });
    } catch (err) {
      setAiNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Không thể tạo lời mời AI.",
      });
    } finally {
      setAiLoading(false);
    }
  };

  if (step === 1) {
    return (
      <div className="space-y-6">
        {/* 8 Templates Grid with Visual Portrait Thumbnails */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
              1. Chọn mẫu thiệp ({templates.length} mẫu)
            </h3>
            <span className="text-xs text-ink-muted">
              Giữ nguyên nội dung khi đổi
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            {templates.map((tpl) => {
              const active = doc.theme.templateId === tpl.slug;
              const isProLocked =
                tpl.tier === "pro" && !userPlan.features.premiumTemplates;
              const { palette } = tpl.defaultDoc.theme;
              const thumbUrl = getTemplateThumbnail(tpl);

              return (
                <button
                  key={tpl.slug}
                  type="button"
                  onClick={() => onSwitchTemplate(tpl.defaultDoc)}
                  aria-pressed={active}
                  className={`group relative flex items-stretch gap-3 rounded-2xl border p-3 text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer motion-reduce:transition-none ${
                    active
                      ? "border-burgundy bg-blush-hover ring-1 ring-burgundy/30"
                      : "border-border bg-surface hover:border-border-strong hover:bg-ivory"
                  }`}
                >
                  <Image
                    unoptimized
                    src={thumbUrl}
                    alt={`Ảnh mẫu ${tpl.name}`}
                    width={56}
                    height={74}
                    className="h-[74px] w-14 shrink-0 rounded-lg border border-border object-cover"
                  />

                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-serif text-sm font-bold leading-snug text-ink">
                          {tpl.name}
                        </span>
                        {tpl.tier === "pro" ? (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-surface px-2 py-0.5 text-xs font-semibold text-amber-text"
                            title={isProLocked ? "Mẫu thuộc gói Pro" : "Mẫu Pro đã mở khóa"}
                          >
                            <Crown className="h-3 w-3" aria-hidden="true" />
                            Pro
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                        {tpl.description}
                      </p>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        {[
                          palette.background,
                          palette.primary,
                          palette.secondary,
                          palette.accent,
                        ].map((hex, i) => (
                          <span
                            key={`${tpl.slug}-${i}`}
                            className="h-3.5 w-3.5 rounded-full border border-border"
                            style={{ backgroundColor: hex }}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                      {active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-burgundy">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          Đang dùng
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Color Palette Pickers */}
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-burgundy" aria-hidden="true" />
            <h3 className="font-serif text-base font-bold text-ink">
              Bảng màu tùy chỉnh
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(
              [
                { key: "primary", label: "Màu chủ đạo" },
                { key: "secondary", label: "Nền phụ" },
                { key: "accent", label: "Viền nhấn" },
                { key: "text", label: "Màu chữ" },
                { key: "background", label: "Màu nền thiệp" },
              ] as const
            ).map(({ key, label }) => {
              const inputId = `palette-${key}`;
              return (
                <div key={key} className="space-y-1">
                  <label
                    htmlFor={inputId}
                    className="block text-xs font-semibold text-ink-secondary"
                  >
                    {label}
                  </label>
                  <div className="flex h-10 items-center gap-2 rounded-xl border border-border-strong bg-surface px-2">
                    <input
                      id={inputId}
                      type="color"
                      value={doc.theme.palette[key]}
                      onChange={(e) =>
                        onUpdateDoc((draft) => {
                          draft.theme.palette[key] = e.target.value;
                        })
                      }
                      className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <span className="font-mono text-xs text-ink-secondary tabular-nums">
                      {doc.theme.palette[key]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Fonts */}
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <h3 className="font-serif text-base font-bold text-ink">
            Phông chữ
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="font-heading-select"
                className="block text-xs font-semibold text-ink-secondary"
              >
                Tiêu đề
              </label>
              <select
                id="font-heading-select"
                value={doc.theme.fonts.heading}
                onChange={(e) =>
                  onUpdateDoc((draft) => {
                    draft.theme.fonts.heading = e.target.value;
                  })
                }
                className="h-10 w-full rounded-xl border border-border-strong bg-surface px-2.5 text-xs font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
              >
                {HEADING_FONT_OPTIONS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="font-body-select"
                className="block text-xs font-semibold text-ink-secondary"
              >
                Nội dung
              </label>
              <select
                id="font-body-select"
                value={doc.theme.fonts.body}
                onChange={(e) =>
                  onUpdateDoc((draft) => {
                    draft.theme.fonts.body = e.target.value;
                  })
                }
                className="h-10 w-full rounded-xl border border-border-strong bg-surface px-2.5 text-xs font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
              >
                {BODY_FONT_OPTIONS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Effects & Auto-scroll */}
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <h3 className="font-serif text-base font-bold text-ink">
            Hiệu ứng mở thiệp &amp; Cuộn trang
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="effect-opening-select"
                className="block text-xs font-semibold text-ink-secondary"
              >
                Hiệu ứng mở màn
              </label>
              <select
                id="effect-opening-select"
                value={doc.theme.effects.opening}
                onChange={(e) =>
                  onUpdateDoc((draft) => {
                    draft.theme.effects.opening =
                      e.target.value as InvitationDocumentV2["theme"]["effects"]["opening"];
                  })
                }
                className="h-10 w-full rounded-xl border border-border-strong bg-surface px-2.5 text-xs font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
              >
                {OPENING_EFFECT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="effect-particles-select"
                className="block text-xs font-semibold text-ink-secondary"
              >
                Hiệu ứng hạt rơi
              </label>
              <select
                id="effect-particles-select"
                value={doc.theme.effects.particles}
                onChange={(e) =>
                  onUpdateDoc((draft) => {
                    draft.theme.effects.particles =
                      e.target.value as InvitationDocumentV2["theme"]["effects"]["particles"];
                  })
                }
                className="h-10 w-full rounded-xl border border-border-strong bg-surface px-2.5 text-xs font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
              >
                {PARTICLE_EFFECT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="auto-scroll-range"
              className="mb-1 flex items-center justify-between text-xs font-semibold text-ink-secondary"
            >
              <span>Tốc độ tự động cuộn thiệp</span>
              <span className="tabular-nums">
                {doc.theme.effects.autoScrollSpeed === 0
                  ? "Tắt"
                  : `${Math.round((doc.theme.effects.autoScrollSpeed / 0.2) * 100)}%`}
              </span>
            </label>
            <input
              id="auto-scroll-range"
              type="range"
              min={0}
              max={0.2}
              step={0.01}
              value={doc.theme.effects.autoScrollSpeed}
              onChange={(e) =>
                onUpdateDoc((draft) => {
                  draft.theme.effects.autoScrollSpeed = Number(e.target.value);
                })
              }
              className="w-full accent-burgundy"
            />
          </div>
        </section>

        {/* Music selector */}
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Music2 className="h-4 w-4 text-burgundy" aria-hidden="true" />
              <h3 className="font-serif text-base font-bold text-ink">
                Nhạc nền thiệp cưới
              </h3>
            </div>
            {!userPlan.features.customMusic ? (
              <span className="rounded-full bg-amber-surface px-2.5 py-0.5 text-xs font-semibold text-amber-text">
                Tải MP3: Gói Pro
              </span>
            ) : null}
          </div>

          <div className="space-y-2">
            {BUILT_IN_MUSIC_TRACKS.map((track) => {
              const selected =
                doc.theme.music?.trackId === track.id && !doc.theme.music?.url;
              return (
                <button
                  key={track.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    onUpdateDoc((draft) => {
                      draft.theme.music = {
                        trackId: track.id,
                        title: track.title,
                        url: "",
                      };
                    })
                  }
                  className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer motion-reduce:transition-none ${
                    selected
                      ? "border-burgundy bg-blush-hover"
                      : "border-border bg-surface hover:bg-ivory"
                  }`}
                >
                  <div>
                    <p className="text-xs font-semibold text-ink">
                      {track.title}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {track.artist} • {track.mood}
                    </p>
                  </div>
                  {selected ? (
                    <Check className="h-4 w-4 text-burgundy" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <label
              htmlFor="custom-music-url"
              className="block text-xs font-semibold text-ink-secondary"
            >
              Hoặc nhạc nền riêng (URL MP3 / tải lên)
            </label>
            <div className="flex gap-2">
              <input
                id="custom-music-url"
                type="text"
                value={doc.theme.music?.url ?? ""}
                onChange={(e) =>
                  onUpdateDoc((draft) => {
                    draft.theme.music = {
                      trackId: e.target.value.trim() ? "custom" : "anh-nang-cua-anh",
                      title: draft.theme.music?.title || "Nhạc nền riêng",
                      url: e.target.value,
                    };
                  })
                }
                placeholder="https://... hoặc /api/media/local/..."
                className="h-10 flex-1 rounded-xl border border-border-strong bg-surface px-3 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploadingMusic || !userPlan.features.customMusic}
                onClick={() => musicInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                {uploadingMusic ? "Đang tải..." : "Tải MP3"}
              </Button>
              <input
                ref={musicInputRef}
                type="file"
                aria-label="Chọn tệp nhạc MP3 tải lên"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/mp4,audio/x-m4a"
                onChange={(e) => void handleMusicUpload(e)}
                className="hidden"
              />
            </div>
            {mediaNotice ? (
              <p
                role={mediaNotice.type === "error" ? "alert" : "status"}
                className={`text-xs font-medium ${
                  mediaNotice.type === "error" ? "text-red-700" : "text-ink-secondary"
                }`}
              >
                {mediaNotice.text}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  if (step === 2) {
    const milestones = getMilestonesList(storySection);
    const primaryEv = getPrimaryEventSnapshot(eventsSection);
    const lunarInfo = primaryEv.date ? isoDateToLunar(primaryEv.date) : null;
    const heroFocal = (heroSection?.data.coverFocalPoint as
      | { x?: number; y?: number }
      | undefined) ?? { x: 0.5, y: 0.34 };

    return (
      <div className="space-y-6">
        {/* 1-click Profile Hydration */}
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-burgundy" aria-hidden="true" />
            <h3 className="font-serif text-base font-bold text-ink">
              Điền nhanh từ Hồ sơ cưới
            </h3>
          </div>
          {profiles.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="profile-hydration-select" className="sr-only">
                Chọn hồ sơ đám cưới để điền nhanh
              </label>
              <select
                id="profile-hydration-select"
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="h-10 flex-1 rounded-xl border border-border-strong bg-surface px-3 text-xs font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.data.groom.shortName} &amp; {p.data.bride.shortName})
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const chosen = profiles.find((p) => p.id === selectedProfileId);
                  if (chosen) onApplyProfile(chosen.data);
                }}
              >
                Áp dụng hồ sơ
              </Button>
            </div>
          ) : (
            <p className="text-xs text-ink-muted">
              Bạn chưa tạo hồ sơ đám cưới nào. Có thể nhập trực tiếp các mục bên dưới hoặc tạo hồ sơ trong Bảng điều khiển.
            </p>
          )}
        </section>

        {/* Section Visibility & Reorder */}
        <section className="space-y-2.5 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <h3 className="font-serif text-base font-bold text-ink">
            Bật/Tắt &amp; Sắp xếp các phần
          </h3>
          <div className="space-y-1.5">
            {sortedSections.map((sec, idx) => (
              <div
                key={sec.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-ivory px-3 py-2"
              >
                <span className="truncate text-xs font-semibold text-ink">
                  {SECTION_LABELS[sec.type] ?? sec.type}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveSectionOrder(sec.id, -1)}
                    disabled={idx === 0}
                    aria-label="Di chuyển lên"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy disabled:opacity-35 cursor-pointer"
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSectionOrder(sec.id, 1)}
                    disabled={idx === sortedSections.length - 1}
                    aria-label="Di chuyển xuống"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy disabled:opacity-35 cursor-pointer"
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSectionVisibility(sec.id)}
                    aria-pressed={sec.visible}
                    aria-label={sec.visible ? "Ẩn phần này" : "Hiện phần này"}
                    className={`inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer motion-reduce:transition-none ${
                      sec.visible
                        ? "bg-blush text-burgundy"
                        : "border border-border bg-surface text-ink-muted"
                    }`}
                  >
                    {sec.visible ? (
                      <>
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        Hiện
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                        Ẩn
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Hero Section */}
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <h3 className="font-serif text-base font-bold text-ink">
            Phần mở đầu (Hero)
          </h3>
          <div className="space-y-2.5">
            <div className="space-y-1">
              <label
                htmlFor="hero-badge-input"
                className="block text-xs font-semibold text-ink-secondary"
              >
                Nhãn mở đầu
              </label>
              <input
                id="hero-badge-input"
                type="text"
                value={asString(heroSection?.data.badge, "Trân trọng báo tin")}
                onChange={(e) =>
                  updateSectionData("hero", (data) => {
                    data.badge = e.target.value;
                  })
                }
                className="h-10 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="hero-headline-input"
                className="block text-xs font-semibold text-ink-secondary"
              >
                Tên cặp đôi hiển thị chính
              </label>
              <input
                id="hero-headline-input"
                type="text"
                value={asString(heroSection?.data.headline)}
                onChange={(e) =>
                  updateSectionData("hero", (data) => {
                    data.headline = e.target.value;
                  })
                }
                className="h-10 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="hero-subtitle-input"
                className="block text-xs font-semibold text-ink-secondary"
              >
                Dòng phụ (Ngày cưới / Lời chào ngắn)
              </label>
              <input
                id="hero-subtitle-input"
                type="text"
                value={asString(heroSection?.data.subtitle)}
                onChange={(e) =>
                  updateSectionData("hero", (data) => {
                    data.subtitle = e.target.value;
                  })
                }
                className="h-10 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label
                  htmlFor="hero-focal-x"
                  className="mb-1 flex justify-between text-xs font-semibold text-ink-secondary"
                >
                  <span>Tâm ảnh bìa ngang</span>
                  <span className="tabular-nums">{Math.round(asNumber(heroFocal.x, 0.5) * 100)}%</span>
                </label>
                <input
                  id="hero-focal-x"
                  type="range"
                  min={0.1}
                  max={0.9}
                  step={0.02}
                  value={asNumber(heroFocal.x, 0.5)}
                  onChange={(e) =>
                    updateSectionData("hero", (data) => {
                      const prev = (data.coverFocalPoint as Record<string, number> | undefined) ?? {};
                      data.coverFocalPoint = {
                        x: Number(e.target.value),
                        y: asNumber(prev.y, 0.34),
                      };
                    })
                  }
                  className="w-full accent-burgundy"
                />
              </div>
              <div>
                <label
                  htmlFor="hero-focal-y"
                  className="mb-1 flex justify-between text-xs font-semibold text-ink-secondary"
                >
                  <span>Tâm ảnh bìa dọc</span>
                  <span className="tabular-nums">{Math.round(asNumber(heroFocal.y, 0.34) * 100)}%</span>
                </label>
                <input
                  id="hero-focal-y"
                  type="range"
                  min={0.1}
                  max={0.9}
                  step={0.02}
                  value={asNumber(heroFocal.y, 0.34)}
                  onChange={(e) =>
                    updateSectionData("hero", (data) => {
                      const prev = (data.coverFocalPoint as Record<string, number> | undefined) ?? {};
                      data.coverFocalPoint = {
                        x: asNumber(prev.x, 0.5),
                        y: Number(e.target.value),
                      };
                    })
                  }
                  className="w-full accent-burgundy"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Couple & Parents */}
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <h3 className="font-serif text-base font-bold text-ink">
            Cô dâu, Chú rể &amp; Song thân
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="space-y-2 rounded-xl border border-border bg-ivory p-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-burgundy">
                Nhà Trai
              </span>
              <input
                type="text"
                aria-label="Họ tên chú rể"
                placeholder="Họ tên chú rể"
                value={asString(coupleSection?.data.groomName)}
                onChange={(e) =>
                  updateSectionData("couple", (data) => {
                    data.groomName = e.target.value;
                  })
                }
                className="h-9 w-full rounded-xl border border-border-strong bg-surface px-2.5 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
              />
              <input
                type="text"
                aria-label="Song thân nhà trai"
                placeholder="Ông ... & Bà ..."
                value={asString(coupleSection?.data.groomParents)}
                onChange={(e) =>
                  updateSectionData("couple", (data) => {
                    data.groomParents = e.target.value;
                  })
                }
                className="h-9 w-full rounded-xl border border-border-strong bg-surface px-2.5 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
              />
              <input
                type="text"
                aria-label="Địa chỉ tư gia nhà trai"
                placeholder="Địa chỉ tư gia nhà trai"
                value={asString(coupleSection?.data.groomHomeAddress)}
                onChange={(e) =>
                  updateSectionData("couple", (data) => {
                    data.groomHomeAddress = e.target.value;
                  })
                }
                className="h-9 w-full rounded-xl border border-border-strong bg-surface px-2.5 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
              />
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-ivory p-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-burgundy">
                Nhà Gái
              </span>
              <input
                type="text"
                aria-label="Họ tên cô dâu"
                placeholder="Họ tên cô dâu"
                value={asString(coupleSection?.data.brideName)}
                onChange={(e) =>
                  updateSectionData("couple", (data) => {
                    data.brideName = e.target.value;
                  })
                }
                className="h-9 w-full rounded-xl border border-border-strong bg-surface px-2.5 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
              />
              <input
                type="text"
                aria-label="Song thân nhà gái"
                placeholder="Ông ... & Bà ..."
                value={asString(coupleSection?.data.brideParents)}
                onChange={(e) =>
                  updateSectionData("couple", (data) => {
                    data.brideParents = e.target.value;
                  })
                }
                className="h-9 w-full rounded-xl border border-border-strong bg-surface px-2.5 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
              />
              <input
                type="text"
                aria-label="Địa chỉ tư gia nhà gái"
                placeholder="Địa chỉ tư gia nhà gái"
                value={asString(coupleSection?.data.brideHomeAddress)}
                onChange={(e) =>
                  updateSectionData("couple", (data) => {
                    data.brideHomeAddress = e.target.value;
                  })
                }
                className="h-9 w-full rounded-xl border border-border-strong bg-surface px-2.5 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
              />
            </div>
          </div>
        </section>

        {/* Love Story 3 milestones */}
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <h3 className="font-serif text-base font-bold text-ink">
            Chuyện chúng mình (3 cột mốc)
          </h3>
          <input
            type="text"
            aria-label="Tiêu đề mục chuyện tình yêu"
            placeholder="Tiêu đề mục"
            value={asString(storySection?.data.title, "Chuyện chúng mình")}
            onChange={(e) =>
              updateSectionData("love_story", (data) => {
                data.title = e.target.value;
              })
            }
            className="h-10 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
          />
          <div className="space-y-2.5">
            {milestones.map((m, idx) => (
              <div
                key={`milestone-${idx}`}
                className="space-y-1.5 rounded-xl border border-border bg-ivory p-3"
              >
                <input
                  type="text"
                  aria-label={`Tiêu đề mốc ${idx + 1}`}
                  placeholder={`Tiêu đề mốc ${idx + 1}`}
                  value={m.year}
                  onChange={(e) =>
                    updateSectionData("love_story", (data) => {
                      const next = getMilestonesList({ data } as InvitationSection);
                      next[idx] = { ...next[idx], year: e.target.value };
                      data.milestones = next;
                    })
                  }
                  className="h-9 w-full rounded-lg border border-border-strong bg-surface px-2.5 text-xs font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
                />
                <textarea
                  rows={2}
                  aria-label={`Kỷ niệm mốc ${idx + 1}`}
                  placeholder="Kỷ niệm ngắn..."
                  value={m.caption}
                  onChange={(e) =>
                    updateSectionData("love_story", (data) => {
                      const next = getMilestonesList({ data } as InvitationSection);
                      next[idx] = { ...next[idx], caption: e.target.value };
                      data.milestones = next;
                    })
                  }
                  className="w-full rounded-lg border border-border-strong bg-surface p-2.5 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Events & Live Lunar Can Chi */}
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarHeart className="h-4 w-4 text-burgundy" aria-hidden="true" />
              <h3 className="font-serif text-base font-bold text-ink">
                Nghi lễ &amp; Địa điểm chính
              </h3>
            </div>
          </div>

          {lunarInfo ? (
            <div className="rounded-xl border border-border bg-amber-surface px-3 py-2 text-xs text-amber-text tabular-nums">
              <span className="font-semibold">Âm lịch:</span> {lunarInfo.formatted} • Ngày{" "}
              {lunarInfo.canChiDay}, Tháng {lunarInfo.canChiMonth}
            </div>
          ) : null}

          <div className="space-y-2.5">
            <input
              type="text"
              aria-label="Tên buổi lễ"
              placeholder="Tên buổi lễ (VD: Lễ Thành Hôn)"
              value={primaryEv.title}
              onChange={(e) =>
                updatePrimaryEvent(onUpdateDoc, { title: e.target.value })
              }
              className="h-10 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
            />

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label
                  htmlFor="event-date-input"
                  className="block text-xs font-semibold text-ink-secondary"
                >
                  Ngày (Dương)
                </label>
                <input
                  id="event-date-input"
                  type="date"
                  value={primaryEv.date}
                  onChange={(e) =>
                    updatePrimaryEvent(onUpdateDoc, { date: e.target.value })
                  }
                  className="h-9 w-full rounded-xl border border-border-strong bg-surface px-2 text-xs text-ink tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="event-welcome-time"
                  className="block text-xs font-semibold text-ink-secondary"
                >
                  Đón khách
                </label>
                <input
                  id="event-welcome-time"
                  type="text"
                  placeholder="10:30"
                  value={primaryEv.welcomeTime}
                  onChange={(e) =>
                    updatePrimaryEvent(onUpdateDoc, { welcomeTime: e.target.value })
                  }
                  className="h-9 w-full rounded-xl border border-border-strong bg-surface px-2.5 text-xs text-ink tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="event-start-time"
                  className="block text-xs font-semibold text-ink-secondary"
                >
                  Khai tiệc
                </label>
                <input
                  id="event-start-time"
                  type="text"
                  placeholder="11:30"
                  value={primaryEv.time}
                  onChange={(e) =>
                    updatePrimaryEvent(onUpdateDoc, { time: e.target.value })
                  }
                  className="h-9 w-full rounded-xl border border-border-strong bg-surface px-2.5 text-xs text-ink tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
                />
              </div>
            </div>

            <input
              type="text"
              aria-label="Tên nhà hàng hoặc trung tâm tiệc cưới"
              placeholder="Tên nhà hàng / trung tâm tiệc cưới"
              value={primaryEv.venueName}
              onChange={(e) =>
                updatePrimaryEvent(onUpdateDoc, { venueName: e.target.value })
              }
              className="h-10 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
            />

            <input
              type="text"
              aria-label="Địa chỉ chi tiết nơi tổ chức"
              placeholder="Địa chỉ chi tiết"
              value={primaryEv.venueAddress}
              onChange={(e) =>
                updatePrimaryEvent(onUpdateDoc, { venueAddress: e.target.value })
              }
              className="h-10 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
            />

            <input
              type="url"
              aria-label="Đường dẫn Google Maps"
              placeholder="Link Google Maps (https://...)"
              value={primaryEv.venueMapUrl}
              onChange={(e) =>
                updatePrimaryEvent(onUpdateDoc, { venueMapUrl: e.target.value })
              }
              className="h-10 w-full rounded-xl border border-border-strong bg-surface px-3 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
            />
          </div>
        </section>

        {/* VietQR Gift & RSVP Headings */}
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <h3 className="font-serif text-base font-bold text-ink">
            Tiêu đề Hộp mừng cưới &amp; RSVP
          </h3>
          <div className="space-y-1">
            <label
              htmlFor="gift-heading-input"
              className="block text-xs font-semibold text-ink-secondary"
            >
              Tiêu đề Hộp Mừng Cưới VietQR
            </label>
            <input
              id="gift-heading-input"
              type="text"
              value={asString(giftSection?.data.title, "Hộp Mừng Cưới")}
              onChange={(e) =>
                updateSectionData("vietqr_gift", (data) => {
                  data.title = e.target.value;
                })
              }
              className="h-10 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="rsvp-heading-input"
              className="block text-xs font-semibold text-ink-secondary"
            >
              Tiêu đề Xác nhận tham dự &amp; Lời chúc
            </label>
            <input
              id="rsvp-heading-input"
              type="text"
              value={asString(
                rsvpSection?.data.title,
                "Xác nhận tham dự & Gửi lời chúc",
              )}
              onChange={(e) =>
                updateSectionData("rsvp_wish", (data) => {
                  data.title = e.target.value;
                })
              }
              className="h-10 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
            />
          </div>
        </section>
      </div>
    );
  }

  // Step 3: Ảnh cưới & AI
  const coverUrl = asString(heroSection?.data.coverPhotoUrl);
  const galleryPhotos = normalizePhotosList(gallerySection?.data.photos);

  return (
    <div className="space-y-6">
      {mediaNotice ? (
        <p
          role={mediaNotice.type === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
            mediaNotice.type === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-border bg-amber-surface text-amber-text"
          }`}
        >
          {mediaNotice.text}
        </p>
      ) : null}

      {/* Cover Photo + 0đ Color Extraction */}
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-serif text-base font-bold text-ink">
            Ảnh bìa &amp; Phối màu thông minh
          </h3>
          <span className="rounded-full bg-amber-surface px-2.5 py-0.5 text-xs font-semibold text-amber-text">
            WebP tự động
          </span>
        </div>

        {coverUrl ? (
          <div className="relative overflow-hidden rounded-xl border border-border">
            <Image
              unoptimized
              src={coverUrl}
              alt="Ảnh bìa thiệp cưới"
              width={800}
              height={500}
              className="aspect-[16/10] w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-[16/10] flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-ivory p-4 text-center">
            <ImagePlus className="h-7 w-7 text-ink-muted" aria-hidden="true" />
            <p className="mt-2 text-xs text-ink-muted">
              Chưa có ảnh bìa. Tải ảnh để tự động nén WebP &amp; lấy tâm khuôn mặt.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={uploadingCover}
            onClick={() => coverInputRef.current?.click()}
            className="w-full"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            {uploadingCover ? "Đang nén & tải..." : "Tải ảnh bìa"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={extractingPalette}
            onClick={handleOneClickExtractPalette}
            className="w-full"
          >
            <Palette className="h-3.5 w-3.5 text-burgundy" aria-hidden="true" />
            {extractingPalette ? "Đang phối màu..." : "Phối màu từ ảnh bìa (0đ)"}
          </Button>
        </div>

        <input
          ref={coverInputRef}
          type="file"
          aria-label="Chọn ảnh bìa thiệp cưới"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(e) => void handleCoverUpload(e)}
          className="hidden"
        />
        <input
          ref={paletteFileInputRef}
          type="file"
          aria-label="Chọn ảnh để trích xuất bảng màu"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void applyPaletteFromFile(file);
          }}
          className="hidden"
        />
      </section>

      {/* Album Gallery */}
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-serif text-base font-bold text-ink tabular-nums">
            Album ảnh cưới ({galleryPhotos.length})
          </h3>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={uploadingGallery}
            onClick={() => galleryInputRef.current?.click()}
          >
            <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
            {uploadingGallery ? "Đang tải..." : "Thêm ảnh album"}
          </Button>
          <input
            ref={galleryInputRef}
            type="file"
            aria-label="Chọn nhiều ảnh cho album cưới"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(e) => void handleGalleryUpload(e)}
            className="hidden"
          />
        </div>

        {galleryPhotos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-strong p-4 text-center text-xs text-ink-muted">
            Tải nhiều ảnh cùng lúc — hệ thống tự động nén WebP ngay trên trình duyệt.
          </p>
        ) : (
          <div className="space-y-2.5">
            {galleryPhotos.map((photo, idx) => (
              <div
                key={`${photo.url}-${idx}`}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-ivory p-2"
              >
                <Image
                  unoptimized
                  src={photo.url}
                  alt={photo.caption || `Ảnh ${idx + 1}`}
                  width={48}
                  height={56}
                  className="h-14 w-12 shrink-0 rounded-lg border border-border object-cover"
                />
                <input
                  type="text"
                  aria-label={`Chú thích ảnh ${idx + 1}`}
                  placeholder="Chú thích ảnh (tùy chọn)..."
                  value={photo.caption}
                  onChange={(e) =>
                    updateSectionData("gallery", (data) => {
                      const next = normalizePhotosList(data.photos);
                      if (next[idx]) next[idx].caption = e.target.value;
                      data.photos = next;
                    })
                  }
                  className="h-9 flex-1 rounded-lg border border-border-strong bg-surface px-2.5 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateSectionData("gallery", (data) => {
                      const next = normalizePhotosList(data.photos);
                      next.splice(idx, 1);
                      data.photos = next;
                    })
                  }
                  aria-label="Xóa ảnh khỏi album"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-burgundy hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* AI Copywriter */}
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-burgundy" aria-hidden="true" />
            <h3 className="font-serif text-base font-bold text-ink">
              AI Viết lời mời cưới
            </h3>
          </div>
          <span className="rounded-full bg-blush px-2.5 py-0.5 text-xs font-semibold text-burgundy tabular-nums">
            Còn {aiCredits} lượt
          </span>
        </div>

        <p className="text-xs leading-relaxed text-ink-secondary">
          Tự động viết lời mở đầu, câu chuyện 3 cột mốc và lời mời khách theo phong cách bạn chọn (tốn 1 lượt AI).
        </p>

        <fieldset className="space-y-1.5">
          <legend className="sr-only">Phong cách viết lời mời AI</legend>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: "romantic", label: "Lãng mạn" },
                { value: "formal", label: "Trang trọng" },
                { value: "playful", label: "Trẻ trung" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={aiTone === opt.value}
                onClick={() => setAiTone(opt.value)}
                className={`h-9 rounded-full border text-xs font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer motion-reduce:transition-none ${
                  aiTone === opt.value
                    ? "border-burgundy bg-burgundy text-ivory"
                    : "border-border-strong bg-surface text-ink hover:bg-blush-hover"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="ai-meeting-story" className="sr-only">
            Gợi ý câu chuyện của hai bạn cho AI
          </label>
          <textarea
            id="ai-meeting-story"
            rows={2}
            maxLength={400}
            value={aiMeetingStory}
            onChange={(e) => setAiMeetingStory(e.target.value)}
            placeholder="Gợi ý thêm (tùy chọn): Hai đứa gặp nhau ở Đà Lạt, thích cà phê sáng..."
            className="w-full rounded-xl border border-border-strong bg-surface p-3 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
          />
        </div>

        {aiNotice ? (
          <p
            role={aiNotice.type === "error" ? "alert" : "status"}
            aria-live="polite"
            className={`rounded-xl border px-3 py-2 text-xs font-medium ${
              aiNotice.type === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-border bg-amber-surface text-amber-text"
            }`}
          >
            {aiNotice.text}
          </p>
        ) : null}

        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={aiLoading || aiCredits <= 0}
          onClick={() => void handleMagicCopy()}
          className="w-full"
        >
          <Wand2 className="h-4 w-4" aria-hidden="true" />
          {aiLoading ? "Đang viết lời mời..." : "AI Viết lời mời (1 credit)"}
        </Button>
      </section>
    </div>
  );
}

function getMilestonesList(
  section?: InvitationSection,
): Array<{ year: string; caption: string }> {
  const raw = section?.data.milestones;
  const defaults = [
    { year: "Lần đầu gặp gỡ", caption: "Khoảnh khắc bắt đầu một hành trình mới." },
    { year: "Lời cầu hôn", caption: "Cái gật đầu cho một đời bên nhau." },
    { year: "Ngày chung đôi", caption: "Hân hạnh đón tiếp gia đình và bạn bè." },
  ];
  if (!Array.isArray(raw) || raw.length === 0) return defaults;
  return [0, 1, 2].map((idx) => {
    const item = raw[idx];
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      return {
        year: asString(obj.year, defaults[idx].year),
        caption: asString(obj.caption, defaults[idx].caption),
      };
    }
    return defaults[idx];
  });
}

function getPrimaryEventSnapshot(section?: InvitationSection): {
  title: string;
  date: string;
  time: string;
  welcomeTime: string;
  venueName: string;
  venueAddress: string;
  venueMapUrl: string;
} {
  const data = section?.data ?? {};
  if (Array.isArray(data.events) && data.events.length > 0) {
    const first = data.events[0] as Record<string, unknown>;
    return {
      title: asString(first.title),
      date: asString(first.date),
      time: asString(first.time, "11:00"),
      welcomeTime: asString(first.welcomeTime, "10:30"),
      venueName: asString(first.venueName),
      venueAddress: asString(first.venueAddress),
      venueMapUrl: asString(first.venueMapUrl),
    };
  }
  const iso = asString(data.eventIsoDate);
  return {
    title: asString(data.eventTitle),
    date: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : "",
    time: asString(data.eventTime, "11:00"),
    welcomeTime: asString(data.welcomeTime, "10:30"),
    venueName: asString(data.venueName),
    venueAddress: asString(data.venueAddress),
    venueMapUrl: asString(data.venueMapLink),
  };
}

function updatePrimaryEvent(
  onUpdateDoc: (updater: (draft: InvitationDocumentV2) => void) => void,
  patch: Partial<{
    title: string;
    date: string;
    time: string;
    welcomeTime: string;
    venueName: string;
    venueAddress: string;
    venueMapUrl: string;
  }>,
): void {
  onUpdateDoc((draft) => {
    const section = draft.sections.find((s) => s.type === "events_calendar");
    if (!section) return;
    const data = section.data;

    if (Array.isArray(data.events) && data.events.length > 0) {
      const first: Record<string, unknown> = {
        ...(data.events[0] as Record<string, unknown>),
        ...patch,
      };
      if (patch.date) {
        first.formattedDate = patch.date.split("-").reverse().join("/");
        const lunar = isoDateToLunar(patch.date);
        first.lunarDate = lunar?.formatted ?? "";
        first.canChiDay = lunar?.canChiDay ?? "";
        data.eventIsoDate = patch.date;
      }
      data.events[0] = first;
      return;
    }

    if (patch.title !== undefined) data.eventTitle = patch.title;
    if (patch.time !== undefined) data.eventTime = patch.time;
    if (patch.welcomeTime !== undefined) data.welcomeTime = patch.welcomeTime;
    if (patch.venueName !== undefined) data.venueName = patch.venueName;
    if (patch.venueAddress !== undefined) data.venueAddress = patch.venueAddress;
    if (patch.venueMapUrl !== undefined) data.venueMapLink = patch.venueMapUrl;
    if (patch.date !== undefined) {
      data.eventIsoDate = patch.date;
      data.eventDate = patch.date ? patch.date.split("-").reverse().join("/") : "";
      const lunar = patch.date ? isoDateToLunar(patch.date) : null;
      data.eventDateLunar = lunar?.formatted ?? "";
      data.eventCanChiDay = lunar?.canChiDay ?? "";
    }
  });
}
