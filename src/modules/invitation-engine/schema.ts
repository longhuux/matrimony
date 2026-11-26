import { z } from "zod";
import { isoDateToLunar } from "./lunar";

export const ceremonyTypeSchema = z.enum([
  "an_hoi",
  "vu_quy",
  "thanh_hon",
  "tan_hon",
  "tiec_cuoi",
  "bao_hy",
  "other",
]);

/** Validates an optional HTTP(S) URL, allowing an empty string. */
export const optionalHttpUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (val) => {
      if (val === "") return true;
      try {
        const parsed = new URL(val);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL phải bắt đầu bằng http:// hoặc https://" },
  );

/** Validates an optional media URL: empty string, local /path (including /api/media/...), or http(s) URL. */
export const optionalMediaUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (val) => {
      if (val === "") return true;
      if (val.startsWith("/") && !val.startsWith("//")) {
        return true;
      }
      try {
        const parsed = new URL(val);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL media phải bắt đầu bằng /, http:// hoặc https://" },
  );

export const personProfileSchema = z.object({
  fullName: z.string().min(1).max(80),
  shortName: z.string().min(1).max(40),
  phone: z.string().max(20).optional().default(""),
  fatherName: z.string().max(80).optional().default(""),
  motherName: z.string().max(80).optional().default(""),
  homeAddress: z.string().max(200).optional().default(""),
  homeMapUrl: optionalHttpUrlSchema.optional().default(""),
});

export const weddingEventSchema = z.object({
  id: z.string().min(1).max(40),
  type: ceremonyTypeSchema,
  title: z.string().min(1).max(100),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày sự kiện phải theo định dạng YYYY-MM-DD")
    .refine(
      (val) => {
        const [yearStr, monthStr, dayStr] = val.split("-");
        const year = Number(yearStr);
        const month = Number(monthStr);
        const day = Number(dayStr);
        const check = new Date(Date.UTC(year, month - 1, day));
        if (year < 100) {
          check.setUTCFullYear(year, month - 1, day);
        }
        return (
          check.getUTCFullYear() === year &&
          check.getUTCMonth() + 1 === month &&
          check.getUTCDate() === day
        );
      },
      { message: "Ngày sự kiện không hợp lệ trên lịch" },
    ),
  time: z.string().max(20).default("11:00"),
  welcomeTime: z.string().max(20).optional().default("10:30"),
  venueName: z.string().max(120).default(""),
  venueAddress: z.string().max(220).default(""),
  venueMapUrl: optionalHttpUrlSchema.optional().default(""),
});

export const bankAccountItemSchema = z.object({
  side: z.enum(["groom", "bride"]),
  bankBin: z.string().regex(/^\d{6}$/, "Mã BIN ngân hàng gồm 6 chữ số"),
  bankShortName: z.string().min(1).max(30),
  accountNumber: z
    .string()
    .regex(/^[a-zA-Z0-9]{4,30}$/, "Số tài khoản gồm 4-30 ký tự chữ hoặc số"),
  accountHolder: z.string().min(1).max(80),
});

export const weddingProfileDataSchema = z.object({
  groom: personProfileSchema,
  bride: personProfileSchema,
  events: z.array(weddingEventSchema).max(8).default([]),
  bankAccounts: z.array(bankAccountItemSchema).max(4).default([]),
  mainEventId: z.string().optional(),
});

export type WeddingProfileData = z.infer<typeof weddingProfileDataSchema>;

export const sectionTypeSchema = z.enum([
  "hero",
  "couple",
  "love_story",
  "events_calendar",
  "gallery",
  "rsvp_wish",
  "vietqr_gift",
  "footer",
]);

export const invitationSectionSchema = z.object({
  id: z.string().min(1).max(60),
  type: sectionTypeSchema,
  variant: z.string().min(1).max(60),
  visible: z.boolean().default(true),
  order: z.number().int().min(0),
  data: z.record(z.string(), z.unknown()).default({}),
});

export type InvitationSection = z.infer<typeof invitationSectionSchema>;

export const freeOverlayElementSchema = z.object({
  id: z.string().min(1).max(60),
  kind: z.enum(["text", "sticker", "photo"]),
  xPercent: z.number().min(0).max(100),
  yPercent: z.number().min(0).max(100),
  widthPercent: z.number().min(1).max(100),
  rotation: z.number().min(-360).max(360).default(0),
  zIndex: z.number().int().min(0).max(100).default(10),
  props: z.record(z.string(), z.unknown()).default({}),
});

export type FreeOverlayElement = z.infer<typeof freeOverlayElementSchema>;

export const invitationThemeSchema = z.object({
  templateId: z.string().min(1).max(80),
  palette: z.object({
    primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    text: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    background: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  }),
  fonts: z.object({
    heading: z.string().min(1).max(80),
    body: z.string().min(1).max(80),
  }),
  effects: z.object({
    opening: z
      .enum(["none", "envelope", "curtain", "door", "photo-cover"])
      .default("envelope"),
    particles: z
      .enum(["none", "petals", "hearts", "snow", "sparkles", "confetti"])
      .default("petals"),
    autoScrollSpeed: z.number().min(0).max(0.2).default(0),
  }),
  music: z
    .object({
      trackId: z.string().optional(),
      url: optionalMediaUrlSchema.optional(),
      title: z.string().optional(),
    })
    .optional(),
});

export const invitationSeoSchema = z.object({
  title: z.string().max(120).optional().default(""),
  description: z.string().max(260).optional().default(""),
  coverPhotoUrl: optionalMediaUrlSchema.optional().default(""),
});

export const invitationDocumentV2Schema = z.object({
  schemaVersion: z.literal(2),
  theme: invitationThemeSchema,
  sections: z.array(invitationSectionSchema).min(1).max(20),
  freeElements: z.array(freeOverlayElementSchema).max(50).default([]),
  seo: invitationSeoSchema.optional(),
});

export type InvitationDocumentV2 = z.infer<typeof invitationDocumentV2Schema>;

function formatParents(father?: string, mother?: string): string {
  const parts = [father?.trim(), mother?.trim()].filter(Boolean);
  return parts.join(" & ");
}

function replaceTokensInValue(value: unknown, tokens: Record<string, string>): unknown {
  if (typeof value === "string") {
    return value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (full, key: string) =>
      Object.hasOwn(tokens, key) ? tokens[key] : full,
    );
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceTokensInValue(item, tokens));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = replaceTokensInValue(v, tokens);
    }
    return out;
  }
  return value;
}

