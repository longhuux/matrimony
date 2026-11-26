"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  History,
  ImagePlus,
  Palette,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useDashboardContext } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  compressImageToWebP,
  detectPortraitFocalPoint,
  extractWeddingPaletteFromImage,
  type ExtractedWeddingPalette,
  type PortraitFocalPoint,
} from "@/modules/ai/client-vision";
import type { CopywriterTone, GeneratedWeddingCopy } from "@/modules/ai/copywriter";

interface TemplateOption {
  id: string;
  slug: string;
  name: string;
  description: string;
  tier: "free" | "pro";
}

interface ProfileOption {
  id: string;
  name: string;
  groomInfo: { fullName: string; shortName: string };
  brideInfo: { fullName: string; shortName: string };
  events: Array<{ date: string; venueName: string }>;
}

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2";

const TONE_OPTIONS: ReadonlyArray<{
  value: CopywriterTone;
  label: string;
  desc: string;
}> = [
  {
    value: "romantic",
    label: "Lãng mạn",
    desc: "Dịu dàng, sâu lắng kiểu tạp chí cưới editorial.",
  },
  {
    value: "formal",
    label: "Trang trọng",
    desc: "Chuẩn mực, lễ phép phù hợp gia đình hai bên.",
  },
  {
    value: "playful",
    label: "Vui tươi",
    desc: "Trẻ trung, hóm hỉnh và gần gũi với bạn bè.",
  },
];

const REASON_LABELS: Record<string, string> = {
  ai_magic_setup: "Tạo thiệp AI Magic Setup",
  ai_magic_setup_refund: "Hoàn lại AI Credit",
  signup_bonus: "Tặng thưởng đăng ký tài khoản",
  plan_upgrade_pro: "Nâng cấp gói Pro",
  plan_upgrade_combo: "Nâng cấp gói Combo",
  plan_upgrade_studio_pilot: "Nâng cấp gói Pilot Studio",
};

