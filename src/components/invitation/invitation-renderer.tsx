"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gift,
  Heart,
  Image as ImageIcon,
  MapPin,
  MessageSquareHeart,
  Send,
  Users,
  X,
} from "lucide-react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import type {
  FreeOverlayElement,
  InvitationDocumentV2,
  InvitationSection,
} from "@/modules/invitation-engine/schema";
import { buildWeddingIcs } from "@/modules/invitation-engine/ics";
import { OpeningOverlay } from "./opening-overlay";
import { ParticlesLayer } from "./particles-layer";
import { MusicController } from "./music-controller";
import { VietQrModal, type VietQrBankAccount } from "./vietqr-modal";

export interface InvitationWishItem {
  id: string;
  senderName: string;
  content: string;
  createdAt?: string | Date;
}

export interface InvitationGuestContext {
  inviteCode: string;
  fullName: string;
  salutation?: string;
  greeting?: string;
  rsvpStatus?: string;
}

export interface InvitationRendererProps {
  doc: InvitationDocumentV2;
  slug: string;
  guest?: InvitationGuestContext;
  initialWishes?: InvitationWishItem[];
  showWatermark?: boolean;
  interactive?: boolean;
  previewMode?: boolean;
}

export interface ContrastSafeColors {
  isDark: boolean;
  bg: string;
  surface: string;
  secondary: string;
  text: string;
  muted: string;
  primary: string;
  primaryFg: string;
  primaryInk: string;
  accent: string;
  accentText: string;
  border: string;
  inputBg: string;
  inputBorder: string;
}

interface NormalizedEventItem {
  id: string;
  title: string;
  date: string;
  formattedDate: string;
  time: string;
  welcomeTime: string;
  venueName: string;
  venueAddress: string;
  venueMapUrl: string;
  lunarDate: string;
  canChiDay: string;
}

