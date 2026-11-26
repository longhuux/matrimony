"use client";

import * as React from "react";
import Link from "next/link";
import {
  Camera,
  CheckCircle2,
  Heart,
  ImagePlus,
  Loader2,
  Send,
  Sparkles,
  Ticket,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { compressImageToWebP } from "@/modules/ai/client-vision";

export interface CheckinClientProps {
  slug: string;
  invitationTitle: string;
  coupleHeadline: string;
  stageCode: string;
  autoApprove: boolean;
  isLimitReached: boolean;
}

interface CheckinSuccessState {
  id: string;
  ticketNumber: string;
  status: "pending" | "approved" | "rejected";
  guestName: string;
  message: string;
  publicUrl: string | null;
}

function uploadPhotoWithProgress(
  slug: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<{ photoKey: string; publicUrl: string | null }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/led/${encodeURIComponent(slug)}/checkin/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const pct = Math.min(95, Math.max(10, Math.round((event.loaded / event.total) * 100)));
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText || "{}") as {
          photoKey?: string;
          publicUrl?: string | null;
          error?: string;
        };
        if (xhr.status >= 200 && xhr.status < 300 && parsed.photoKey) {
          onProgress(100);
          resolve({ photoKey: parsed.photoKey, publicUrl: parsed.publicUrl ?? null });
        } else {
          reject(new Error(parsed.error || "Không thể tải ảnh lên. Vui lòng thử lại."));
        }
      } catch {
        reject(new Error("Phản hồi tải ảnh không hợp lệ."));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Mất kết nối khi tải ảnh lên. Vui lòng kiểm tra mạng."));
    };

    xhr.send(formData);
  });
}

