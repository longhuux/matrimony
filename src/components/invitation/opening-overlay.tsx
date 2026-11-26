"use client";

import * as React from "react";
import Image from "next/image";
import { Heart, Sparkles } from "lucide-react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import type { InvitationDocumentV2 } from "@/modules/invitation-engine/schema";

export interface OpeningOverlayProps {
  mode: InvitationDocumentV2["theme"]["effects"]["opening"];
  coupleNames: string;
  subtitle?: string;
  coverPhotoUrl?: string;
  palette: InvitationDocumentV2["theme"]["palette"];
  previewMode?: boolean;
  onOpen?: () => void;
}

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
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function OpeningOverlay({
  mode,
  coupleNames,
  subtitle,
  coverPhotoUrl,
  palette,
  previewMode = false,
  onOpen,
}: OpeningOverlayProps): React.ReactElement | null {
  const [phase, setPhase] = React.useState<"closed" | "opening" | "done">(
    mode === "none" ? "done" : "closed",
  );
  const dialogRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (mode === "none") {
      setPhase("done");
    } else {
      setPhase("closed");
    }
  }, [mode]);

  const handleSkip = React.useCallback((): void => {
    setPhase("done");
    onOpen?.();
  }, [onOpen]);

  useDialogFocus(mode !== "none" && phase !== "done", dialogRef, {
    onClose: handleSkip,
    lockScroll: !previewMode,
    disabled: previewMode,
  });

  if (mode === "none" || phase === "done") {
    return null;
  }

  const handleOpen = (): void => {
    if (phase !== "closed") return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPhase("done");
      onOpen?.();
      return;
    }
    setPhase("opening");
    window.setTimeout(() => {
      setPhase("done");
      onOpen?.();
    }, 520);
  };

  const isOpening = phase === "opening";
  const isDark = relativeLuminance(palette.background) < 0.35;
  const cardBg = isDark ? "rgba(22, 16, 14, 0.88)" : "rgba(255, 252, 249, 0.90)";
  const cardText = isDark ? "#FFFCF9" : "#231B18";
  const cardMuted = isDark ? "#D9C5B7" : "#5A4B44";
  const labelAccent = isDark
    ? "#E6C280"
    : contrastRatio(palette.accent, palette.background) >= 4.8
      ? palette.accent
      : "#7C531E";
  const ctaBg = isDark
    ? palette.primary
    : contrastRatio("#FFFFFF", palette.primary) >= 4.5
      ? palette.primary
      : "#8B2635";
  const ctaFg = contrastRatio("#FFFFFF", ctaBg) >= 4.5 ? "#FFFFFF" : "#16100E";

  const containerPositionClass = previewMode
    ? "absolute inset-0 z-30"
    : "fixed inset-0 z-50";

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className={`${containerPositionClass} flex items-center justify-center overflow-hidden outline-none transition-opacity duration-500 motion-reduce:transition-none ${
        isOpening ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{
        backgroundColor: palette.background,
        color: cardText,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Mở thiệp cưới"
    >
      {/* Dimmed couple portrait behind frosted paper */}
      {coverPhotoUrl ? (
        <div
          className="absolute inset-0 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{
            transform: isOpening ? "scale(1.04)" : "scale(1)",
          }}
        >
          <Image
            src={coverPhotoUrl}
            alt=""
            aria-hidden="true"
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-35"
            style={{ objectPosition: "50% 25%" }}
          />
          <div
            className="absolute inset-0 backdrop-blur-md"
            style={{
              backgroundColor: isDark
                ? "rgba(22, 16, 14, 0.65)"
                : "rgba(255, 252, 249, 0.72)",
            }}
          />
        </div>
      ) : null}

      {/* Split / Curtain / Door animated panels */}
      {(mode === "curtain" || mode === "door") && (
        <>
          <div
            className="absolute inset-y-0 left-0 w-1/2 border-r transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{
              backgroundColor: mode === "door" ? palette.primary : palette.secondary,
              borderColor: palette.accent,
              opacity: mode === "door" ? 0.92 : 0.85,
              transform: isOpening ? "translateX(-100%)" : "translateX(0%)",
            }}
          />
          <div
            className="absolute inset-y-0 right-0 w-1/2 border-l transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{
              backgroundColor: mode === "door" ? palette.primary : palette.secondary,
              borderColor: palette.accent,
              opacity: mode === "door" ? 0.92 : 0.85,
              transform: isOpening ? "translateX(100%)" : "translateX(0%)",
            }}
          />
        </>
      )}

      <button
        type="button"
        onClick={handleSkip}
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-20 inline-flex min-h-[44px] cursor-pointer items-center rounded-full border px-4 text-xs font-semibold backdrop-blur-md transition-opacity duration-200 hover:opacity-85"
        style={{
          backgroundColor: isDark ? "rgba(35, 27, 24, 0.88)" : "rgba(255, 253, 251, 0.92)",
          borderColor: isDark ? "rgba(230, 194, 128, 0.35)" : "#EADBD1",
          color: cardText,
        }}
      >
        Xem ngay
      </button>

      {/* Center tactile cotton stationery seal */}
      <div
        className={`relative z-10 mx-5 w-full max-w-md rounded-2xl border px-7 py-10 text-center shadow-[var(--shadow-elevated)] backdrop-blur-md transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:px-10 sm:py-12 ${
          isOpening ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
        style={{
          backgroundColor: cardBg,
          borderColor: palette.accent,
          color: cardText,
        }}
      >
        <div
          className="mx-auto max-w-xs border px-5 py-7"
          style={{
            borderColor: isDark ? "rgba(230, 194, 128, 0.25)" : "rgba(200, 157, 102, 0.35)",
          }}
        >
          <p
            className="text-xs font-medium"
            style={{ color: labelAccent }}
          >
            Thiệp báo hỷ
          </p>

          <h2
            className="mt-3 font-serif text-3xl font-bold leading-[1.2] tracking-[-0.015em] text-balance sm:text-4xl"
            style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
          >
            {coupleNames || "Ngày Chung Đôi"}
          </h2>

          {subtitle ? (
            <p className="mt-3 text-sm font-medium" style={{ color: cardMuted }}>
              {subtitle}
            </p>
          ) : null}

          <div
            className="mx-auto mt-5 h-px w-12"
            style={{ backgroundColor: palette.accent }}
          />
        </div>

        <div className="mt-7 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2.5 rounded-full px-8 text-sm font-semibold shadow-sm transition-transform duration-200 hover:scale-[1.02] motion-reduce:transition-none"
            style={{ backgroundColor: ctaBg, color: ctaFg }}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-current/25">
              {mode === "door" ? (
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Heart className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </span>
            Chạm để mở thiệp
          </button>
        </div>
      </div>
    </div>
  );
}
