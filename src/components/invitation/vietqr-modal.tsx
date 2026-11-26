"use client";

import * as React from "react";
import Image from "next/image";
import { Check, Copy, Download, Gift, X } from "lucide-react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { formatVnd } from "@/lib/utils";
import type { InvitationDocumentV2 } from "@/modules/invitation-engine/schema";
import { buildVietQrPayload } from "@/modules/vietqr";
import { renderQrDataUrl } from "@/modules/vietqr/qr-render";

export interface VietQrBankAccount {
  side: "groom" | "bride";
  bankBin: string;
  bankShortName: string;
  accountNumber: string;
  accountHolder: string;
}

export interface VietQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  bankAccounts: VietQrBankAccount[];
  initialSide?: "groom" | "bride";
  coupleNames?: string;
  palette: InvitationDocumentV2["theme"]["palette"];
}

const PRESET_AMOUNTS = [500_000, 1_000_000, 2_000_000];

function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 1;
  const toLinear = (c: number): number =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const r = toLinear(parseInt(clean.slice(0, 2), 16) / 255);
  const g = toLinear(parseInt(clean.slice(2, 4), 16) / 255);
  const b = toLinear(parseInt(clean.slice(4, 6), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA: string, hexB: string): number {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function VietQrModal({
  isOpen,
  onClose,
  bankAccounts,
  initialSide = "groom",
  coupleNames = "Cô dâu & Chú rể",
  palette,
}: VietQrModalProps): React.ReactElement | null {
  const [selectedSide, setSelectedSide] = React.useState<"groom" | "bride">(initialSide);
  const [amountInput, setAmountInput] = React.useState<string>("");
  const [noteInput, setNoteInput] = React.useState<string>(`Mung cuoi ${coupleNames}`);
  const [qrDataUrl, setQrDataUrl] = React.useState<string>("");
  const [qrError, setQrError] = React.useState<string>("");
  const [copied, setCopied] = React.useState(false);
  const modalPanelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedSide(initialSide);
      setCopied(false);
    }
  }, [isOpen, initialSide]);

  useDialogFocus(isOpen, modalPanelRef, { onClose });

  const activeAccount = React.useMemo(() => {
    if (bankAccounts.length === 0) return null;
    return (
      bankAccounts.find((acc) => acc.side === selectedSide) ?? bankAccounts[0]
    );
  }, [bankAccounts, selectedSide]);

  React.useEffect(() => {
    if (!isOpen || !activeAccount) return;
    let cancelled = false;

    const generateQr = async (): Promise<void> => {
      try {
        const cleanedDigits = amountInput.replace(/[^0-9]/g, "");
        const parsedAmount = cleanedDigits ? Number(cleanedDigits) : undefined;
        const validAmount =
          parsedAmount && Number.isInteger(parsedAmount) && parsedAmount > 0
            ? Math.min(parsedAmount, 999_999_999_999)
            : undefined;

        const payload = buildVietQrPayload({
          bankBin: activeAccount.bankBin,
          accountNumber: activeAccount.accountNumber,
          amount: validAmount,
          description: noteInput.trim() || `Mung cuoi ${coupleNames}`,
        });
        const dataUrl = await renderQrDataUrl(payload, 320);
        if (!cancelled) {
          setQrDataUrl(dataUrl);
          setQrError("");
        }
      } catch (err) {
        if (!cancelled) {
          setQrDataUrl("");
          setQrError(
            err instanceof Error
              ? err.message
              : "Không thể tạo mã VietQR cho tài khoản này.",
          );
        }
      }
    };

    void generateQr();
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeAccount, amountInput, noteInput, coupleNames]);

  if (!isOpen) return null;

  const ctaBg = palette.primary;
  const ctaFg = contrastRatio("#FFFFFF", ctaBg) >= 4.5 ? "#FFFFFF" : "#16100E";
  const accountCodeInk =
    contrastRatio(palette.primary, "#FFFCF9") >= 4.8 ? palette.primary : "#8B2635";

  const handleCopyAccount = async (): Promise<void> => {
    if (!activeAccount) return;
    try {
      await navigator.clipboard.writeText(activeAccount.accountNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vietqr-modal-title"
      onClick={onClose}
    >
      <div
        ref={modalPanelRef}
        tabIndex={-1}
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-ivory p-6 text-ink shadow-[var(--shadow-elevated)] outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng hộp mừng cưới"
          className="absolute right-4 top-4 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-ink-secondary transition-colors duration-200 hover:bg-blush"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-3 pr-10">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: ctaBg, color: ctaFg }}
          >
            <Gift className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h3
              id="vietqr-modal-title"
              className="font-serif text-xl font-bold text-ink"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              Hộp mừng cưới VietQR
            </h3>
            <p className="text-xs text-ink-muted">
              Chuyển khoản trực tiếp qua ứng dụng ngân hàng
            </p>
          </div>
        </div>

        {/* Dual-side tabs */}
        {bankAccounts.length > 1 && (
          <div
            className="mt-5 grid grid-cols-2 gap-1.5 rounded-full border border-border bg-blush p-1"
            role="tablist"
            aria-label="Chọn gia đình nhận mừng cưới"
          >
            {(["groom", "bride"] as const).map((side) => {
              const hasAccount = bankAccounts.some((acc) => acc.side === side);
              if (!hasAccount) return null;
              const active = selectedSide === side;
              return (
                <button
                  key={side}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedSide(side)}
                  className="min-h-[44px] cursor-pointer rounded-full px-3 text-xs font-semibold transition-colors duration-200"
                  style={{
                    backgroundColor: active ? ctaBg : "transparent",
                    color: active ? ctaFg : "#231B18",
                  }}
                >
                  {side === "groom" ? "Mừng nhà trai" : "Mừng nhà gái"}
                </button>
              );
            })}
          </div>
        )}

        {activeAccount ? (
          <div className="mt-5 space-y-5">
            {/* Scannable VietQR block (single-layer, hairline bounded) */}
            <div className="flex flex-col items-center border-y border-border py-5">
              {qrDataUrl ? (
                <Image
                  src={qrDataUrl}
                  alt={`Mã VietQR ${activeAccount.bankShortName} - ${activeAccount.accountHolder}`}
                  width={208}
                  height={208}
                  unoptimized
                  className="h-52 w-52 rounded-xl bg-white p-2 object-contain"
                />
              ) : (
                <div className="flex h-52 w-52 items-center justify-center rounded-xl bg-blush px-4 text-center text-xs text-ink-muted">
                  {qrError || "Đang tạo mã VietQR..."}
                </div>
              )}

              <div className="mt-3.5 text-center">
                <p className="text-xs font-medium text-ink-muted">
                  {activeAccount.bankShortName} —{" "}
                  {activeAccount.side === "groom" ? "Nhà trai" : "Nhà gái"}
                </p>
                <p className="mt-1 text-sm font-bold text-ink">
                  {activeAccount.accountHolder}
                </p>
                <p
                  className="mt-0.5 font-mono text-sm font-semibold tabular-nums"
                  style={{ color: accountCodeInk }}
                >
                  {activeAccount.accountNumber}
                </p>
              </div>
            </div>

            {/* Optional gift amount presets & note */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {PRESET_AMOUNTS.map((preset) => {
                  const isSelected = amountInput === preset.toString();
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmountInput(preset.toString())}
                      className="min-h-[36px] cursor-pointer rounded-full border px-3.5 text-xs font-medium tabular-nums transition-colors duration-200"
                      style={{
                        borderColor: isSelected ? ctaBg : "#D9C5B7",
                        backgroundColor: isSelected ? ctaBg : "#FFFDFB",
                        color: isSelected ? ctaFg : "#231B18",
                      }}
                    >
                      {formatVnd(preset)}
                    </button>
                  );
                })}
                {amountInput ? (
                  <button
                    type="button"
                    onClick={() => setAmountInput("")}
                    className="min-h-[36px] cursor-pointer rounded-full border border-border-strong bg-blush px-3.5 text-xs font-medium text-ink-secondary transition-colors duration-200 hover:bg-blush-hover"
                  >
                    Xóa số tiền
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Số tiền (VNĐ, tùy chọn)"
                  aria-label="Số tiền mừng cưới (VNĐ)"
                  className="h-11 rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-muted"
                />
                <input
                  type="text"
                  maxLength={50}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Lời nhắn chuyển khoản"
                  aria-label="Lời nhắn chuyển khoản"
                  className="h-11 rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-muted"
                />
              </div>
            </div>

            {/* Primary Actions */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => void handleCopyAccount()}
                className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-xs font-semibold text-ink transition-colors duration-200 hover:bg-blush-hover"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                    Đã sao chép
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    Sao chép STK
                  </>
                )}
              </button>

              {qrDataUrl ? (
                <a
                  href={qrDataUrl}
                  download={`vietqr-${activeAccount.bankShortName.toLowerCase()}-${activeAccount.accountNumber}.png`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold transition-opacity duration-200 hover:opacity-90"
                  style={{ backgroundColor: ctaBg, color: ctaFg }}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Tải ảnh QR
                </a>
              ) : (
                <span className="inline-flex h-11 items-center justify-center rounded-full bg-border px-4 text-xs font-semibold text-ink-muted">
                  Tải ảnh QR
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-6 border-t border-border pt-5 text-center text-sm text-ink-muted">
            Cô dâu &amp; chú rể chưa cập nhật thông tin tài khoản ngân hàng.
          </p>
        )}
      </div>
    </div>
  );
}
