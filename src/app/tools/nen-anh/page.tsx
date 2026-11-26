"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Heart,
  ImageDown,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { Card } from "@/components/ui/card";

const FOCUS_RING_CLASS =
  "focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2";

type TargetFormat = "image/webp" | "image/jpeg";
type MaxWidthOption = 1200 | 1600 | 1920;

interface CompressedPhotoItem {
  id: string;
  file: File;
  originalName: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  compressedBlob: Blob;
  compressedUrl: string;
  compressedSize: number;
  compressedWidth: number;
  compressedHeight: number;
  format: TargetFormat;
}

const WIDTH_OPTIONS: readonly { value: MaxWidthOption; label: string; note: string }[] = [
  { value: 1200, label: "1200px", note: "Album Mobile" },
  { value: 1600, label: "1600px", note: "HD Sắc nét" },
  { value: 1920, label: "1920px", note: "Full HD" },
] as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function buildDownloadName(originalName: string, format: TargetFormat): string {
  const baseName = originalName.replace(/\.[^.]+$/, "") || "anh-cuoi";
  const ext = format === "image/webp" ? "webp" : "jpg";
  return `${baseName}-matrimony.${ext}`;
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Không thể đọc tệp ảnh ${file.name}.`));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function compressSingleFile(
  file: File,
  maxWidth: MaxWidthOption,
  qualityPercent: number,
  format: TargetFormat,
): Promise<Omit<CompressedPhotoItem, "id">> {
  const img = await loadImageFromFile(file);
  const scale = img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1;
  const targetWidth = Math.max(1, Math.round(img.naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Trình duyệt không hỗ trợ xử lý ảnh Canvas.");
  }

  if (format === "image/jpeg") {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error(`Không thể nén ảnh ${file.name}.`));
          return;
        }
        resolve(result);
      },
      format,
      qualityPercent / 100,
    );
  });

  const compressedUrl = URL.createObjectURL(blob);
  return {
    file,
    originalName: file.name,
    originalSize: file.size,
    originalWidth: img.naturalWidth,
    originalHeight: img.naturalHeight,
    compressedBlob: blob,
    compressedUrl,
    compressedSize: blob.size,
    compressedWidth: targetWidth,
    compressedHeight: targetHeight,
    format,
  };
}

export default function NenAnhPage(): React.ReactElement {
  const [quality, setQuality] = React.useState<number>(82);
  const [maxWidth, setMaxWidth] = React.useState<MaxWidthOption>(1200);
  const [format, setFormat] = React.useState<TargetFormat>("image/webp");
  const [items, setItems] = React.useState<CompressedPhotoItem[]>([]);
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [errorMsg, setErrorMsg] = React.useState<string>("");

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const itemsRef = React.useRef<CompressedPhotoItem[]>([]);
  itemsRef.current = items;

  React.useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.compressedUrl);
      }
    };
  }, []);

  const handleFiles = async (fileList: FileList | null): Promise<void> => {
    if (!fileList || fileList.length === 0) return;
    const validFiles = Array.from(fileList).filter((file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type),
    );
    if (validFiles.length === 0) {
      setErrorMsg("Vui lòng chọn tệp ảnh định dạng JPG, PNG hoặc WebP.");
      return;
    }

    setErrorMsg("");
    setIsProcessing(true);

    try {
      const processed: CompressedPhotoItem[] = [];
      for (const file of validFiles) {
        const result = await compressSingleFile(file, maxWidth, quality, format);
        processed.push({
          ...result,
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        });
      }
      setItems((prev) => [...prev, ...processed]);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Đã xảy ra lỗi khi nén ảnh trên trình duyệt.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Re-compress existing items when user adjusts quality, maxWidth, or target format
  React.useEffect(() => {
    if (itemsRef.current.length === 0) return;
    let cancelled = false;

    const recompressAll = async (): Promise<void> => {
      setIsProcessing(true);
      try {
        const current = itemsRef.current;
        const updated: CompressedPhotoItem[] = [];
        for (const item of current) {
          const result = await compressSingleFile(item.file, maxWidth, quality, format);
          if (cancelled) {
            URL.revokeObjectURL(result.compressedUrl);
            return;
          }
          updated.push({ ...result, id: item.id });
        }
        setItems((prev) => {
          for (const oldItem of prev) {
            URL.revokeObjectURL(oldItem.compressedUrl);
          }
          return updated;
        });
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(
            err instanceof Error ? err.message : "Không thể cập nhật cấu hình nén ảnh.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsProcessing(false);
        }
      }
    };

    void recompressAll();
    return () => {
      cancelled = true;
    };
  }, [quality, maxWidth, format]);

  const handleRemoveItem = (id: string): void => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.compressedUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleClearAll = (): void => {
    setItems((prev) => {
      for (const item of prev) {
        URL.revokeObjectURL(item.compressedUrl);
      }
      return [];
    });
    setErrorMsg("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const totals = React.useMemo(() => {
    const orig = items.reduce((acc, item) => acc + item.originalSize, 0);
    const comp = items.reduce((acc, item) => acc + item.compressedSize, 0);
    const savedPct = orig > 0 ? Math.round(((orig - comp) / orig) * 100) : 0;
    return { orig, comp, savedPct };
  }, [items]);

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
            className={`flex min-w-0 shrink-0 items-center gap-2 rounded-full py-1 sm:gap-2.5 ${FOCUS_RING_CLASS}`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-burgundy text-ivory">
              <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
            </span>
            <span className="font-serif text-lg font-bold tracking-tight text-ink sm:text-xl">
              Matrimony
            </span>
          </Link>

          <nav
            aria-label="Công cụ cưới hỏi"
            className="hidden items-center gap-6 text-sm font-medium text-ink-secondary md:flex"
          >
            <Link
              href="/tools/nen-anh"
              aria-current="page"
              className={`inline-flex min-h-[44px] items-center rounded-md px-1.5 font-semibold text-burgundy transition-colors duration-200 motion-reduce:transition-none ${FOCUS_RING_CLASS}`}
            >
              Nén ảnh cưới
            </Link>
            <Link
              href="/tools/tao-qr-mung-cuoi"
              className={`inline-flex min-h-[44px] items-center rounded-md px-1.5 transition-colors duration-200 motion-reduce:transition-none hover:text-burgundy ${FOCUS_RING_CLASS}`}
            >
              Tạo QR bàn tiệc
            </Link>
            <Link
              href="/tools/xem-ngay-cuoi"
              className={`inline-flex min-h-[44px] items-center rounded-md px-1.5 transition-colors duration-200 motion-reduce:transition-none hover:text-burgundy ${FOCUS_RING_CLASS}`}
            >
              Xem ngày cưới
            </Link>
          </nav>

          <Link
            href="/login"
            className={`inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-full bg-burgundy px-4 text-xs font-semibold text-ivory transition-colors duration-200 motion-reduce:transition-none hover:bg-burgundy-dark sm:px-5 sm:text-sm ${FOCUS_RING_CLASS}`}
          >
            Tạo thiệp miễn phí
          </Link>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto max-w-6xl px-4 py-10 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-12 sm:pb-[calc(4rem+env(safe-area-inset-bottom))]"
      >
        <div className="mb-8">
          <Link
            href="/"
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full pr-2 text-sm font-medium text-ink-muted transition-colors duration-200 motion-reduce:transition-none hover:text-burgundy ${FOCUS_RING_CLASS}`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Về trang chủ</span>
          </Link>
          <h1 className="mt-2 min-w-0 break-words font-serif text-3xl font-bold tracking-[-0.02em] text-ink sm:text-4xl">
            Nén ảnh cưới &amp; Chuyển đổi WebP miễn phí
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-secondary">
            Giảm dung lượng ảnh studio trước khi tải lên thiệp cưới hoặc gửi qua Zalo để khách mở thiệp nhanh trên mạng di động.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-amber-surface px-4 py-1.5 text-xs font-semibold text-amber-text">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Ảnh xử lý 100% ngay trên trình duyệt của bạn, không tải lên máy chủ</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Controls Panel */}
          <Card className="h-fit p-6 lg:col-span-4">
            <h2 className="font-serif text-xl font-bold text-ink">Tùy chọn nén ảnh</h2>

            <div className="mt-5 space-y-6">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <label htmlFor="quality-range" className="font-semibold text-ink">
                    Chất lượng ảnh
                  </label>
                  <span className="font-semibold tabular-nums text-burgundy">{quality}%</span>
                </div>
                <input
                  id="quality-range"
                  type="range"
                  min={50}
                  max={95}
                  step={5}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className={`mt-3 h-2 w-full cursor-pointer accent-burgundy ${FOCUS_RING_CLASS}`}
                />
                <div className="mt-2 flex justify-between text-xs tabular-nums text-ink-muted">
                  <span>50% (Nhẹ nhất)</span>
                  <span>95% (Giữ chi tiết)</span>
                </div>
              </div>

              <fieldset className="border-t border-border pt-5">
                <legend className="text-sm font-semibold text-ink">Chiều rộng tối đa</legend>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {WIDTH_OPTIONS.map((opt) => {
                    const active = maxWidth === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setMaxWidth(opt.value)}
                        className={`flex min-h-[44px] cursor-pointer flex-col items-center justify-center rounded-xl border px-2 py-2.5 text-center transition-colors duration-200 motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
                          active
                            ? "border-burgundy bg-blush text-burgundy"
                            : "border-border-strong bg-ivory text-ink hover:bg-blush-hover"
                        }`}
                      >
                        <span className="text-xs font-bold tabular-nums">{opt.label}</span>
                        <span className="mt-0.5 text-xs text-ink-muted">{opt.note}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="border-t border-border pt-5">
                <legend className="text-sm font-semibold text-ink">Định dạng đầu ra</legend>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {[
                    { value: "image/webp" as const, label: "WebP (Khuyên dùng)" },
                    { value: "image/jpeg" as const, label: "JPEG" },
                  ].map((opt) => {
                    const active = format === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setFormat(opt.value)}
                        className={`h-11 min-h-[44px] cursor-pointer rounded-xl border px-3 text-xs font-semibold transition-colors duration-200 motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
                          active
                            ? "border-burgundy bg-burgundy text-ivory"
                            : "border-border-strong bg-ivory text-ink hover:bg-blush-hover"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </Card>

          {/* Upload & Results Column */}
          <div className="space-y-6 lg:col-span-8">
            {/* Single-layer dropzone surface (no outer nested card) */}
            <section aria-label="Tải ảnh lên để nén">
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  void handleFiles(event.dataTransfer.files);
                }}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center shadow-[var(--shadow-card)] transition-colors duration-200 motion-reduce:transition-none ${
                  isDragging ? "border-burgundy bg-blush/60" : "border-border-strong bg-surface"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blush text-burgundy">
                  <ImageDown className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="mt-4 font-serif text-lg font-semibold text-ink">
                  Kéo thả nhiều ảnh cưới vào đây
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  Hỗ trợ JPG, PNG, WebP, giữ nguyên tỷ lệ khung hình
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(event) => void handleFiles(event.target.files)}
                  className="sr-only"
                  id="photo-compressor-input"
                />
                <label
                  htmlFor="photo-compressor-input"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  className={`mt-5 inline-flex h-11 min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-burgundy px-6 text-sm font-semibold text-ivory transition-colors duration-200 motion-reduce:transition-none hover:bg-burgundy-dark ${FOCUS_RING_CLASS}`}
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  <span>{isProcessing ? "Đang xử lý ảnh..." : "Chọn ảnh từ máy"}</span>
                </label>
              </div>

              {errorMsg ? (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
                >
                  {errorMsg}
                </p>
              ) : null}
            </section>

            {items.length > 0 ? (
              <Card className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-ink">
                      Kết quả nén (<span className="tabular-nums">{items.length}</span> ảnh)
                    </h2>
                    <p className="mt-0.5 text-sm tabular-nums text-ink-secondary">
                      Tổng dung lượng: {formatBytes(totals.orig)} →{" "}
                      <strong className="text-burgundy">{formatBytes(totals.comp)}</strong>{" "}
                      {totals.savedPct > 0 ? `(Tiết kiệm ${totals.savedPct}%)` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className={`inline-flex h-11 min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border border-border-strong bg-ivory px-4 text-xs font-semibold text-ink transition-colors duration-200 motion-reduce:transition-none hover:bg-blush-hover ${FOCUS_RING_CLASS}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Xóa tất cả</span>
                  </button>
                </div>

                <ul className="mt-4 divide-y divide-border">
                  {items.map((item) => {
                    const saved =
                      item.originalSize > 0
                        ? Math.round(
                            ((item.originalSize - item.compressedSize) / item.originalSize) * 100,
                          )
                        : 0;
                    const downloadName = buildDownloadName(item.originalName, item.format);
                    return (
                      <li
                        key={item.id}
                        className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-center gap-3.5">
                          {/* eslint-disable-next-line @next/next/no-img-element -- Dynamic blob: preview for user-uploaded photo */}
                          <img
                            src={item.compressedUrl}
                            alt={`Ảnh đã nén ${item.originalName}`}
                            width={64}
                            height={64}
                            decoding="async"
                            className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">
                              {item.originalName}
                            </p>
                            <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
                              {item.originalWidth}×{item.originalHeight}px → {item.compressedWidth}×
                              {item.compressedHeight}px
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs tabular-nums">
                              <span className="text-ink-secondary">
                                {formatBytes(item.originalSize)} →{" "}
                                <strong className="text-ink">
                                  {formatBytes(item.compressedSize)}
                                </strong>
                              </span>
                              <span className="rounded-full border border-border bg-amber-surface px-2.5 py-0.5 font-semibold text-amber-text">
                                {saved > 0 ? `Giảm ${saved}%` : "Đã tối ưu"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <a
                            href={item.compressedUrl}
                            download={downloadName}
                            className={`inline-flex h-11 min-h-[44px] items-center gap-1.5 rounded-full bg-burgundy px-4 text-xs font-semibold text-ivory transition-colors duration-200 motion-reduce:transition-none hover:bg-burgundy-dark ${FOCUS_RING_CLASS}`}
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Tải xuống</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            aria-label={`Xóa ảnh ${item.originalName}`}
                            className={`inline-flex h-11 w-11 min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full border border-border-strong bg-ivory text-ink-muted transition-colors duration-200 motion-reduce:transition-none hover:bg-blush-hover hover:text-burgundy ${FOCUS_RING_CLASS}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