export default function AiMagicPage(): React.ReactElement {
  const router = useRouter();
  const dashboardCtx = useDashboardContext();

  const [templates, setTemplates] = React.useState<TemplateOption[]>([]);
  const [profiles, setProfiles] = React.useState<ProfileOption[]>([]);

  // Step 1: Cover Photo + Client Vision
  const [photoPreviewUrl, setPhotoPreviewUrl] = React.useState<string>("");
  const [uploadedCoverUrl, setUploadedCoverUrl] = React.useState<string>("");
  const [palette, setPalette] = React.useState<ExtractedWeddingPalette | null>(null);
  const [applyExtractedPalette, setApplyExtractedPalette] = React.useState(true);
  const [focalPoint, setFocalPoint] = React.useState<PortraitFocalPoint | null>(null);
  const [photoProcessing, setPhotoProcessing] = React.useState(false);

  // Step 2: Couple Details & Tone
  const [selectedProfileId, setSelectedProfileId] = React.useState("");
  const [groomName, setGroomName] = React.useState("");
  const [brideName, setBrideName] = React.useState("");
  const [weddingDate, setWeddingDate] = React.useState("");
  const [venueName, setVenueName] = React.useState("");
  const [meetingStory, setMeetingStory] = React.useState("");
  const [tone, setTone] = React.useState<CopywriterTone>("romantic");

  // Step 3: Template & Submission
  const [templateSlug, setTemplateSlug] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [previewCopy, setPreviewCopy] = React.useState<GeneratedWeddingCopy | null>(null);
  const [createdInvitationId, setCreatedInvitationId] = React.useState<string | null>(null);
  const [creditsOverride, setCreditsOverride] = React.useState<number | null>(null);

  const currentCredits = creditsOverride ?? dashboardCtx?.user.aiCredits ?? 0;
  const ledger = dashboardCtx?.aiCreditLedger ?? [];

  React.useEffect(() => {
    async function loadMeta(): Promise<void> {
      try {
        const [tplRes, profRes] = await Promise.all([
          fetch("/api/templates"),
          fetch("/api/wedding-profiles"),
        ]);
        if (tplRes.ok) {
          const tplJson = (await tplRes.json()) as { templates?: TemplateOption[] };
          const list = tplJson.templates ?? [];
          setTemplates(list);
          if (list.length > 0) setTemplateSlug(list[0].slug);
        }
        if (profRes.ok) {
          const profJson = (await profRes.json()) as { profiles?: ProfileOption[] };
          setProfiles(profJson.profiles ?? []);
        }
      } catch {
        // Non-blocking
      }
    }
    void loadMeta();
  }, []);

  React.useEffect(() => {
    return () => {
      if (photoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  function handleApplyProfile(profileId: string): void {
    setSelectedProfileId(profileId);
    const found = profiles.find((p) => p.id === profileId);
    if (!found) return;
    setGroomName(found.groomInfo.shortName || found.groomInfo.fullName);
    setBrideName(found.brideInfo.shortName || found.brideInfo.fullName);
    const firstEvent = found.events[0];
    if (firstEvent) {
      if (firstEvent.date) {
        setWeddingDate(firstEvent.date.split("-").reverse().join("/"));
      }
      if (firstEvent.venueName) {
        setVenueName(firstEvent.venueName);
      }
    }
  }

  async function handlePhotoSelected(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoProcessing(true);
    setError(null);

    if (photoPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    const localPreview = URL.createObjectURL(file);
    setPhotoPreviewUrl(localPreview);

    try {
      const [compressed, extractedPalette, detectedFocal] = await Promise.all([
        compressImageToWebP(file, { maxDimension: 1600, maxBytes: 1_500_000 }),
        extractWeddingPaletteFromImage(file),
        detectPortraitFocalPoint(file),
      ]);

      setPalette(extractedPalette);
      setFocalPoint(detectedFocal);

      // Presign & upload compressed image
      const presignRes = await fetch("/api/media/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "image",
          mimeType: compressed.mimeType,
          sizeBytes: compressed.blob.size,
        }),
      });
      const presignData = (await presignRes.json().catch(() => ({}))) as {
        uploadUrl?: string;
        publicUrl?: string;
        error?: string;
      };
      if (!presignRes.ok || !presignData.uploadUrl || !presignData.publicUrl) {
        throw new Error(presignData.error || "Không thể tạo liên kết tải ảnh lên.");
      }

      const uploadRes = await fetch(presignData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": compressed.mimeType },
        body: compressed.blob,
      });
      if (!uploadRes.ok) {
        throw new Error("Tải ảnh bìa lên kho lưu trữ thất bại.");
      }

      const absoluteUrl = presignData.publicUrl.startsWith("/")
        ? `${window.location.origin}${presignData.publicUrl}`
        : presignData.publicUrl;
      setUploadedCoverUrl(absoluteUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xử lý ảnh cưới thất bại.");
    } finally {
      setPhotoProcessing(false);
    }
  }

  async function runMagicSetup(createInvitation: boolean): Promise<void> {
    if (!groomName.trim() || !brideName.trim()) {
      setError("Vui lòng nhập tên Chú rể và Cô dâu.");
      return;
    }

    setGenerating(true);
    setError(null);
    setPreviewCopy(null);
    setCreatedInvitationId(null);

    try {
      const res = await fetch("/api/ai/magic-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groomName: groomName.trim(),
          brideName: brideName.trim(),
          tone,
          ...(meetingStory.trim() ? { meetingStory: meetingStory.trim() } : {}),
          ...(weddingDate.trim() ? { weddingDate: weddingDate.trim() } : {}),
          ...(venueName.trim() ? { venueName: venueName.trim() } : {}),
          createInvitation,
          ...(templateSlug ? { templateSlug } : {}),
          ...(selectedProfileId ? { profileId: selectedProfileId } : {}),
          ...(palette && applyExtractedPalette ? { palette } : {}),
          ...(uploadedCoverUrl
            ? {
                coverPhoto: {
                  url: uploadedCoverUrl,
                  ...(focalPoint ? { focalPoint } : {}),
                },
              }
            : {}),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        copy?: GeneratedWeddingCopy;
        remainingCredits?: number;
        invitation?: { id: string };
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "Không thể chạy AI Magic Setup.");
      }

      if (typeof data.remainingCredits === "number") {
        setCreditsOverride(data.remainingCredits);
      }
      if (data.copy) {
        setPreviewCopy(data.copy);
      }
      router.refresh();

      if (createInvitation && data.invitation?.id) {
        setCreatedInvitationId(data.invitation.id);
        router.push(`/editor/${data.invitation.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI Magic Setup thất bại.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">
            AI Magic Setup 30 Giây
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Tải lên ảnh bìa cưới để tự động trích xuất bảng màu, canh chân dung không cắt mặt và viết lời mời tiếng Việt.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-amber-surface px-4 py-2 text-xs font-semibold tabular-nums text-amber-text">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Số dư: {currentCredits} AI credits
          </span>
          {currentCredits === 0 ? (
            <Link
              href="/dashboard/billing"
              className={`inline-flex min-h-[44px] items-center rounded-full bg-burgundy px-4 text-xs font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark motion-reduce:transition-none ${FOCUS_RING}`}
            >
              Mua thêm credits
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left: 3-Step Wizard */}
        <div className="space-y-6">
          {/* Step 1: Cover Photo Vision */}
          <Card className="p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-burgundy text-xs font-bold tabular-nums text-ivory">
                1
              </span>
              <h2 className="font-serif text-xl font-bold text-ink">
                Tải ảnh bìa &amp; Phân tích màu sắc (Tùy chọn)
              </h2>
            </div>

            <div className="mt-4 grid gap-5 border-t border-border pt-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="ai-cover-upload"
                  className={`flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong bg-ivory p-6 text-center transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none ${FOCUS_RING}`}
                >
                  <ImagePlus className="h-7 w-7 text-burgundy" aria-hidden="true" />
                  <span className="mt-2 text-xs font-semibold text-ink">
                    {photoProcessing ? "Đang nén WebP & trích màu..." : "Chọn ảnh cưới từ máy"}
                  </span>
                  <span className="mt-1 text-xs text-ink-muted">
                    Tự động nén WebP &amp; nhận diện khuôn mặt
                  </span>
                  <input
                    id="ai-cover-upload"
                    type="file"
                    accept="image/*"
                    disabled={photoProcessing}
                    onChange={(e) => void handlePhotoSelected(e)}
                    className="sr-only"
                  />
                </label>

                {photoPreviewUrl ? (
                  <div className="relative mt-3 overflow-hidden rounded-xl border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreviewUrl}
                      alt="Ảnh bìa đã tải"
                      decoding="async"
                      className="h-44 w-full object-cover"
                      style={
                        focalPoint
                          ? { objectPosition: `${focalPoint.x * 100}% ${focalPoint.y * 100}%` }
                          : undefined
                      }
                    />
                    {focalPoint ? (
                      <div
                        className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-burgundy/80 shadow"
                        style={{
                          left: `${focalPoint.x * 100}%`,
                          top: `${focalPoint.y * 100}%`,
                        }}
                        title={`Điểm lấy nét khuôn mặt: ${Math.round(focalPoint.x * 100)}%, ${Math.round(focalPoint.y * 100)}%`}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Extracted Palette Swatches */}
              <div className="border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                    <Palette className="h-4 w-4 text-burgundy" aria-hidden="true" />
                    Bảng màu hài hòa WCAG AA
                  </div>
                  {palette ? (
                    <label
                      htmlFor="ai-apply-palette"
                      className="flex min-h-[44px] cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-secondary"
                    >
                      <input
                        id="ai-apply-palette"
                        type="checkbox"
                        checked={applyExtractedPalette}
                        onChange={(e) => setApplyExtractedPalette(e.target.checked)}
                        className="h-4 w-4 accent-burgundy"
                      />
                      Áp dụng màu này
                    </label>
                  ) : null}
                </div>

                {palette ? (
                  <div className="mt-4 space-y-2.5">
                    {(
                      [
                        { key: "primary", label: "Màu chủ đạo" },
                        { key: "secondary", label: "Nền phụ / Blush" },
                        { key: "accent", label: "Điểm nhấn" },
                        { key: "background", label: "Nền giấy" },
                        { key: "text", label: "Chữ chính" },
                      ] as const
                    ).map((item) => (
                      <div key={item.key} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-5 w-5 rounded-full border border-border"
                            style={{ backgroundColor: palette[item.key] }}
                          />
                          <span className="text-ink-secondary">{item.label}</span>
                        </div>
                        <span className="font-mono text-xs font-semibold tabular-nums text-ink">
                          {palette[item.key]}
                        </span>
                      </div>
                    ))}
                    {focalPoint ? (
                      <p className="mt-2 border-t border-border pt-2 text-xs tabular-nums text-ink-muted">
                        Điểm canh chân dung: X={Math.round(focalPoint.x * 100)}%, Y=
                        {Math.round(focalPoint.y * 100)}%
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-6 text-center text-xs text-ink-muted">
                    Tải lên 1 tấm ảnh cưới để xem bảng màu 5 sắc độ tự động trích xuất từ ảnh.
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Step 2: Couple Details & Tone */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-burgundy text-xs font-bold tabular-nums text-ivory">
                  2
                </span>
                <h2 className="font-serif text-xl font-bold text-ink">
                  Thông tin cặp đôi &amp; Văn phong lời mời
                </h2>
              </div>

              {profiles.length > 0 ? (
                <select
                  value={selectedProfileId}
                  aria-label="Điền nhanh từ Hồ sơ cưới"
                  onChange={(e) => handleApplyProfile(e.target.value)}
                  className={`min-h-[44px] rounded-xl border border-border-strong bg-surface px-3 text-xs font-medium text-ink ${FOCUS_RING}`}
                >
                  <option value="">-- Điền từ Hồ sơ cưới --</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ai-groom-name" className="block text-xs font-semibold text-ink">
                  Tên Chú rể *
                </label>
                <input
                  id="ai-groom-name"
                  type="text"
                  required
                  maxLength={80}
                  value={groomName}
                  onChange={(e) => setGroomName(e.target.value)}
                  placeholder="Gia Huy"
                  className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                />
              </div>
              <div>
                <label htmlFor="ai-bride-name" className="block text-xs font-semibold text-ink">
                  Tên Cô dâu *
                </label>
                <input
                  id="ai-bride-name"
                  type="text"
                  required
                  maxLength={80}
                  value={brideName}
                  onChange={(e) => setBrideName(e.target.value)}
                  placeholder="Minh Anh"
                  className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                />
              </div>
              <div>
                <label htmlFor="ai-wedding-date" className="block text-xs font-semibold text-ink">
                  Ngày cưới dự kiến
                </label>
                <input
                  id="ai-wedding-date"
                  type="text"
                  maxLength={40}
                  value={weddingDate}
                  onChange={(e) => setWeddingDate(e.target.value)}
                  placeholder="20/12/2026"
                  className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm tabular-nums text-ink ${FOCUS_RING}`}
                />
              </div>
              <div>
                <label htmlFor="ai-venue-name" className="block text-xs font-semibold text-ink">
                  Địa điểm tổ chức
                </label>
                <input
                  id="ai-venue-name"
                  type="text"
                  maxLength={120}
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="White Palace Hoàng Văn Thụ"
                  className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                />
              </div>
            </div>

            <div className="mt-3">
              <label htmlFor="ai-meeting-story" className="block text-xs font-semibold text-ink">
                Kỷ niệm ngắn của hai bạn (để AI viết câu chuyện tình yêu)
              </label>
              <textarea
                id="ai-meeting-story"
                rows={3}
                maxLength={500}
                value={meetingStory}
                onChange={(e) => setMeetingStory(e.target.value)}
                placeholder="VD: Quen nhau từ một buổi chiều mưa ở quán cà phê Đà Lạt năm 2022, cùng nhau đi qua 4 mùa thu..."
                className={`mt-1 w-full rounded-xl border border-border-strong bg-surface p-3 text-sm text-ink ${FOCUS_RING}`}
              />
            </div>

            <div className="mt-4">
              <p id="ai-tone-label" className="text-xs font-semibold text-ink">
                Chọn văn phong
              </p>
              <div
                role="group"
                aria-labelledby="ai-tone-label"
                className="mt-2 grid gap-2.5 sm:grid-cols-3"
              >
                {TONE_OPTIONS.map((item) => {
                  const active = tone === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setTone(item.value)}
                      className={`min-h-[44px] rounded-xl border p-3 text-left transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${FOCUS_RING} ${
                        active
                          ? "border-2 border-burgundy bg-blush-hover"
                          : "border-border bg-surface hover:bg-ivory"
                      }`}
                    >
                      <p className="text-sm font-bold text-ink">{item.label}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">{item.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Step 3: Pick Template & Run */}
          <Card className="p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-burgundy text-xs font-bold tabular-nums text-ivory">
                3
              </span>
              <h2 className="font-serif text-xl font-bold text-ink">
                Chọn phong cách mẫu &amp; Khởi tạo thiệp
              </h2>
            </div>

            <div className="mt-4 grid gap-2.5 border-t border-border pt-4 sm:grid-cols-2">
              {templates.map((tpl) => {
                const active = templateSlug === tpl.slug;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTemplateSlug(tpl.slug)}
                    className={`flex min-h-[44px] items-center justify-between gap-2 rounded-xl border p-3 text-left transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${FOCUS_RING} ${
                      active
                        ? "border-2 border-burgundy bg-blush-hover"
                        : "border-border bg-surface hover:bg-ivory"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-bold text-ink">{tpl.name}</p>
                      <p className="text-xs text-ink-muted">{tpl.description}</p>
                    </div>
                    {active ? (
                      <Check className="h-4 w-4 shrink-0 text-burgundy" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={generating || photoProcessing || currentCredits <= 0}
                onClick={() => void runMagicSetup(false)}
                className="min-h-[44px] motion-reduce:transition-none"
              >
                Chỉ xem trước nội dung AI (1 Credit)
              </Button>
              <Button
                type="button"
                size="lg"
                disabled={generating || photoProcessing || currentCredits <= 0}
                onClick={() => void runMagicSetup(true)}
                className="min-h-[44px] motion-reduce:transition-none"
              >
                <Wand2 className="h-4 w-4" aria-hidden="true" />
                {generating ? "Đang sáng tạo thiệp..." : "Tạo thiệp hoàn chỉnh (1 AI Credit)"}
              </Button>
            </div>
          </Card>

          {/* Generated Copy Preview */}
          {previewCopy ? (
            <Card className="border-2 border-burgundy/30 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="rounded-full bg-amber-surface px-2.5 py-0.5 text-xs font-semibold text-amber-text">
                    {previewCopy.badge}
                  </span>
                  <h3 className="mt-2 font-serif text-2xl font-bold text-ink">
                    {previewCopy.headline}
                  </h3>
                </div>
                {createdInvitationId ? (
                  <Link
                    href={`/editor/${createdInvitationId}`}
                    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-burgundy px-5 text-xs font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark motion-reduce:transition-none ${FOCUS_RING}`}
                  >
                    Mở Studio chỉnh sửa
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>

              <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                {previewCopy.inviteMessage}
              </p>

              <div className="mt-4 divide-y divide-border border-t border-border pt-3">
                <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {previewCopy.storyTitle}
                </p>
                {previewCopy.milestones.map((m, idx) => (
                  <div key={idx} className="py-2.5 last:pb-0">
                    <p className="text-xs font-bold tabular-nums text-burgundy">{m.year}</p>
                    <p className="mt-0.5 text-xs text-ink">{m.caption}</p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        {/* Right: AI Credit Balance & Ledger History */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
              <Sparkles className="h-4 w-4 text-amber-text" aria-hidden="true" />
              Số dư AI Magic Credits
            </div>
            <p className="mt-2 font-serif text-3xl font-bold tabular-nums text-ink">
              {currentCredits} <span className="text-sm font-normal text-ink-muted">lượt</span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
              Mỗi lần tạo nội dung AI Magic Setup tiêu tốn 1 lượt. Gói Pro tặng 15 lượt, Combo tặng 30 lượt.
            </p>
            <Link
              href="/dashboard/billing"
              className={`mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-border-strong bg-surface text-xs font-semibold text-ink transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none ${FOCUS_RING}`}
            >
              Nâng cấp để nhận thêm credits
            </Link>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink">
              <History className="h-4 w-4 text-burgundy" aria-hidden="true" />
              Lịch sử sử dụng AI Credits
            </div>

            {ledger.length === 0 ? (
              <p className="mt-4 text-xs text-ink-muted">Chưa có giao dịch AI Credit nào.</p>
            ) : (
              <div className="mt-3 divide-y divide-border border-t border-border">
                {ledger.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-2 py-2.5 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-ink">
                        {REASON_LABELS[item.reason] ?? item.reason}
                      </p>
                      <p className="text-xs tabular-nums text-ink-muted">
                        {new Date(item.createdAt).toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <span
                        className={`text-xs font-bold ${
                          item.delta >= 0 ? "text-emerald-700" : "text-burgundy"
                        }`}
                      >
                        {item.delta > 0 ? `+${item.delta}` : item.delta}
                      </span>
                      <p className="text-xs text-ink-muted">Còn {item.balanceAfter}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