interface NormalizedPhotoItem {
  url: string;
  caption: string;
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function toHex([r, g, b]: [number, number, number]): string {
  const clamp = (n: number): string =>
    Math.min(255, Math.max(0, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${clamp(r)}${clamp(g)}${clamp(b)}`;
}

function mixHex(hexA: string, hexB: string, weightB: number): string {
  const a = parseHexRgb(hexA);
  const b = parseHexRgb(hexB);
  if (!a || !b) return hexA;
  const w = Math.min(1, Math.max(0, weightB));
  return toHex([
    a[0] * (1 - w) + b[0] * w,
    a[1] * (1 - w) + b[1] * w,
    a[2] * (1 - w) + b[2] * w,
  ]);
}

function relativeLuminance(hex: string): number {
  const rgb = parseHexRgb(hex);
  if (!rgb) return 1;
  const toLinear = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * toLinear(rgb[0]) +
    0.7152 * toLinear(rgb[1]) +
    0.0722 * toLinear(rgb[2])
  );
}

export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function ensureMinContrast(
  candidate: string,
  targetBgA: string,
  targetBgB: string,
  fallbackTarget: string,
  minRatio: number,
): string {
  if (
    contrastRatio(candidate, targetBgA) >= minRatio &&
    contrastRatio(candidate, targetBgB) >= minRatio
  ) {
    return candidate;
  }
  for (let step = 1; step <= 10; step += 1) {
    const mixed = mixHex(candidate, fallbackTarget, step / 10);
    if (
      contrastRatio(mixed, targetBgA) >= minRatio &&
      contrastRatio(mixed, targetBgB) >= minRatio
    ) {
      return mixed;
    }
  }
  return fallbackTarget;
}

/**
 * Resolves WCAG 2.1 AA contrast-safe palette tokens for any template palette.
 * Keeps raw `palette.accent` strictly for 1px decorative hairlines while ensuring
 * muted ink (`>= 4.8:1`) and accent text (`>= 4.8:1`) remain legible on every ground.
 */
export function getContrastSafeColors(
  palette: InvitationDocumentV2["theme"]["palette"],
): ContrastSafeColors {
  const isDark = relativeLuminance(palette.background) < 0.35;
  const bg = palette.background;
  const secondary = palette.secondary;

  const surface = isDark
    ? mixHex(bg, "#FFFFFF", 0.05)
    : bg.toUpperCase() === "#FFFFFF"
      ? "#FAF8F5"
      : mixHex(bg, "#FFFDFB", 0.55);

  const safeFallbackText = isDark ? "#FFFCF9" : "#231B18";
  const text =
    contrastRatio(palette.text, bg) >= 7.0 &&
    contrastRatio(palette.text, secondary) >= 6.0
      ? palette.text
      : safeFallbackText;

  const mutedBase = isDark ? "#D9C5B7" : "#6B5B53";
  const muted = ensureMinContrast(mutedBase, bg, secondary, text, 4.8);

  let accentText: string;
  if (isDark) {
    accentText = ensureMinContrast(palette.accent, bg, secondary, "#E6C280", 4.8);
  } else if (
    contrastRatio(palette.accent, bg) >= 4.5 &&
    contrastRatio(palette.accent, secondary) >= 4.5
  ) {
    accentText = palette.accent;
  } else {
    const warmAmber = "#7C531E";
    accentText =
      contrastRatio(warmAmber, bg) >= 4.8 &&
      contrastRatio(warmAmber, secondary) >= 4.5
        ? warmAmber
        : ensureMinContrast(palette.accent, bg, secondary, text, 4.8);
  }

  const primary = palette.primary;
  const primaryFg =
    contrastRatio("#FFFFFF", primary) >= 4.5 ? "#FFFFFF" : "#16100E";
  const primaryInk = ensureMinContrast(primary, bg, secondary, text, 4.5);

  const border = isDark
    ? mixHex(bg, palette.accent, 0.24)
    : mixHex(bg, text, 0.13);

  const inputBg = isDark
    ? mixHex(bg, "#FFFFFF", 0.06)
    : mixHex(bg, "#FFFDFB", 0.72);
  const inputBorder = isDark
    ? mixHex(bg, palette.accent, 0.34)
    : mixHex(bg, text, 0.24);

  return {
    isDark,
    bg,
    surface,
    secondary,
    text,
    muted,
    primary,
    primaryFg,
    primaryInk,
    accent: palette.accent,
    accentText,
    border,
    inputBg,
    inputBorder,
  };
}

function isSafeHttpUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isSafeMediaUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  return isSafeHttpUrl(trimmed);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function parseIsoFromDisplayDate(rawDate: string): string {
  const trimmed = rawDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const vn = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (vn) return `${vn[3]}-${vn[2]}-${vn[1]}`;
  return "";
}

function computeCountdown(isoDate: string, time = "11:00"): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
} {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false };
  }
  const [y, m, d] = isoDate.split("-").map(Number);
  const tMatch = /^(\d{1,2}):(\d{2})/.exec(time);
  const hh = tMatch ? Number(tMatch[1]) : 11;
  const mm = tMatch ? Number(tMatch[2]) : 0;
  // Interpret in UTC+7 (Asia/Ho_Chi_Minh)
  const targetMs = Date.UTC(y, m - 1, d, hh - 7, mm, 0);
  const diff = targetMs - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds, isPast: false };
}

function normalizeEvents(data: Record<string, unknown>): NormalizedEventItem[] {
  if (Array.isArray(data.events) && data.events.length > 0) {
    const out: NormalizedEventItem[] = [];
    for (let i = 0; i < data.events.length; i += 1) {
      const item = data.events[i];
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const rawDate = asString(obj.date);
      const formattedDate =
        asString(obj.formattedDate) ||
        (rawDate ? rawDate.split("-").reverse().join("/") : "");
      out.push({
        id: asString(obj.id, `ev_${i}`),
        title: asString(obj.title, "Lễ Cưới"),
        date: rawDate || parseIsoFromDisplayDate(formattedDate),
        formattedDate,
        time: asString(obj.time, "11:00"),
        welcomeTime: asString(obj.welcomeTime),
        venueName: asString(obj.venueName),
        venueAddress: asString(obj.venueAddress),
        venueMapUrl: asString(obj.venueMapUrl),
        lunarDate: asString(obj.lunarDate),
        canChiDay: asString(obj.canChiDay),
      });
    }
    if (out.length > 0) return out;
  }

  const eventTitle = asString(data.eventTitle);
  const eventDate = asString(data.eventDate);
  const eventIsoDate = asString(data.eventIsoDate) || parseIsoFromDisplayDate(eventDate);
  const venueName = asString(data.venueName) || asString(data.venue);
  if (!eventTitle && !eventDate && !venueName) return [];

  return [
    {
      id: "ev_primary",
      title: eventTitle || "Lễ Thành Hôn",
      date: eventIsoDate,
      formattedDate: eventDate || eventIsoDate.split("-").reverse().join("/"),
      time: asString(data.eventTime, "11:00"),
      welcomeTime: asString(data.welcomeTime),
      venueName,
      venueAddress: asString(data.venueAddress),
      venueMapUrl: asString(data.venueMapLink),
      lunarDate: asString(data.eventDateLunar),
      canChiDay: asString(data.eventCanChiDay),
    },
  ];
}

function normalizePhotos(data: Record<string, unknown>): NormalizedPhotoItem[] {
  if (!Array.isArray(data.photos)) return [];
  const items: NormalizedPhotoItem[] = [];
  for (const raw of data.photos) {
    if (typeof raw === "string" && isSafeMediaUrl(raw)) {
      items.push({ url: raw.trim(), caption: "" });
    } else if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      if (isSafeMediaUrl(obj.url)) {
        items.push({
          url: obj.url.trim(),
          caption: asString(obj.caption),
        });
      }
    }
  }
  return items;
}

function normalizeBankAccounts(data: Record<string, unknown>): VietQrBankAccount[] {
  if (!Array.isArray(data.bankAccounts)) return [];
  const list: VietQrBankAccount[] = [];
  for (const raw of data.bankAccounts) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const side = obj.side === "bride" ? "bride" : "groom";
    const bankBin = asString(obj.bankBin);
    const bankShortName = asString(obj.bankShortName);
    const accountNumber = asString(obj.accountNumber);
    const accountHolder = asString(obj.accountHolder);
    if (bankBin && accountNumber && accountHolder) {
      list.push({
        side,
        bankBin,
        bankShortName: bankShortName || "BANK",
        accountNumber,
        accountHolder,
      });
    }
  }
  return list;
}

function renderBalancedCoupleHeadline(
  headline: string,
  ampersandColor: string,
): React.ReactElement {
  const parts = headline.split(/\s+&\s+/);
  if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
    return (
      <h1
        className="mt-3 font-serif text-[2.25rem] font-bold leading-[1.15] tracking-[-0.02em] text-balance sm:text-5xl"
        style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
      >
        <span className="block sm:inline">{parts[0].trim()}</span>
        <span
          className="my-1 block text-[1.5rem] font-normal italic sm:mx-3 sm:my-0 sm:inline sm:text-[2.25rem]"
          style={{ color: ampersandColor }}
        >
          &amp;
        </span>
        <span className="block sm:inline">{parts[1].trim()}</span>
      </h1>
    );
  }

  return (
    <h1
      className="mt-3 font-serif text-[2.25rem] font-bold leading-[1.15] tracking-[-0.02em] text-balance sm:text-5xl"
      style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
    >
      {headline}
    </h1>
  );
}

export function InvitationRenderer({
  doc,
  slug,
  guest,
  initialWishes = [],
  showWatermark = false,
  interactive = true,
  previewMode = false,
}: InvitationRendererProps): React.ReactElement {
  const { palette, effects, music } = doc.theme;
  const colors = React.useMemo(() => getContrastSafeColors(palette), [palette]);

  const visibleSections = React.useMemo(
    () =>
      [...doc.sections]
        .filter((sec) => sec.visible)
        .sort((a, b) => a.order - b.order),
    [doc.sections],
  );

  const heroSection = visibleSections.find((s) => s.type === "hero");
  const coupleNames =
    asString(heroSection?.data.headline) || "Gia Huy & Minh Anh";
  const heroSubtitle = asString(heroSection?.data.subtitle);
  const heroCoverUrl = isSafeMediaUrl(heroSection?.data.coverPhotoUrl)
    ? heroSection.data.coverPhotoUrl
    : isSafeMediaUrl(doc.seo?.coverPhotoUrl)
      ? doc.seo.coverPhotoUrl
      : "";

  const eventsSection = visibleSections.find((s) => s.type === "events_calendar");
  const mainEvents = React.useMemo(
    () => (eventsSection ? normalizeEvents(eventsSection.data) : []),
    [eventsSection],
  );
  const countdownTarget = mainEvents[mainEvents.length - 1] ?? mainEvents[0];
  const [countdown, setCountdown] = React.useState(() =>
    computeCountdown(countdownTarget?.date ?? "", countdownTarget?.time ?? "11:00"),
  );

  React.useEffect(() => {
    if (!countdownTarget?.date) return;
    setCountdown(computeCountdown(countdownTarget.date, countdownTarget.time));
    const timer = window.setInterval(() => {
      setCountdown(computeCountdown(countdownTarget.date, countdownTarget.time));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdownTarget?.date, countdownTarget?.time]);

  // Lightbox state
  const [lightboxPhotos, setLightboxPhotos] = React.useState<NormalizedPhotoItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);
  const lightboxRef = React.useRef<HTMLDivElement | null>(null);

  useDialogFocus(lightboxIndex !== null, lightboxRef, {
    onClose: () => setLightboxIndex(null),
  });

  React.useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "ArrowRight") {
        setLightboxIndex((prev) =>
          prev === null ? null : (prev + 1) % lightboxPhotos.length,
        );
      }
      if (event.key === "ArrowLeft") {
        setLightboxIndex((prev) =>
          prev === null
            ? null
            : (prev - 1 + lightboxPhotos.length) % lightboxPhotos.length,
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxIndex, lightboxPhotos.length]);

  // VietQR Modal state
  const [qrModalOpen, setQrModalOpen] = React.useState(false);
  const [qrModalSide, setQrModalSide] = React.useState<"groom" | "bride">("groom");
  const [qrModalAccounts, setQrModalAccounts] = React.useState<VietQrBankAccount[]>([]);

  // RSVP & Wish state
  const [rsvpFullName, setRsvpFullName] = React.useState(guest?.fullName ?? "");
  const [rsvpStatus, setRsvpStatus] = React.useState<"attending" | "declined">(
    guest?.rsvpStatus === "declined" ? "declined" : "attending",
  );
  const [attendeeCount, setAttendeeCount] = React.useState(1);
  const [guestSide, setGuestSide] = React.useState<"groom" | "bride">("groom");
  const [transportation, setTransportation] = React.useState<"self" | "pickup">("self");
  const [rsvpNote, setRsvpNote] = React.useState("");
  const [rsvpSubmitting, setRsvpSubmitting] = React.useState(false);
  const [rsvpMessage, setRsvpMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [wishList, setWishList] = React.useState<InvitationWishItem[]>(initialWishes);
  const [wishSender, setWishSender] = React.useState(guest?.fullName ?? "");
  const [wishContent, setWishContent] = React.useState("");
  const [wishSubmitting, setWishSubmitting] = React.useState(false);
  const [wishMessage, setWishMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleDownloadIcs = (ev: NormalizedEventItem): void => {
    const icsContent = buildWeddingIcs({
      title: `${ev.title} — ${coupleNames}`,
      date: ev.date || ev.formattedDate,
      time: ev.time,
      venueName: ev.venueName,
      venueAddress: ev.venueAddress,
      description: `Trân trọng kính mời đến chung vui cùng ${coupleNames}.`,
      url: typeof window !== "undefined" ? window.location.href : undefined,
    });
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug || "wedding"}-${ev.id}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleRsvpSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!interactive) {
      setRsvpMessage({
        type: "success",
        text: "Chế độ xem trước Studio: khách mời có thể xác nhận tham dự trực tiếp tại trang thiệp công khai.",
      });
      return;
    }
    if (!rsvpFullName.trim()) {
      setRsvpMessage({ type: "error", text: "Vui lòng nhập họ tên của bạn." });
      return;
    }
    setRsvpSubmitting(true);
    setRsvpMessage(null);
    try {
      const res = await fetch(
        `/api/public/invitations/${encodeURIComponent(slug)}/rsvp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: rsvpFullName.trim(),
            rsvpStatus,
            attendeeCount: rsvpStatus === "declined" ? 1 : attendeeCount,
            guestSide,
            transportation: rsvpStatus === "declined" ? "self" : transportation,
            note: rsvpNote.trim() || undefined,
            inviteCode: guest?.inviteCode,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Không thể gửi xác nhận tham dự.");
      }
      setRsvpMessage({
        type: "success",
        text:
          rsvpStatus === "attending"
            ? "Đã ghi nhận xác nhận tham dự của bạn. Hẹn gặp bạn trong ngày vui!"
            : "Cảm ơn bạn đã phản hồi. Gia đình rất trân trọng tấm lòng của bạn!",
      });
    } catch (err) {
      setRsvpMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại.",
      });
    } finally {
      setRsvpSubmitting(false);
    }
  };

  const handleWishSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!interactive) {
      setWishMessage({
        type: "success",
        text: "Chế độ xem trước Studio: lời chúc sẽ hiển thị tại trang thiệp công khai.",
      });
      return;
    }
    if (!wishSender.trim() || !wishContent.trim()) {
      setWishMessage({
        type: "error",
        text: "Vui lòng nhập tên và lời chúc dành cho cô dâu chú rể.",
      });
      return;
    }
    setWishSubmitting(true);
    setWishMessage(null);
    try {
      const res = await fetch(
        `/api/public/invitations/${encodeURIComponent(slug)}/wishes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderName: wishSender.trim(),
            content: wishContent.trim(),
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        isApproved?: boolean;
        wish?: InvitationWishItem;
      };
      if (!res.ok) {
        throw new Error(data.error || "Không thể gửi lời chúc.");
      }
      if (data.wish && data.isApproved !== false) {
        setWishList((prev) => [data.wish!, ...prev]);
      }
      setWishContent("");
      setWishMessage({
        type: "success",
        text:
          data.isApproved === false
            ? "Lời chúc đã được gửi và đang chờ cô dâu chú rể duyệt."
            : "Cảm ơn lời chúc ngọt ngào của bạn dành cho đôi uyên ương!",
      });
    } catch (err) {
      setWishMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Không thể gửi lời chúc.",
      });
    } finally {
      setWishSubmitting(false);
    }
  };

  const renderHero = (section: InvitationSection): React.ReactElement => {
    const badge = asString(section.data.badge, "Trân trọng báo tin");
    const headline = asString(section.data.headline, coupleNames);
    const subtitle = asString(section.data.subtitle);
    const lunarDate =
      asString(section.data.lunarDate) || countdownTarget?.lunarDate || "";
    const canChiDay =
      asString(section.data.canChiDay) || countdownTarget?.canChiDay || "";
    const objectPosition = asString(section.data.objectPosition, "50% 25%");
    const coverPhotoUrl = isSafeMediaUrl(section.data.coverPhotoUrl)
      ? section.data.coverPhotoUrl
      : heroCoverUrl;
    const isRoyal = section.variant === "royal-frame";

    if (coverPhotoUrl) {
      return (
        <section
          key={section.id}
          className="relative flex min-h-[82svh] w-full flex-col justify-end overflow-hidden border-b"
          style={{ borderColor: colors.border }}
        >
          <Image
            src={coverPhotoUrl}
            alt={headline}
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition }}
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#16100E]/85 via-[#16100E]/30 to-transparent"
            aria-hidden="true"
          />

          {isRoyal ? (
            <div
              className="pointer-events-none absolute inset-4 border sm:inset-6"
              style={{ borderColor: "rgba(230, 194, 128, 0.4)" }}
              aria-hidden="true"
            />
          ) : null}

          <div
            data-enter=""
            className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-12 pt-32 text-center text-[#FFFCF9] sm:px-8 sm:pb-16"
          >
            {isRoyal ? (
              <p className="mb-2 font-serif text-lg text-[#E6C280]" aria-hidden="true">
                囍
              </p>
            ) : null}
            <p className="text-xs font-medium text-[#E6C280]">{badge}</p>
            {renderBalancedCoupleHeadline(headline, "#E6C280")}

            <div
              className="mx-auto mt-5 h-px w-16"
              style={{ backgroundColor: colors.accent }}
              aria-hidden="true"
            />

            {subtitle || lunarDate ? (
              <div className="mt-4 space-y-1 text-sm text-[#FFFCF9]/90 sm:text-base">
                {subtitle ? <p className="font-medium">{subtitle}</p> : null}
                {lunarDate ? (
                  <p className="text-xs text-[#D9C5B7] sm:text-sm">
                    {lunarDate}
                    {canChiDay ? ` (${canChiDay})` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      );
    }

    // Refined cotton stationery paper crest when no cover photo is provided
    return (
      <section
        key={section.id}
        className="relative flex min-h-[70svh] w-full items-center justify-center border-b px-5 py-16 sm:px-8 sm:py-24"
        style={{ backgroundColor: colors.bg, borderColor: colors.border }}
      >
        <div
          data-enter=""
          className="w-full max-w-xl border p-3 sm:p-4"
          style={{ borderColor: colors.border, backgroundColor: colors.surface }}
        >
          <div
            className="border px-6 py-14 text-center sm:px-12 sm:py-16"
            style={{ borderColor: colors.accent }}
          >
            <div
              className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border text-sm font-serif"
              style={{ borderColor: colors.accent, color: colors.primaryInk }}
              aria-hidden="true"
            >
              {isRoyal ? "囍" : <Heart className="h-4 w-4" />}
            </div>
            <p className="text-xs font-medium" style={{ color: colors.accentText }}>
              {badge}
            </p>
            {renderBalancedCoupleHeadline(headline, colors.accentText)}

            <div
              className="mx-auto mt-6 h-px w-16"
              style={{ backgroundColor: colors.accent }}
              aria-hidden="true"
            />

            {subtitle || lunarDate ? (
              <div className="mt-5 space-y-1 text-sm sm:text-base">
                {subtitle ? (
                  <p className="font-medium" style={{ color: colors.text }}>
                    {subtitle}
                  </p>
                ) : null}
                {lunarDate ? (
                  <p className="text-xs sm:text-sm" style={{ color: colors.muted }}>
                    {lunarDate}
                    {canChiDay ? ` (${canChiDay})` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  };

  const renderCouple = (
    section: InvitationSection,
    bandBg: string,
  ): React.ReactElement => {
    const groomName = asString(section.data.groomName, "Chú Rể");
    const groomParents = asString(section.data.groomParents);
    const groomHomeAddress = asString(section.data.groomHomeAddress);
    const groomHomeMapLink = asString(section.data.groomHomeMapLink);

    const brideName = asString(section.data.brideName, "Cô Dâu");
    const brideParents = asString(section.data.brideParents);
    const brideHomeAddress = asString(section.data.brideHomeAddress);
    const brideHomeMapLink = asString(section.data.brideHomeMapLink);

    const families = [
      {
        label: "Nhà trai",
        name: groomName,
        parents: groomParents,
        address: groomHomeAddress,
        mapUrl: groomHomeMapLink,
      },
      {
        label: "Nhà gái",
        name: brideName,
        parents: brideParents,
        address: brideHomeAddress,
        mapUrl: brideHomeMapLink,
      },
    ];

    return (
      <section
        key={section.id}
        className="border-b"
        style={{ backgroundColor: bandBg, borderColor: colors.border }}
      >
        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="text-center">
            <p className="text-xs font-medium" style={{ color: colors.accentText }}>
              Hai gia đình
            </p>
            <h2
              className="mt-1.5 font-serif text-2xl font-bold sm:text-3xl"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              Cô dâu &amp; Chú rể
            </h2>
          </div>

          <div
            className="mt-10 grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0"
            style={{ borderColor: colors.border }}
          >
            {families.map((fam, idx) => (
              <div
                key={fam.label}
                className={`flex flex-col items-center justify-between text-center ${
                  idx === 0
                    ? "pb-8 sm:pb-0 sm:pr-8"
                    : "pt-8 sm:pt-0 sm:pl-8"
                }`}
                style={{ borderColor: colors.border }}
              >
                <div>
                  <p
                    className="text-xs font-semibold"
                    style={{ color: colors.accentText }}
                  >
                    {fam.label}
                  </p>
                  {fam.parents ? (
                    <p
                      className="mx-auto mt-2.5 max-w-[260px] text-xs leading-relaxed sm:max-w-none sm:text-sm"
                      style={{ color: colors.muted }}
                    >
                      {fam.parents}
                    </p>
                  ) : null}
                  <h3
                    className="mt-2.5 font-serif text-2xl font-bold"
                    style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
                  >
                    {fam.name}
                  </h3>
                  {fam.address ? (
                    <p
                      className="mt-2.5 max-w-xs text-xs leading-relaxed sm:text-sm"
                      style={{ color: colors.muted }}
                    >
                      {fam.address}
                    </p>
                  ) : null}
                </div>

                {isSafeHttpUrl(fam.mapUrl) ? (
                  <a
                    href={fam.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold underline decoration-1 underline-offset-4 transition-opacity duration-200 hover:opacity-75"
                    style={{ color: colors.primaryInk }}
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    Chỉ đường
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderLoveStory = (
    section: InvitationSection,
    bandBg: string,
  ): React.ReactElement => {
    const title = asString(section.data.title, "Chuyện chúng mình");
    const rawMilestones = Array.isArray(section.data.milestones)
      ? section.data.milestones
      : [];
    const milestones = rawMilestones
      .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === "object"))
      .map((m) => ({
        year: asString(m.year),
        caption: asString(m.caption),
      }))
      .filter((m) => m.year || m.caption);

    return (
      <section
        key={section.id}
        className="border-b"
        style={{ backgroundColor: bandBg, borderColor: colors.border }}
      >
        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="text-center">
            <p className="text-xs font-medium" style={{ color: colors.accentText }}>
              Hành trình yêu thương
            </p>
            <h2
              className="mt-1.5 font-serif text-2xl font-bold sm:text-3xl"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              {title}
            </h2>
          </div>

          <ol
            className="mx-auto mt-10 max-w-lg space-y-8 border-l pl-6 sm:pl-8"
            style={{ borderColor: colors.border }}
          >
            {milestones.map((item, idx) => (
              <li key={`${item.year}-${idx}`} className="relative">
                <span
                  className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border sm:-left-[37px]"
                  style={{
                    backgroundColor: bandBg,
                    borderColor: colors.accent,
                  }}
                  aria-hidden="true"
                />
                <h3
                  className="font-serif text-lg font-bold sm:text-xl"
                  style={{
                    fontFamily: "var(--font-playfair), Georgia, serif",
                    color: colors.primaryInk,
                  }}
                >
                  {item.year}
                </h3>
                {item.caption ? (
                  <p
                    className="mt-1.5 text-sm leading-relaxed"
                    style={{ color: colors.muted }}
                  >
                    {item.caption}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  };

  const renderEventsCalendar = (
    section: InvitationSection,
    bandBg: string,
  ): React.ReactElement => {
    const events = normalizeEvents(section.data);

    return (
      <section
        key={section.id}
        className="border-b"
        style={{ backgroundColor: bandBg, borderColor: colors.border }}
      >
        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="text-center">
            <p className="text-xs font-medium" style={{ color: colors.accentText }}>
              Thời gian &amp; Địa điểm
            </p>
            <h2
              className="mt-1.5 font-serif text-2xl font-bold sm:text-3xl"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              Lịch trình hôn lễ
            </h2>
          </div>

          {/* Typographic 4-column Countdown separated by 1px vertical hairlines */}
          {countdownTarget?.date ? (
            <div className="mx-auto mt-8 max-w-lg text-center">
              <p className="text-xs font-medium" style={{ color: colors.muted }}>
                {countdown.isPast
                  ? "Ngày vui đã diễn ra — Cảm ơn bạn đã chung vui"
                  : "Đếm ngược tới giờ khai tiệc"}
              </p>
              <div
                className="mt-4 grid grid-cols-4 divide-x border-y py-5"
                style={{
                  borderColor: colors.border,
                }}
              >
                {[
                  { label: "Ngày", value: countdown.days },
                  { label: "Giờ", value: countdown.hours },
                  { label: "Phút", value: countdown.minutes },
                  { label: "Giây", value: countdown.seconds },
                ].map((unit) => (
                  <div
                    key={unit.label}
                    className="px-2"
                    style={{ borderColor: colors.border }}
                  >
                    <div
                      className="font-serif text-3xl font-bold tabular-nums sm:text-4xl"
                      style={{
                        fontFamily: "var(--font-playfair), Georgia, serif",
                        color: colors.primaryInk,
                      }}
                    >
                      {unit.value.toString().padStart(2, "0")}
                    </div>
                    <div
                      className="mt-1 text-xs font-medium"
                      style={{ color: colors.muted }}
                    >
                      {unit.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Ceremony Itinerary List */}
          <div
            className="mt-10 divide-y"
            style={{ borderColor: colors.border }}
          >
            {events.map((ev) => (
              <article
                key={ev.id}
                className="flex flex-col justify-between gap-5 py-7 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                style={{ borderColor: colors.border }}
              >
                <div className="space-y-1.5">
                  <h3
                    className="font-serif text-xl font-bold"
                    style={{
                      fontFamily: "var(--font-playfair), Georgia, serif",
                      color: colors.primaryInk,
                    }}
                  >
                    {ev.title}
                  </h3>

                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Clock
                      className="h-4 w-4 shrink-0"
                      style={{ color: colors.accentText }}
                      aria-hidden="true"
                    />
                    <span>
                      {ev.welcomeTime ? `Đón khách ${ev.welcomeTime} — ` : ""}
                      Khai lễ {ev.time}, {ev.formattedDate}
                    </span>
                  </p>

                  {ev.lunarDate ? (
                    <p className="pl-6 text-xs" style={{ color: colors.muted }}>
                      Âm lịch: {ev.lunarDate}
                      {ev.canChiDay ? ` (${ev.canChiDay})` : ""}
                    </p>
                  ) : null}

                  {ev.venueName || ev.venueAddress ? (
                    <div className="flex items-start gap-2 pt-1 text-sm">
                      <MapPin
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: colors.accentText }}
                        aria-hidden="true"
                      />
                      <div>
                        {ev.venueName ? (
                          <p className="font-semibold">{ev.venueName}</p>
                        ) : null}
                        {ev.venueAddress ? (
                          <p
                            className="text-xs leading-relaxed sm:text-sm"
                            style={{ color: colors.muted }}
                          >
                            {ev.venueAddress}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2.5 sm:flex-col sm:items-end">
                  <button
                    type="button"
                    onClick={() => handleDownloadIcs(ev)}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full px-5 text-xs font-semibold transition-opacity duration-200 hover:opacity-90"
                    style={{
                      backgroundColor: colors.primary,
                      color: colors.primaryFg,
                    }}
                  >
                    <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                    Thêm vào lịch
                  </button>

                  {isSafeHttpUrl(ev.venueMapUrl) ? (
                    <a
                      href={ev.venueMapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center gap-1.5 px-2 text-xs font-semibold underline decoration-1 underline-offset-4 transition-opacity duration-200 hover:opacity-75"
                      style={{ color: colors.primaryInk }}
                    >
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      Xem bản đồ
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderGallery = (
    section: InvitationSection,
    bandBg: string,
  ): React.ReactElement | null => {
    const title = asString(section.data.title, "Album Ảnh Cưới");
    const photos = normalizePhotos(section.data);

    if (photos.length === 0 && interactive) {
      return null;
    }

    return (
      <section
        key={section.id}
        className="border-b"
        style={{ backgroundColor: bandBg, borderColor: colors.border }}
      >
        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="text-center">
            <p className="text-xs font-medium" style={{ color: colors.accentText }}>
              Khoảnh khắc
            </p>
            <h2
              className="mt-1.5 font-serif text-2xl font-bold sm:text-3xl"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              {title}
            </h2>
          </div>

          {photos.length > 0 ? (
            <div className="mt-8 grid grid-cols-2 gap-2.5">
              {photos.map((photo, index) => (
                <button
                  key={`${photo.url}-${index}`}
                  type="button"
                  onClick={() => {
                    setLightboxPhotos(photos);
                    setLightboxIndex(index);
                  }}
                  aria-label={photo.caption || `Xem ảnh cưới ${index + 1}`}
                  className={`group relative cursor-pointer overflow-hidden rounded-xl ${
                    index === 0 ? "col-span-2 aspect-[4/3]" : "aspect-[3/4]"
                  }`}
                >
                  <Image
                    src={photo.url}
                    alt={photo.caption || `Ảnh cưới ${index + 1}`}
                    fill
                    sizes="(max-width: 640px) 100vw, 400px"
                    className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03] motion-reduce:transition-none"
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-2.5">
              {[1, 2, 3].map((slot, index) => (
                <div
                  key={slot}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center ${
                    index === 0 ? "col-span-2 aspect-[4/3]" : "aspect-[3/4]"
                  }`}
                  style={{ borderColor: colors.border, color: colors.muted }}
                >
                  <ImageIcon className="h-6 w-6 opacity-60" aria-hidden="true" />
                  <span className="text-xs">Ảnh cưới {slot}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderRsvpAndWishes = (section: InvitationSection): React.ReactElement => {
    const title = asString(section.data.title, "Xác nhận tham dự & Gửi lời chúc");

    return (
      <section
        key={section.id}
        className="border-b"
        style={{ backgroundColor: colors.secondary, borderColor: colors.border }}
      >
        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="text-center">
            <p className="text-xs font-medium" style={{ color: colors.accentText }}>
              Phản hồi &amp; Lưu bút
            </p>
            <h2
              className="mt-1.5 font-serif text-2xl font-bold sm:text-3xl"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              {title}
            </h2>
          </div>

          {/* Personalized Guest Greeting */}
          {guest ? (
            <div
              className="mx-auto mt-8 max-w-xl border-y py-4 text-center"
              style={{ borderColor: colors.border }}
            >
              <p className="text-xs font-semibold" style={{ color: colors.primaryInk }}>
                Thiệp mời dành riêng cho{" "}
                {guest.salutation ? `${guest.salutation} ` : ""}
                {guest.fullName}
              </p>
              {guest.greeting ? (
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: colors.muted }}>
                  {guest.greeting}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mx-auto mt-10 max-w-xl">
            {/* Single unified RSVP Form directly on tinted paper */}
            <form onSubmit={(e) => void handleRsvpSubmit(e)} className="space-y-4">
              <div className="flex items-center gap-2">
                <Users
                  className="h-4 w-4"
                  style={{ color: colors.primaryInk }}
                  aria-hidden="true"
                />
                <h3
                  className="font-serif text-lg font-bold"
                  style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
                >
                  Xác nhận tham dự
                </h3>
              </div>

              <div>
                <label
                  htmlFor={`rsvp-name-${section.id}`}
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: colors.muted }}
                >
                  Họ và tên khách mời
                </label>
                <input
                  id={`rsvp-name-${section.id}`}
                  type="text"
                  autoComplete="name"
                  required
                  value={rsvpFullName}
                  onChange={(e) => setRsvpFullName(e.target.value)}
                  placeholder="VD: Nguyễn Hoàng Nam"
                  className="h-11 w-full rounded-xl border px-3.5 text-sm placeholder:text-[color:var(--tpl-muted)]"
                  style={{
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                  }}
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRsvpStatus("attending")}
                  className="min-h-[44px] cursor-pointer rounded-full border px-4 text-xs font-semibold transition-colors duration-200"
                  style={{
                    backgroundColor:
                      rsvpStatus === "attending" ? colors.primary : colors.inputBg,
                    borderColor:
                      rsvpStatus === "attending" ? colors.primary : colors.inputBorder,
                    color:
                      rsvpStatus === "attending" ? colors.primaryFg : colors.text,
                  }}
                >
                  Sẽ tham dự
                </button>
                <button
                  type="button"
                  onClick={() => setRsvpStatus("declined")}
                  className="min-h-[44px] cursor-pointer rounded-full border px-4 text-xs font-semibold transition-colors duration-200"
                  style={{
                    backgroundColor:
                      rsvpStatus === "declined" ? colors.primary : colors.inputBg,
                    borderColor:
                      rsvpStatus === "declined" ? colors.primary : colors.inputBorder,
                    color:
                      rsvpStatus === "declined" ? colors.primaryFg : colors.text,
                  }}
                >
                  Rất tiếc, không thể tham dự
                </button>
              </div>

              <div
                className={`grid gap-3 ${
                  rsvpStatus === "attending"
                    ? "grid-cols-1 sm:grid-cols-3"
                    : "grid-cols-1"
                }`}
              >
                {rsvpStatus === "attending" ? (
                  <div>
                    <label
                      htmlFor={`rsvp-count-${section.id}`}
                      className="mb-1.5 block text-xs font-semibold"
                      style={{ color: colors.muted }}
                    >
                      Số người tham dự
                    </label>
                    <input
                      id={`rsvp-count-${section.id}`}
                      type="number"
                      min={1}
                      max={10}
                      value={attendeeCount}
                      onChange={(e) =>
                        setAttendeeCount(
                          Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                        )
                      }
                      placeholder="1"
                      className="h-11 w-full rounded-xl border px-3.5 text-sm placeholder:text-[color:var(--tpl-muted)]"
                      style={{
                        backgroundColor: colors.inputBg,
                        borderColor: colors.inputBorder,
                        color: colors.text,
                      }}
                    />
                  </div>
                ) : null}

                <div>
                  <label
                    htmlFor={`rsvp-side-${section.id}`}
                    className="mb-1.5 block text-xs font-semibold"
                    style={{ color: colors.muted }}
                  >
                    Khách bên
                  </label>
                  <select
                    id={`rsvp-side-${section.id}`}
                    value={guestSide}
                    onChange={(e) =>
                      setGuestSide(e.target.value === "bride" ? "bride" : "groom")
                    }
                    className="h-11 w-full rounded-xl border px-3 text-sm font-medium"
                    style={{
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                      color: colors.text,
                    }}
                  >
                    <option value="groom">Nhà trai</option>
                    <option value="bride">Nhà gái</option>
                  </select>
                </div>

                {rsvpStatus === "attending" ? (
                  <div>
                    <label
                      htmlFor={`rsvp-transport-${section.id}`}
                      className="mb-1.5 block text-xs font-semibold"
                      style={{ color: colors.muted }}
                    >
                      Phương tiện di chuyển
                    </label>
                    <select
                      id={`rsvp-transport-${section.id}`}
                      value={transportation}
                      onChange={(e) =>
                        setTransportation(
                          e.target.value === "pickup" ? "pickup" : "self",
                        )
                      }
                      className="h-11 w-full rounded-xl border px-3 text-sm font-medium"
                      style={{
                        backgroundColor: colors.inputBg,
                        borderColor: colors.inputBorder,
                        color: colors.text,
                      }}
                    >
                      <option value="self">Tự túc</option>
                      <option value="pickup">Xe đưa đón</option>
                    </select>
                  </div>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor={`rsvp-note-${section.id}`}
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: colors.muted }}
                >
                  Ghi chú (ăn chay, ghế em bé...)
                </label>
                <input
                  id={`rsvp-note-${section.id}`}
                  type="text"
                  maxLength={200}
                  value={rsvpNote}
                  onChange={(e) => setRsvpNote(e.target.value)}
                  placeholder="Ghi chú thêm cho gia đình..."
                  className="h-11 w-full rounded-xl border px-3.5 text-sm placeholder:text-[color:var(--tpl-muted)]"
                  style={{
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                  }}
                />
              </div>

              {rsvpMessage ? (
                <p
                  role={rsvpMessage.type === "error" ? "alert" : "status"}
                  aria-live="polite"
                  className="rounded-xl border px-3.5 py-2.5 text-xs font-medium"
                  style={{
                    borderColor:
                      rsvpMessage.type === "error" ? "#DC2626" : colors.accent,
                    backgroundColor:
                      rsvpMessage.type === "error"
                        ? "rgba(220,38,38,0.08)"
                        : colors.surface,
                  }}
                >
                  {rsvpMessage.text}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={rsvpSubmitting}
                className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-semibold transition-opacity duration-200 hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: colors.primary, color: colors.primaryFg }}
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {rsvpSubmitting ? "Đang gửi..." : "Gửi xác nhận tham dự"}
              </button>
            </form>

            {/* Hairline divider between RSVP and Guestbook */}
            <div
              className="my-12 border-t"
              style={{ borderColor: colors.border }}
              aria-hidden="true"
            />

            {/* Guestbook Wishes Form */}
            <form onSubmit={(e) => void handleWishSubmit(e)} className="space-y-3.5">
              <div className="flex items-center gap-2">
                <MessageSquareHeart
                  className="h-4 w-4"
                  style={{ color: colors.primaryInk }}
                  aria-hidden="true"
                />
                <h3
                  className="font-serif text-lg font-bold"
                  style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
                >
                  Gửi lời chúc phúc
                </h3>
              </div>

              <input
                type="text"
                autoComplete="name"
                required
                maxLength={80}
                value={wishSender}
                onChange={(e) => setWishSender(e.target.value)}
                placeholder="Tên của bạn"
                aria-label="Tên người gửi lời chúc"
                className="h-11 w-full rounded-xl border px-3.5 text-sm placeholder:text-[color:var(--tpl-muted)]"
                style={{
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                }}
              />

              <textarea
                required
                rows={3}
                maxLength={400}
                value={wishContent}
                onChange={(e) => setWishContent(e.target.value)}
                placeholder="Viết lời chúc tốt đẹp gửi tới cô dâu & chú rể..."
                aria-label="Nội dung lời chúc"
                className="w-full rounded-xl border p-3.5 text-sm placeholder:text-[color:var(--tpl-muted)]"
                style={{
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                }}
              />

              {wishMessage ? (
                <p
                  role={wishMessage.type === "error" ? "alert" : "status"}
                  aria-live="polite"
                  className="rounded-xl border px-3.5 py-2.5 text-xs font-medium"
                  style={{
                    borderColor:
                      wishMessage.type === "error" ? "#DC2626" : colors.accent,
                    backgroundColor:
                      wishMessage.type === "error"
                        ? "rgba(220,38,38,0.08)"
                        : colors.surface,
                  }}
                >
                  {wishMessage.text}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={wishSubmitting}
                className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border text-xs font-semibold transition-colors duration-200 hover:opacity-85 disabled:opacity-50"
                style={{
                  borderColor: colors.primaryInk,
                  color: colors.primaryInk,
                  backgroundColor: "transparent",
                }}
              >
                <Heart className="h-3.5 w-3.5" aria-hidden="true" />
                {wishSubmitting ? "Đang gửi..." : "Gửi lời chúc"}
              </button>
            </form>

            {/* Clean hairline-divided wishes stream */}
            {wishList.length > 0 ? (
              <div
                className="mt-8 divide-y border-t"
                style={{ borderColor: colors.border }}
              >
                {wishList.map((wish) => (
                  <article
                    key={wish.id}
                    className="py-4"
                    style={{ borderColor: colors.border }}
                  >
                    <p className="text-xs font-bold sm:text-sm">{wish.senderName}</p>
                    <p
                      className="mt-1 text-xs leading-relaxed sm:text-sm"
                      style={{ color: colors.muted }}
                    >
                      {wish.content}
                    </p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  };

  const renderVietQrGift = (
    section: InvitationSection,
    bandBg: string,
  ): React.ReactElement => {
    const title = asString(section.data.title, "Hộp Mừng Cưới");
    const accounts = normalizeBankAccounts(section.data);

    return (
      <section
        key={section.id}
        className="border-b"
        style={{ backgroundColor: bandBg, borderColor: colors.border }}
      >
        <div className="mx-auto max-w-2xl px-5 py-14 text-center sm:px-8 sm:py-20">
          <p className="text-xs font-medium" style={{ color: colors.accentText }}>
            Gửi trao yêu thương
          </p>
          <h2
            className="mt-1.5 font-serif text-2xl font-bold sm:text-3xl"
            style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
          >
            {title}
          </h2>
          <p
            className="mx-auto mt-3 max-w-md text-sm leading-relaxed"
            style={{ color: colors.muted }}
          >
            Sự hiện diện của bạn là món quà quý giá nhất. Nếu muốn gửi quà mừng
            từ xa, bạn có thể mở hộp mừng cưới VietQR bên dưới.
          </p>

          {accounts.length > 0 ? (
            <div
              className="mx-auto mt-8 grid max-w-lg grid-cols-1 divide-y border-y py-5 sm:grid-cols-2 sm:divide-x sm:divide-y-0"
              style={{ borderColor: colors.border }}
            >
              {accounts.map((acc, idx) => (
                <div
                  key={`${acc.side}-${acc.accountNumber}`}
                  className={`flex flex-col items-center justify-between gap-3 ${
                    accounts.length > 1
                      ? idx === 0
                        ? "pb-5 sm:pb-0 sm:pr-5"
                        : "pt-5 sm:pt-0 sm:pl-5"
                      : "sm:col-span-2"
                  }`}
                  style={{ borderColor: colors.border }}
                >
                  <div>
                    <p
                      className="text-xs font-semibold"
                      style={{ color: colors.accentText }}
                    >
                      {acc.side === "groom" ? "Mừng nhà trai" : "Mừng nhà gái"}
                    </p>
                    <p className="mt-1.5 text-sm font-bold">{acc.accountHolder}</p>
                    <p className="mt-0.5 text-xs tabular-nums" style={{ color: colors.muted }}>
                      {acc.bankShortName} — {acc.accountNumber}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setQrModalAccounts(accounts);
                      setQrModalSide(acc.side);
                      setQrModalOpen(true);
                    }}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full px-5 text-xs font-semibold transition-opacity duration-200 hover:opacity-90"
                    style={{
                      backgroundColor: colors.primary,
                      color: colors.primaryFg,
                    }}
                  >
                    <Gift className="h-3.5 w-3.5" aria-hidden="true" />
                    Mở mã VietQR
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-7">
              <button
                type="button"
                onClick={() => {
                  setQrModalAccounts([]);
                  setQrModalSide("groom");
                  setQrModalOpen(true);
                }}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full px-6 text-sm font-semibold transition-opacity duration-200 hover:opacity-90"
                style={{ backgroundColor: colors.primary, color: colors.primaryFg }}
              >
                <Gift className="h-4 w-4" aria-hidden="true" />
                Mở hộp mừng cưới
              </button>
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderFooterSection = (
    section: InvitationSection,
    bandBg: string,
  ): React.ReactElement => {
    const note = asString(
      section.data.note,
      "Cảm ơn bạn đã dành thời gian đến chung vui và chúc phúc cho chúng mình.",
    );
    return (
      <footer
        key={section.id}
        className={`border-b px-5 text-center ${
          showWatermark
            ? "py-12"
            : "pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-12"
        }`}
        style={{ backgroundColor: bandBg, borderColor: colors.border }}
      >
        <p className="font-serif text-lg font-semibold">{coupleNames}</p>
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed" style={{ color: colors.muted }}>
          {note}
        </p>
      </footer>
    );
  };

  const renderFreeElement = (el: FreeOverlayElement): React.ReactElement | null => {
    const style: React.CSSProperties = {
      left: `${el.xPercent}%`,
      top: `${el.yPercent}%`,
      width: `${el.widthPercent}%`,
      transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
      zIndex: el.zIndex,
    };

    if (el.kind === "text") {
      const text = asString(el.props.text);
      if (!text) return null;
      return (
        <div
          key={el.id}
          className="pointer-events-none absolute text-center font-serif font-semibold"
          style={{
            ...style,
            color: asString(el.props.color, colors.primaryInk),
            fontSize: asString(el.props.fontSize, "1rem"),
          }}
        >
          {text}
        </div>
      );
    }

    if (el.kind === "photo" && isSafeMediaUrl(el.props.url)) {
      return (
        // Dynamic user overlay photo sized purely by percentage width in FreeOverlay canvas
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={el.id}
          src={el.props.url}
          alt={asString(el.props.alt, "")}
          decoding="async"
          loading="lazy"
          className="pointer-events-none absolute rounded-xl object-cover shadow-md"
          style={style}
        />
      );
    }

    if (el.kind === "sticker") {
      const label = asString(el.props.label, "♥");
      return (
        <div
          key={el.id}
          className="pointer-events-none absolute text-center text-2xl"
          style={{ ...style, color: colors.accentText }}
          aria-hidden="true"
        >
          {label}
        </div>
      );
    }

    return null;
  };

  let paperBandIndex = 0;

  return (
    <div
      className="relative min-h-dvh w-full overflow-x-clip"
      style={
        {
          backgroundColor: colors.bg,
          color: colors.text,
          "--tpl-primary": colors.primary,
          "--tpl-primary-fg": colors.primaryFg,
          "--tpl-primary-ink": colors.primaryInk,
          "--tpl-secondary": colors.secondary,
          "--tpl-accent": colors.accent,
          "--tpl-accent-text": colors.accentText,
          "--tpl-text": colors.text,
          "--tpl-muted": colors.muted,
          "--tpl-bg": colors.bg,
          "--tpl-surface": colors.surface,
          "--tpl-border": colors.border,
        } as React.CSSProperties
      }
    >
      {interactive ? (
        <OpeningOverlay
          mode={effects.opening}
          coupleNames={coupleNames}
          subtitle={heroSubtitle}
          coverPhotoUrl={heroCoverUrl}
          palette={palette}
          previewMode={previewMode}
        />
      ) : null}

      <ParticlesLayer
        mode={effects.particles}
        primaryColor={palette.primary}
        accentColor={palette.accent}
        previewMode={previewMode}
      />

      <div className="relative z-10 w-full">
        {visibleSections.map((section) => {
          if (section.type === "hero") {
            return renderHero(section);
          }
          if (section.type === "rsvp_wish") {
            paperBandIndex += 1;
            return renderRsvpAndWishes(section);
          }

          const bandBg =
            paperBandIndex % 2 === 1 ? colors.secondary : colors.bg;
          paperBandIndex += 1;

          switch (section.type) {
            case "couple":
              return renderCouple(section, bandBg);
            case "love_story":
              return renderLoveStory(section, bandBg);
            case "events_calendar":
              return renderEventsCalendar(section, bandBg);
            case "gallery":
              return renderGallery(section, bandBg);
            case "vietqr_gift":
              return renderVietQrGift(section, bandBg);
            case "footer":
              return renderFooterSection(section, bandBg);
            default:
              return null;
          }
        })}

        {/* Pro Free Overlay Elements */}
        {doc.freeElements.length > 0 ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {doc.freeElements.map((el) => renderFreeElement(el))}
          </div>
        ) : null}

        {/* Subtle editorial watermark footer */}
        {showWatermark ? (
          <footer
            className="px-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-8 text-center text-xs font-medium"
            style={{
              backgroundColor: colors.bg,
              color: colors.muted,
            }}
          >
            Thiệp cưới điện tử từ{" "}
            <Link
              href="/"
              className="font-semibold underline decoration-1 underline-offset-4 transition-opacity duration-200 hover:opacity-75"
              style={{ color: colors.primaryInk }}
            >
              Matrimony
            </Link>
          </footer>
        ) : null}
      </div>

      {interactive ? (
        <MusicController
          music={music}
          autoScrollSpeed={effects.autoScrollSpeed}
          palette={palette}
          previewMode={previewMode}
        />
      ) : null}

      <VietQrModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        bankAccounts={qrModalAccounts}
        initialSide={qrModalSide}
        coupleNames={coupleNames}
        palette={palette}
      />

      {/* Album Lightbox */}
      {lightboxIndex !== null && lightboxPhotos[lightboxIndex] ? (
        <div
          ref={lightboxRef}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm outline-none"
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh cưới"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            aria-label="Đóng xem ảnh"
            className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white transition-colors duration-200 hover:bg-white/25"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          {lightboxPhotos.length > 1 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(
                  (lightboxIndex - 1 + lightboxPhotos.length) %
                    lightboxPhotos.length,
                );
              }}
              aria-label="Ảnh trước"
              className="absolute left-3 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white transition-colors duration-200 hover:bg-white/25"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}

          <div
            className="max-h-[85dvh] max-w-3xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dynamic-aspect lightbox photo scales naturally to viewport */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxPhotos[lightboxIndex].url}
              alt={lightboxPhotos[lightboxIndex].caption || "Ảnh cưới"}
              decoding="async"
              className="max-h-[78dvh] w-auto rounded-xl object-contain"
            />
            {lightboxPhotos[lightboxIndex].caption ? (
              <p className="mt-3 text-sm text-white/90">
                {lightboxPhotos[lightboxIndex].caption}
              </p>
            ) : null}
          </div>

          {lightboxPhotos.length > 1 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((lightboxIndex + 1) % lightboxPhotos.length);
              }}
              aria-label="Ảnh tiếp theo"
              className="absolute right-3 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white transition-colors duration-200 hover:bg-white/25"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
