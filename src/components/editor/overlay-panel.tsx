"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Image as ImageIcon,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImageToWebP } from "@/modules/ai/client-vision";
import type {
  FreeOverlayElement,
  InvitationDocumentV2,
} from "@/modules/invitation-engine/schema";

export interface OverlayPanelProps {
  invitationId: string;
  doc: InvitationDocumentV2;
  onUpdateDoc: (updater: (draft: InvitationDocumentV2) => void) => void;
}

const STICKER_PRESETS = ["♥", "✦", "❀", "囍", "✿", "❖"] as const;

const FONT_SIZE_OPTIONS = [
  { label: "Nhỏ (14px)", value: "0.875rem" },
  { label: "Vừa (16px)", value: "1rem" },
  { label: "Lớn (20px)", value: "1.25rem" },
  { label: "Nổi bật (24px)", value: "1.5rem" },
  { label: "Tiêu đề (32px)", value: "2rem" },
] as const;

function createElementId(kind: FreeOverlayElement["kind"]): string {
  const rand = Math.random().toString(36).slice(2, 7);
  return `ov_${kind}_${Date.now().toString(36)}_${rand}`;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function OverlayKindIcon({
  kind,
}: {
  kind: FreeOverlayElement["kind"];
}): React.ReactElement {
  if (kind === "text") {
    return <Type className="h-3.5 w-3.5" aria-hidden="true" />;
  }
  if (kind === "sticker") {
    return <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />;
  }
  return <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />;
}

export function OverlayPanel({
  invitationId,
  doc,
  onUpdateDoc,
}: OverlayPanelProps): React.ReactElement {
  const [selectedId, setSelectedId] = React.useState<string | null>(
    doc.freeElements[0]?.id ?? null,
  );
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const selectedElement = React.useMemo(
    () => doc.freeElements.find((el) => el.id === selectedId) ?? null,
    [doc.freeElements, selectedId],
  );

  const addOverlay = (kind: FreeOverlayElement["kind"], photoUrl?: string): void => {
    const id = createElementId(kind);
    const maxZ = doc.freeElements.reduce((acc, el) => Math.max(acc, el.zIndex), 10);
    const nextZ = Math.min(100, maxZ + 1);

    const newItem: FreeOverlayElement =
      kind === "text"
        ? {
            id,
            kind: "text",
            xPercent: 50,
            yPercent: 22,
            widthPercent: 60,
            rotation: 0,
            zIndex: nextZ,
            props: {
              text: "Save The Date",
              color: doc.theme.palette.primary,
              fontSize: "1.25rem",
            },
          }
        : kind === "sticker"
          ? {
              id,
              kind: "sticker",
              xPercent: 82,
              yPercent: 18,
              widthPercent: 16,
              rotation: 0,
              zIndex: nextZ,
              props: {
                label: "♥",
              },
            }
          : {
              id,
              kind: "photo",
              xPercent: 50,
              yPercent: 30,
              widthPercent: 35,
              rotation: -4,
              zIndex: nextZ,
              props: {
                url: photoUrl ?? "",
                alt: "Ảnh trang trí",
              },
            };

    onUpdateDoc((draft) => {
      if (draft.freeElements.length >= 50) return;
      draft.freeElements.push(newItem);
    });
    setSelectedId(id);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingPhoto(true);
    setUploadError(null);
    try {
      const compressed = await compressImageToWebP(file, {
        maxDimension: 1200,
        quality: 0.84,
      });

      const presignRes = await fetch("/api/media/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "image",
          mimeType: compressed.mimeType,
          sizeBytes: compressed.blob.size,
          invitationId,
        }),
      });
      const presignData = (await presignRes.json().catch(() => ({}))) as {
        uploadUrl?: string;
        publicUrl?: string;
        error?: string;
      };
      if (!presignRes.ok || !presignData.uploadUrl || !presignData.publicUrl) {
        throw new Error(presignData.error || "Không thể khởi tạo đường dẫn tải ảnh.");
      }

      const uploadRes = await fetch(presignData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": compressed.mimeType },
        body: compressed.blob,
      });
      if (!uploadRes.ok) {
        throw new Error("Tải ảnh lớp phủ lên thất bại.");
      }

      if (selectedElement && selectedElement.kind === "photo") {
        onUpdateDoc((draft) => {
          const target = draft.freeElements.find((el) => el.id === selectedElement.id);
          if (target) {
            target.props.url = presignData.publicUrl;
          }
        });
      } else {
        addOverlay("photo", presignData.publicUrl);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Không thể tải ảnh lên.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const updateSelected = (
    updater: (el: FreeOverlayElement) => void,
  ): void => {
    if (!selectedId) return;
    onUpdateDoc((draft) => {
      const target = draft.freeElements.find((el) => el.id === selectedId);
      if (target) updater(target);
    });
  };

  const moveOverlay = (index: number, direction: -1 | 1): void => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= doc.freeElements.length) return;
    onUpdateDoc((draft) => {
      const [moved] = draft.freeElements.splice(index, 1);
      draft.freeElements.splice(targetIdx, 0, moved);
    });
  };

  const removeOverlay = (id: string): void => {
    onUpdateDoc((draft) => {
      draft.freeElements = draft.freeElements.filter((el) => el.id !== id);
    });
    if (selectedId === id) {
      const remaining = doc.freeElements.filter((el) => el.id !== id);
      setSelectedId(remaining[0]?.id ?? null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-amber-surface/60 p-3.5">
        <div className="flex items-start gap-2.5">
          <Layers className="mt-0.5 h-4 w-4 shrink-0 text-amber-text" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-ink-secondary">
            Thêm chữ trang trí, biểu tượng hoặc ảnh nổi theo tọa độ phần trăm (%) trên toàn bộ thiệp mà không làm lệch bố cục di động.
          </p>
        </div>
      </div>

      {/* Quick add buttons */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={doc.freeElements.length >= 50}
          onClick={() => addOverlay("text")}
          className="min-h-[40px] w-full"
        >
          <Type className="h-3.5 w-3.5" aria-hidden="true" />
          Thêm chữ
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={doc.freeElements.length >= 50}
          onClick={() => addOverlay("sticker")}
          className="min-h-[40px] w-full"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Sticker
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={doc.freeElements.length >= 50 || uploadingPhoto}
          onClick={() => fileInputRef.current?.click()}
          className="min-h-[40px] w-full"
        >
          <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {uploadingPhoto ? "Đang tải..." : "Ảnh nổi"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          aria-label="Chọn tệp ảnh nổi để tải lên"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(e) => void handlePhotoUpload(e)}
          className="hidden"
        />
      </div>

      {uploadError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800"
        >
          {uploadError}
        </p>
      ) : null}

      {/* Overlay layers list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted tabular-nums">
            Danh sách lớp phủ ({doc.freeElements.length}/50)
          </h3>
          <button
            type="button"
            onClick={() => addOverlay("photo", "")}
            disabled={doc.freeElements.length >= 50}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2 text-xs font-semibold text-burgundy hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy disabled:opacity-40 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Ảnh từ URL
          </button>
        </div>

        {doc.freeElements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-5 text-center text-xs text-ink-muted">
            Chưa có lớp phủ nào. Bấm một nút ở trên để thêm chữ, sticker hoặc ảnh nổi.
          </div>
        ) : (
          <div className="space-y-2">
            {doc.freeElements.map((el, idx) => {
              const active = el.id === selectedId;
              const summary =
                el.kind === "text"
                  ? asString(el.props.text, "Chữ trang trí")
                  : el.kind === "sticker"
                    ? `Sticker ${asString(el.props.label, "♥")}`
                    : asString(el.props.alt, "Ảnh trang trí");

              return (
                <div
                  key={el.id}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition-colors duration-200 motion-reduce:transition-none ${
                    active
                      ? "border-burgundy bg-blush-hover"
                      : "border-border bg-surface hover:bg-ivory"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(el.id)}
                    aria-pressed={active}
                    className="flex min-h-[36px] min-w-0 flex-1 items-center gap-2 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blush text-burgundy">
                      <OverlayKindIcon kind={el.kind} />
                    </span>
                    <span className="truncate text-xs font-semibold text-ink">
                      {summary}
                    </span>
                    <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                      z:{el.zIndex}
                    </span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveOverlay(idx, -1)}
                      disabled={idx === 0}
                      aria-label="Đưa lớp phủ lên trước"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy disabled:opacity-35 cursor-pointer"
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveOverlay(idx, 1)}
                      disabled={idx === doc.freeElements.length - 1}
                      aria-label="Đưa lớp phủ xuống sau"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy disabled:opacity-35 cursor-pointer"
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeOverlay(el.id)}
                      aria-label="Xóa lớp phủ"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-burgundy hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected overlay inspector */}
      {selectedElement ? (
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <h4 className="font-serif text-base font-bold text-ink">
            Tinh chỉnh lớp phủ đang chọn
          </h4>

          {selectedElement.kind === "text" ? (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="overlay-text-input"
                  className="mb-1 block text-xs font-semibold text-ink-secondary"
                >
                  Nội dung chữ
                </label>
                <input
                  id="overlay-text-input"
                  type="text"
                  maxLength={120}
                  value={asString(selectedElement.props.text)}
                  onChange={(e) =>
                    updateSelected((el) => {
                      el.props.text = e.target.value;
                    })
                  }
                  className="h-10 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="overlay-color-input"
                    className="mb-1 block text-xs font-semibold text-ink-secondary"
                  >
                    Màu chữ
                  </label>
                  <div className="flex h-10 items-center gap-2 rounded-xl border border-border-strong bg-surface px-2.5">
                    <input
                      id="overlay-color-input"
                      type="color"
                      value={asString(selectedElement.props.color, doc.theme.palette.primary)}
                      onChange={(e) =>
                        updateSelected((el) => {
                          el.props.color = e.target.value;
                        })
                      }
                      className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <span className="font-mono text-xs text-ink-secondary tabular-nums">
                      {asString(selectedElement.props.color, doc.theme.palette.primary)}
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="overlay-fontsize-select"
                    className="mb-1 block text-xs font-semibold text-ink-secondary"
                  >
                    Cỡ chữ
                  </label>
                  <select
                    id="overlay-fontsize-select"
                    value={asString(selectedElement.props.fontSize, "1rem")}
                    onChange={(e) =>
                      updateSelected((el) => {
                        el.props.fontSize = e.target.value;
                      })
                    }
                    className="h-10 w-full rounded-xl border border-border-strong bg-surface px-2.5 text-xs font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
                  >
                    {FONT_SIZE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : null}

          {selectedElement.kind === "sticker" ? (
            <div className="space-y-3">
              <fieldset className="space-y-2">
                <legend className="block text-xs font-semibold text-ink-secondary">
                  Chọn biểu tượng nhanh
                </legend>
                <div className="flex flex-wrap gap-2">
                  {STICKER_PRESETS.map((symbol) => {
                    const active = asString(selectedElement.props.label, "♥") === symbol;
                    return (
                      <button
                        key={symbol}
                        type="button"
                        aria-label={`Chọn biểu tượng ${symbol}`}
                        aria-pressed={active}
                        onClick={() =>
                          updateSelected((el) => {
                            el.props.label = symbol;
                          })
                        }
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border text-base transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer motion-reduce:transition-none ${
                          active
                            ? "border-burgundy bg-blush text-burgundy"
                            : "border-border bg-surface text-ink hover:bg-blush-hover"
                        }`}
                      >
                        {symbol}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <div>
                <label
                  htmlFor="overlay-sticker-custom"
                  className="mb-1 block text-xs font-semibold text-ink-secondary"
                >
                  Hoặc nhập ký tự tùy chỉnh
                </label>
                <input
                  id="overlay-sticker-custom"
                  type="text"
                  maxLength={12}
                  value={asString(selectedElement.props.label, "♥")}
                  onChange={(e) =>
                    updateSelected((el) => {
                      el.props.label = e.target.value;
                    })
                  }
                  className="h-10 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
                />
              </div>
            </div>
          ) : null}

          {selectedElement.kind === "photo" ? (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="overlay-photo-url"
                  className="mb-1 block text-xs font-semibold text-ink-secondary"
                >
                  Đường dẫn ảnh
                </label>
                <div className="flex gap-2">
                  <input
                    id="overlay-photo-url"
                    type="text"
                    value={asString(selectedElement.props.url)}
                    onChange={(e) =>
                      updateSelected((el) => {
                        el.props.url = e.target.value;
                      })
                    }
                    placeholder="/api/media/local/... hoặc https://..."
                    className="h-10 flex-1 rounded-xl border border-border-strong bg-surface px-3 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={uploadingPhoto}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    Tải ảnh
                  </Button>
                </div>
              </div>
              <div>
                <label
                  htmlFor="overlay-photo-alt"
                  className="mb-1 block text-xs font-semibold text-ink-secondary"
                >
                  Mô tả ảnh (Alt)
                </label>
                <input
                  id="overlay-photo-alt"
                  type="text"
                  maxLength={80}
                  value={asString(selectedElement.props.alt)}
                  onChange={(e) =>
                    updateSelected((el) => {
                      el.props.alt = e.target.value;
                    })
                  }
                  className="h-10 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
                />
              </div>
            </div>
          ) : null}

          {/* Geometry sliders */}
          <div className="grid grid-cols-1 gap-3 border-t border-border pt-3">
            <div>
              <label
                htmlFor="overlay-x-range"
                className="mb-1 flex justify-between text-xs font-semibold text-ink-secondary"
              >
                <span>Vị trí ngang (X)</span>
                <span className="tabular-nums">{selectedElement.xPercent}%</span>
              </label>
              <input
                id="overlay-x-range"
                type="range"
                min={0}
                max={100}
                step={1}
                value={selectedElement.xPercent}
                onChange={(e) =>
                  updateSelected((el) => {
                    el.xPercent = Number(e.target.value);
                  })
                }
                className="w-full accent-burgundy"
              />
            </div>

            <div>
              <label
                htmlFor="overlay-y-range"
                className="mb-1 flex justify-between text-xs font-semibold text-ink-secondary"
              >
                <span>Vị trí dọc (Y)</span>
                <span className="tabular-nums">{selectedElement.yPercent}%</span>
              </label>
              <input
                id="overlay-y-range"
                type="range"
                min={0}
                max={100}
                step={1}
                value={selectedElement.yPercent}
                onChange={(e) =>
                  updateSelected((el) => {
                    el.yPercent = Number(e.target.value);
                  })
                }
                className="w-full accent-burgundy"
              />
            </div>

            <div>
              <label
                htmlFor="overlay-width-range"
                className="mb-1 flex justify-between text-xs font-semibold text-ink-secondary"
              >
                <span>Chiều rộng</span>
                <span className="tabular-nums">{selectedElement.widthPercent}%</span>
              </label>
              <input
                id="overlay-width-range"
                type="range"
                min={5}
                max={100}
                step={1}
                value={selectedElement.widthPercent}
                onChange={(e) =>
                  updateSelected((el) => {
                    el.widthPercent = Number(e.target.value);
                  })
                }
                className="w-full accent-burgundy"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="overlay-rotation-range"
                  className="mb-1 flex justify-between text-xs font-semibold text-ink-secondary"
                >
                  <span>Góc xoay</span>
                  <span className="tabular-nums">{selectedElement.rotation}°</span>
                </label>
                <input
                  id="overlay-rotation-range"
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={selectedElement.rotation}
                  onChange={(e) =>
                    updateSelected((el) => {
                      el.rotation = Number(e.target.value);
                    })
                  }
                  className="w-full accent-burgundy"
                />
              </div>

              <div>
                <label
                  htmlFor="overlay-zindex-range"
                  className="mb-1 flex justify-between text-xs font-semibold text-ink-secondary"
                >
                  <span>Thứ tự lớp (Z)</span>
                  <span className="tabular-nums">{selectedElement.zIndex}</span>
                </label>
                <input
                  id="overlay-zindex-range"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={selectedElement.zIndex}
                  onChange={(e) =>
                    updateSelected((el) => {
                      el.zIndex = Number(e.target.value);
                    })
                  }
                  className="w-full accent-burgundy"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