export function CheckinClient({
  slug,
  invitationTitle,
  coupleHeadline,
  stageCode,
  autoApprove,
  isLimitReached,
}: CheckinClientProps): React.ReactElement {
  const [guestName, setGuestName] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [phaseLabel, setPhaseLabel] = React.useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState<number>(0);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successData, setSuccessData] = React.useState<CheckinSuccessState | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrorMsg(null);
  };

  const clearSelectedFile = (): void => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const trimmedName = guestName.trim();
    const trimmedMsg = message.trim();

    if (!trimmedName) {
      setErrorMsg("Vui lòng nhập tên của bạn để hiển thị trên màn hình LED.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setUploadProgress(0);

    try {
      let uploadedPhotoKey: string | null = null;
      let uploadedPublicUrl: string | null = null;

      if (selectedFile) {
        setPhaseLabel("Đang tối ưu ảnh WebP...");
        setUploadProgress(8);
        const compressed = await compressImageToWebP(selectedFile, {
          maxDimension: 1200,
          maxBytes: 1_500_000,
        });
        const ext = compressed.mimeType === "image/png" ? "png" : compressed.mimeType === "image/jpeg" ? "jpg" : "webp";
        const compressedFile = new File([compressed.blob], `checkin.${ext}`, {
          type: compressed.mimeType,
        });

        setPhaseLabel("Đang tải ảnh lên sảnh tiệc...");
        const uploaded = await uploadPhotoWithProgress(slug, compressedFile, (pct) => {
          setUploadProgress(pct);
        });
        uploadedPhotoKey = uploaded.photoKey;
        uploadedPublicUrl = uploaded.publicUrl;
      }

      setPhaseLabel("Đang gửi lời chúc lên sân khấu...");
      const res = await fetch(`/api/led/${encodeURIComponent(slug)}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: trimmedName,
          message: trimmedMsg,
          photoKey: uploadedPhotoKey,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        ticketNumber?: string;
        status?: "pending" | "approved" | "rejected";
        publicUrl?: string | null;
        error?: string;
      };

      if (!res.ok || !data.id || !data.ticketNumber) {
        throw new Error(data.error || "Không thể gửi check-in lúc này. Vui lòng thử lại.");
      }

      setSuccessData({
        id: data.id,
        ticketNumber: data.ticketNumber,
        status: data.status ?? "pending",
        guestName: trimmedName,
        message: trimmedMsg,
        publicUrl: data.publicUrl ?? uploadedPublicUrl,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
      setPhaseLabel(null);
    }
  };

  const resetForAnother = (): void => {
    setSuccessData(null);
    setMessage("");
    clearSelectedFile();
    setErrorMsg(null);
    setUploadProgress(0);
  };

  return (
    <div className="min-h-dvh bg-ivory px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-ink sm:pt-10">
      <a
        href="#checkin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-burgundy focus:px-4 focus:py-2.5 focus:text-xs focus:font-semibold focus:text-ivory focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2"
      >
        Chuyển đến nội dung chính
      </a>

      <div className="mx-auto max-w-lg">
        {/* Editorial Banquet Header */}
        <header className="mb-6 text-center">
          <span className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-border bg-amber-surface px-3.5 py-1 text-xs font-semibold text-amber-text">
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Check-in LED,</span>
            <span className="whitespace-nowrap font-mono tabular-nums">{stageCode}</span>
          </span>
          <h1 className="mt-3 font-serif text-3xl font-bold leading-tight text-ink sm:text-4xl">
            {coupleHeadline}
          </h1>
          <p className="mt-1.5 text-sm text-ink-secondary">
            Gửi ảnh kỷ niệm và lời chúc chung vui lên màn hình sảnh tiệc
          </p>
        </header>

        <main id="checkin-main">
          {isLimitReached && !successData ? (
            <Card className="p-6 text-center sm:p-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-surface text-amber-text">
                <Ticket className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 font-serif text-xl font-bold text-ink">
                Sảnh tiệc đã đạt số lượt check-in tối đa
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                Phiên LED của {invitationTitle} đã nhận đủ lượt check-in của gói hiện tại. Quý
                khách vẫn có thể gửi lời chúc trên thiệp cưới điện tử.
              </p>
              <div className="mt-6">
                <Link
                  href={`/s/${encodeURIComponent(slug)}`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-burgundy px-6 text-sm font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 motion-reduce:transition-none"
                >
                  <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
                  Gửi lời chúc trên thiệp cưới
                </Link>
              </div>
            </Card>
          ) : successData ? (
            <Card className="overflow-hidden border-gold/60 p-6 text-center sm:p-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-surface text-amber-text">
                <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
              </div>

              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Check-in thành công
              </p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-ink">
                Cảm ơn {successData.guestName}!
              </h2>

              {/* Lucky Draw Ticket */}
              <div className="mt-5 rounded-2xl border-2 border-gold bg-amber-surface px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-text">
                  Mã số Lucky Draw của bạn
                </p>
                <p className="mt-1.5 font-serif text-4xl font-bold tracking-wider tabular-nums text-burgundy">
                  {successData.ticketNumber}
                </p>
                <p className="mt-2 text-xs text-ink-secondary">
                  Hãy giữ lại mã số này để tham gia phần quay số trúng thưởng cùng cô dâu &amp; chú
                  rể!
                </p>
              </div>

              {/* Approval Status Banner */}
              <div
                role="status"
                aria-live="polite"
                className={`mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold ${
                  successData.status === "approved"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-border bg-blush text-burgundy"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {successData.status === "approved"
                  ? "Đã hiển thị ngay trên màn hình LED"
                  : "Đang chờ MC duyệt trong giây lát"}
              </div>

              {successData.publicUrl ? (
                <div className="mt-5 overflow-hidden rounded-xl border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={successData.publicUrl}
                    alt={`Ảnh check-in của ${successData.guestName}`}
                    decoding="async"
                    className="max-h-64 w-full object-cover"
                  />
                </div>
              ) : null}

              {successData.message ? (
                <p className="mt-4 rounded-xl border border-border bg-ivory px-4 py-3 text-sm italic text-ink-secondary">
                  &ldquo;{successData.message}&rdquo;
                </p>
              ) : null}

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
                <Button type="button" variant="secondary" onClick={resetForAnother}>
                  Gửi thêm lời chúc khác
                </Button>
                <Link
                  href={`/s/${encodeURIComponent(slug)}`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border-strong bg-surface px-6 text-sm font-medium text-ink transition-colors duration-200 hover:bg-blush-hover focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 motion-reduce:transition-none"
                >
                  Xem thiệp cưới
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="p-5 sm:p-7">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="checkin-guest-name"
                    className="block text-xs font-semibold text-ink-secondary"
                  >
                    Tên của bạn <span className="text-burgundy">*</span>
                  </label>
                  <input
                    id="checkin-guest-name"
                    type="text"
                    required
                    autoComplete="name"
                    maxLength={60}
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Ví dụ: Anh Hoàng Nam (Bạn chú rể)"
                    disabled={submitting}
                    className="mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink placeholder:text-ink-muted focus-visible:border-burgundy focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 disabled:opacity-60"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="checkin-message"
                      className="block text-xs font-semibold text-ink-secondary"
                    >
                      Lời chúc gửi cô dâu chú rể
                    </label>
                    <span className="text-xs tabular-nums text-ink-muted">
                      {message.length}/220
                    </span>
                  </div>
                  <textarea
                    id="checkin-message"
                    rows={3}
                    maxLength={220}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Chúc hai bạn trăm năm hạnh phúc, luôn rạng rỡ và bình an..."
                    disabled={submitting}
                    className="mt-1.5 min-h-[88px] w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus-visible:border-burgundy focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 disabled:opacity-60"
                  />
                </div>

                <div>
                  <span className="block text-xs font-semibold text-ink-secondary">
                    Ảnh kỷ niệm tại sảnh tiệc (tùy chọn)
                  </span>

                  <input
                    ref={fileInputRef}
                    id="checkin-photo-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    disabled={submitting}
                    className="sr-only"
                  />

                  {previewUrl ? (
                    <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-ivory p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Ảnh xem trước"
                        decoding="async"
                        className="max-h-60 w-full rounded-xl object-cover"
                      />
                      <div className="mt-2 flex items-center justify-between gap-2 px-1">
                        <span className="truncate text-xs text-ink-muted">
                          {selectedFile?.name || "Ảnh đã chọn"}
                        </span>
                        <button
                          type="button"
                          onClick={clearSelectedFile}
                          disabled={submitting}
                          className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1 rounded-full px-3 text-xs font-medium text-burgundy transition-colors duration-200 hover:bg-blush focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 motion-reduce:transition-none"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Xóa ảnh
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      htmlFor="checkin-photo-input"
                      className="mt-2 flex min-h-[132px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-strong bg-blush/45 px-4 py-6 text-center transition-colors duration-200 hover:bg-blush-hover focus-within:outline-2 focus-within:outline-burgundy focus-within:outline-offset-2 motion-reduce:transition-none"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-burgundy shadow-sm">
                        <Camera className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="text-sm font-semibold text-ink">
                        Chụp ảnh hoặc chọn từ thư viện
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                        <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                        Ảnh tự động nén WebP siêu nhẹ để bay lên LED tức thì
                      </span>
                    </label>
                  )}
                </div>

                {submitting && phaseLabel ? (
                  <div className="rounded-xl border border-border bg-amber-surface p-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-amber-text">
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                        {phaseLabel}
                      </span>
                      {selectedFile ? (
                        <span className="tabular-nums">{uploadProgress}%</span>
                      ) : null}
                    </div>
                    {selectedFile ? (
                      <div
                        role="progressbar"
                        aria-valuenow={uploadProgress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border"
                      >
                        <div
                          className="h-full rounded-full bg-burgundy transition-[width] duration-200 motion-reduce:transition-none"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {errorMsg ? (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-900"
                  >
                    {errorMsg}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  className="min-h-[48px] w-full px-6 py-3"
                >
                  {submitting ? (
                    <>
                      <Loader2
                        className="h-4 w-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                      Đang gửi check-in...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Gửi ảnh &amp; lời chúc lên LED
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-ink-muted">
                  {autoApprove
                    ? "Chế độ tự động duyệt đang bật — lời chúc hợp lệ sẽ hiện ngay trên màn hình LED."
                    : "Ảnh & lời chúc sẽ được MC kiểm duyệt nhanh trước khi chiếu lên màn hình lớn."}
                </p>
              </form>
            </Card>
          )}
        </main>

        <footer className="mt-6 text-center text-xs text-ink-muted">
          <Link
            href={`/s/${encodeURIComponent(slug)}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 font-medium text-burgundy hover:underline focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2"
          >
            <Heart className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            Xem thiệp cưới {invitationTitle}
          </Link>
        </footer>
      </div>
    </div>
  );
}