/**
 * Hydrates template placeholders ({{groomName}}, {{eventDateLunar}}, etc.) from a WeddingProfile
 * without mutating the source document.
 */
export function hydrateDocumentWithProfile(
  doc: InvitationDocumentV2,
  profile: WeddingProfileData,
): InvitationDocumentV2 {
  const mainEvent =
    profile.events.find((e) => e.id === profile.mainEventId) ?? profile.events[0];
  const lunar = mainEvent ? isoDateToLunar(mainEvent.date) : null;
  const formattedSolarDate = mainEvent
    ? mainEvent.date.split("-").reverse().join("/")
    : "";

  const tokens: Record<string, string> = {
    groomName: profile.groom.fullName,
    groomShortName: profile.groom.shortName,
    brideName: profile.bride.fullName,
    brideShortName: profile.bride.shortName,
    coupleNames: `${profile.groom.shortName} & ${profile.bride.shortName}`,
    groomParents: formatParents(profile.groom.fatherName, profile.groom.motherName),
    brideParents: formatParents(profile.bride.fatherName, profile.bride.motherName),
    groomPhone: profile.groom.phone ?? "",
    bridePhone: profile.bride.phone ?? "",
    groomHomeAddress: profile.groom.homeAddress ?? "",
    brideHomeAddress: profile.bride.homeAddress ?? "",
    groomHomeMapLink: profile.groom.homeMapUrl ?? "",
    brideHomeMapLink: profile.bride.homeMapUrl ?? "",
    eventTitle: mainEvent?.title ?? "",
    eventDate: formattedSolarDate,
    eventIsoDate: mainEvent?.date ?? "",
    eventTime: mainEvent?.time ?? "",
    welcomeTime: mainEvent?.welcomeTime ?? "",
    eventDateLunar: lunar?.formatted ?? "",
    eventCanChiDay: lunar?.canChiDay ?? "",
    eventCanChiMonth: lunar?.canChiMonth ?? "",
    eventCanChiYear: lunar?.canChiYear ?? "",
    venueName: mainEvent?.venueName ?? "",
    venueAddress: mainEvent?.venueAddress ?? "",
    venueMapLink: mainEvent?.venueMapUrl ?? "",
  };

  return {
    ...doc,
    sections: doc.sections.map((section) => {
      const nextData = replaceTokensInValue(section.data, tokens) as Record<string, unknown>;

      if (
        section.type === "events_calendar" &&
        profile.events.length > 0 &&
        (!Array.isArray(nextData.events) || nextData.events.length === 0)
      ) {
        nextData.events = profile.events.map((ev) => {
          const evLunar = isoDateToLunar(ev.date);
          return {
            id: ev.id,
            type: ev.type,
            title: ev.title,
            date: ev.date,
            formattedDate: ev.date.split("-").reverse().join("/"),
            time: ev.time,
            welcomeTime: ev.welcomeTime ?? "",
            venueName: ev.venueName,
            venueAddress: ev.venueAddress,
            venueMapUrl: ev.venueMapUrl ?? "",
            lunarDate: evLunar?.formatted ?? "",
            canChiDay: evLunar?.canChiDay ?? "",
            canChiMonth: evLunar?.canChiMonth ?? "",
            canChiYear: evLunar?.canChiYear ?? "",
          };
        });
        if (!nextData.eventIsoDate && mainEvent?.date) {
          nextData.eventIsoDate = mainEvent.date;
        }
      }

      if (
        section.type === "vietqr_gift" &&
        profile.bankAccounts.length > 0 &&
        (!Array.isArray(nextData.bankAccounts) || nextData.bankAccounts.length === 0)
      ) {
        nextData.bankAccounts = profile.bankAccounts.map((acc) => ({ ...acc }));
      }

      return {
        ...section,
        data: nextData,
      };
    }),
  };
}
