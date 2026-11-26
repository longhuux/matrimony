import {
  invitationDocumentV2Schema,
  type InvitationDocumentV2,
  type InvitationSection,
} from "./schema";

export interface BuiltInMusicTrack {
  id: string;
  title: string;
  artist: string;
  mood: string;
}

export const BUILT_IN_MUSIC_TRACKS: readonly BuiltInMusicTrack[] = [
  {
    id: "anh-nang-cua-anh",
    title: "Ánh Nắng Của Anh",
    artist: "Acoustic Piano",
    mood: "Lãng mạn • Nhẹ nhàng",
  },
  {
    id: "ngay-chung-doi",
    title: "Ngày Chung Đôi",
    artist: "Harp & Strings",
    mood: "Ấm áp • Trang trọng",
  },
  {
    id: "tram-nam-hanh-phuc",
    title: "Trăm Năm Hạnh Phúc",
    artist: "Traditional Ensemble",
    mood: "Cổ điển • Lễ Gia Tiên",
  },
  {
    id: "dem-sao-nguyen-uoc",
    title: "Đêm Sao Nguyện Ước",
    artist: "Ambient Harp",
    mood: "Tiệc Tối • Lung linh",
  },
] as const;

export interface FlagshipTemplate {
  slug: string;
  name: string;
  description: string;
  category: string;
  tier: "free" | "pro";
  thumbnailUrl: string;
  defaultDoc: InvitationDocumentV2;
}

interface BuildBaseDocVariants {
  hero?: string;
  couple?: string;
  love_story?: string;
  events_calendar?: string;
  gallery?: string;
  rsvp_wish?: string;
  vietqr_gift?: string;
}

interface BuildBaseDocMedia {
  coverPhotoUrl: string;
  galleryPhotos: string[];
}

function buildBaseDoc(
  templateId: string,
  palette: InvitationDocumentV2["theme"]["palette"],
  fonts: InvitationDocumentV2["theme"]["fonts"],
  effects: InvitationDocumentV2["theme"]["effects"],
  variants: BuildBaseDocVariants = {},
  musicTrackId = "anh-nang-cua-anh",
  media: BuildBaseDocMedia = { coverPhotoUrl: "", galleryPhotos: [] },
): InvitationDocumentV2 {
  const track =
    BUILT_IN_MUSIC_TRACKS.find((t) => t.id === musicTrackId) ?? BUILT_IN_MUSIC_TRACKS[0];

  return invitationDocumentV2Schema.parse({
    schemaVersion: 2,
    theme: {
      templateId,
      palette,
      fonts,
      effects,
      music: {
        trackId: track.id,
        title: track.title,
        url: "",
      },
    },
    sections: [
      {
        id: "sec_hero",
        type: "hero",
        variant: variants.hero ?? "editorial-full",
        visible: true,
        order: 0,
        data: {
          badge: "Trân trọng báo tin",
          headline: "{{coupleNames}}",
          subtitle: "{{eventDate}}",
          lunarDate: "{{eventDateLunar}}",
          coverPhotoUrl: media.coverPhotoUrl,
        },
      },
      {
        id: "sec_couple",
        type: "couple",
        variant: variants.couple ?? "dual-family",
        visible: true,
        order: 1,
        data: {
          groomName: "{{groomName}}",
          groomParents: "{{groomParents}}",
          groomHomeAddress: "{{groomHomeAddress}}",
          groomHomeMapLink: "{{groomHomeMapLink}}",
          brideName: "{{brideName}}",
          brideParents: "{{brideParents}}",
          brideHomeAddress: "{{brideHomeAddress}}",
          brideHomeMapLink: "{{brideHomeMapLink}}",
        },
      },
      {
        id: "sec_story",
        type: "love_story",
        variant: variants.love_story ?? "timeline-3",
        visible: true,
        order: 2,
        data: {
          title: "Chuyện chúng mình",
          milestones: [
            {
              year: "Lần đầu gặp gỡ",
              caption: "Khoảnh khắc bắt đầu một hành trình mới.",
            },
            {
              year: "Lời cầu hôn",
              caption: "Cái gật đầu cho một đời bên nhau.",
            },
            {
              year: "Ngày chung đôi",
              caption: "Hân hạnh đón tiếp gia đình và bạn bè thân thiết.",
            },
          ],
        },
      },
      {
        id: "sec_events",
        type: "events_calendar",
        variant: variants.events_calendar ?? "ceremony-card",
        visible: true,
        order: 3,
        data: {
          eventTitle: "{{eventTitle}}",
          eventDate: "{{eventDate}}",
          eventIsoDate: "{{eventIsoDate}}",
          eventTime: "{{eventTime}}",
          welcomeTime: "{{welcomeTime}}",
          eventDateLunar: "{{eventDateLunar}}",
          venueName: "{{venueName}}",
          venueAddress: "{{venueAddress}}",
          venueMapLink: "{{venueMapLink}}",
        },
      },
      {
        id: "sec_gallery",
        type: "gallery",
        variant: variants.gallery ?? "masonry-grid",
        visible: true,
        order: 4,
        data: { title: "Album Ảnh Cưới", photos: media.galleryPhotos },
      },
      {
        id: "sec_rsvp",
        type: "rsvp_wish",
        variant: variants.rsvp_wish ?? "inline-card",
        visible: true,
        order: 5,
        data: { title: "Xác nhận tham dự & Gửi lời chúc" },
      },
      {
        id: "sec_gift",
        type: "vietqr_gift",
        variant: variants.vietqr_gift ?? "dual-bank",
        visible: true,
        order: 6,
        data: { title: "Hộp Mừng Cưới" },
      },
    ],
    freeElements: [],
    seo: {
      title: "",
      description: "",
      coverPhotoUrl: media.coverPhotoUrl,
    },
  });
}

export const FLAGSHIP_TEMPLATES: readonly FlagshipTemplate[] = [
  {
    slug: "modern-ivory",
    name: "Ivory Minimal",
    description:
      "Tối giản hiện đại, nền ngà ấm kết hợp chữ serif thanh lịch, tôn ảnh cưới tự nhiên.",
    category: "modern",
    tier: "free",
    thumbnailUrl: "/images/wedding/hero-couple.webp",
    defaultDoc: buildBaseDoc(
      "modern-ivory",
      {
        primary: "#8B2635",
        secondary: "#F5ECE6",
        accent: "#C89D66",
        text: "#231B18",
        background: "#FFFCF9",
      },
      { heading: "Playfair Display", body: "Be Vietnam Pro" },
      { opening: "envelope", particles: "petals", autoScrollSpeed: 0.04 },
      {
        hero: "editorial-full",
        couple: "dual-family",
        love_story: "timeline-3",
        events_calendar: "ceremony-card",
        gallery: "masonry-grid",
        rsvp_wish: "inline-card",
        vietqr_gift: "dual-bank",
      },
      "anh-nang-cua-anh",
      {
        coverPhotoUrl: "/images/wedding/hero-couple.webp",
        galleryPhotos: [
          "/images/wedding/hero-couple.webp",
          "/images/wedding/stationery-detail.webp",
          "/images/wedding/champagne-heritage.webp",
          "/images/wedding/blush-botanical.webp",
        ],
      },
    ),
  },
  {
    slug: "royal-crimson",
    name: "Sắc Son Truyền Thống",
    description:
      "Đỏ son truyền thống kết hợp ánh kim vàng đồng, phù hợp lễ Vu Quy & Thành Hôn.",
    category: "traditional",
    tier: "free",
    thumbnailUrl: "/images/wedding/royal-crimson.webp",
    defaultDoc: buildBaseDoc(
      "royal-crimson",
      {
        primary: "#9B1B24",
        secondary: "#FDF1EE",
        accent: "#D4AF37",
        text: "#2B1414",
        background: "#FFF8F6",
      },
      { heading: "Playfair Display", body: "Be Vietnam Pro" },
      { opening: "door", particles: "hearts", autoScrollSpeed: 0.04 },
      {
        hero: "royal-frame",
        couple: "dual-family",
        love_story: "timeline-3",
        events_calendar: "ceremony-card",
        gallery: "masonry-grid",
        rsvp_wish: "inline-card",
        vietqr_gift: "dual-bank",
      },
      "tram-nam-hanh-phuc",
      {
        coverPhotoUrl: "/images/wedding/royal-crimson.webp",
        galleryPhotos: [
          "/images/wedding/royal-crimson.webp",
          "/images/wedding/stationery-detail.webp",
          "/images/wedding/midnight-starlight.webp",
        ],
      },
    ),
  },
  {
    slug: "european-classic",
    name: "Champagne Heritage",
    description:
      "Cổ điển châu Âu với tông sâm-panh và xanh ô-liu, sang trọng cho tiệc sảnh lớn.",
    category: "classic",
    tier: "pro",
    thumbnailUrl: "/images/wedding/champagne-heritage.webp",
    defaultDoc: buildBaseDoc(
      "european-classic",
      {
        primary: "#4A5D4E",
        secondary: "#F2EFE9",
        accent: "#B89563",
        text: "#1F2421",
        background: "#FCFBF8",
      },
      { heading: "Playfair Display", body: "Be Vietnam Pro" },
      { opening: "envelope", particles: "sparkles", autoScrollSpeed: 0.05 },
      {
        hero: "magazine-cover",
        couple: "dual-family",
        love_story: "timeline-3",
        events_calendar: "ceremony-card",
        gallery: "masonry-grid",
        rsvp_wish: "inline-card",
        vietqr_gift: "dual-bank",
      },
      "ngay-chung-doi",
      {
        coverPhotoUrl: "/images/wedding/champagne-heritage.webp",
        galleryPhotos: [
          "/images/wedding/champagne-heritage.webp",
          "/images/wedding/stationery-detail.webp",
          "/images/wedding/editorial-vogue.webp",
        ],
      },
    ),
  },
  {
    slug: "pastel-bloom",
    name: "Blush Botanical",
    description:
      "Hồng phấn dịu nhẹ và hoa lá thơ mộng, phù hợp tiệc cưới sân vườn ngoài trời.",
    category: "romantic",
    tier: "free",
    thumbnailUrl: "/images/wedding/blush-botanical.webp",
    defaultDoc: buildBaseDoc(
      "pastel-bloom",
      {
        primary: "#9B4A5B",
        secondary: "#FDF2F5",
        accent: "#E5989B",
        text: "#34252A",
        background: "#FFF9FB",
      },
      { heading: "Playfair Display", body: "Be Vietnam Pro" },
      { opening: "curtain", particles: "petals", autoScrollSpeed: 0.04 },
      {
        hero: "garden-split",
        couple: "dual-family",
        love_story: "timeline-3",
        events_calendar: "ceremony-card",
        gallery: "masonry-grid",
        rsvp_wish: "inline-card",
        vietqr_gift: "dual-bank",
      },
      "anh-nang-cua-anh",
      {
        coverPhotoUrl: "/images/wedding/blush-botanical.webp",
        galleryPhotos: [
          "/images/wedding/blush-botanical.webp",
          "/images/wedding/stationery-detail.webp",
          "/images/wedding/dalat-garden.webp",
        ],
      },
    ),
  },
  {
    slug: "editorial-vogue",
    name: "Editorial Tạp Chí",
    description:
      "Bố cục tạp chí nghệ thuật tương phản cao dành cho bộ ảnh studio cá tính.",
    category: "editorial",
    tier: "pro",
    thumbnailUrl: "/images/wedding/editorial-vogue.webp",
    defaultDoc: buildBaseDoc(
      "editorial-vogue",
      {
        primary: "#1C1917",
        secondary: "#F5F5F4",
        accent: "#A16207",
        text: "#1C1917",
        background: "#FFFFFF",
      },
      { heading: "Playfair Display", body: "Be Vietnam Pro" },
      { opening: "photo-cover", particles: "none", autoScrollSpeed: 0.03 },
      {
        hero: "magazine-cover",
        couple: "dual-family",
        love_story: "timeline-3",
        events_calendar: "ceremony-card",
        gallery: "masonry-grid",
        rsvp_wish: "inline-card",
        vietqr_gift: "dual-bank",
      },
      "ngay-chung-doi",
      {
        coverPhotoUrl: "/images/wedding/editorial-vogue.webp",
        galleryPhotos: [
          "/images/wedding/editorial-vogue.webp",
          "/images/wedding/stationery-detail.webp",
          "/images/wedding/hero-couple.webp",
        ],
      },
    ),
  },
  {
    slug: "imperial-phoenix",
    name: "Rồng Phụng Cung Đình",
    description:
      "Họa tiết cung đình Á Đông với khung viền son phấn và vàng đồng trang nghiêm.",
    category: "traditional",
    tier: "pro",
    thumbnailUrl: "/images/wedding/royal-crimson.webp",
    defaultDoc: buildBaseDoc(
      "imperial-phoenix",
      {
        primary: "#7F1D1D",
        secondary: "#FFF4E8",
        accent: "#B45309",
        text: "#291512",
        background: "#FFFDF8",
      },
      { heading: "Playfair Display", body: "Be Vietnam Pro" },
      { opening: "door", particles: "confetti", autoScrollSpeed: 0.04 },
      {
        hero: "royal-frame",
        couple: "dual-family",
        love_story: "timeline-3",
        events_calendar: "ceremony-card",
        gallery: "masonry-grid",
        rsvp_wish: "inline-card",
        vietqr_gift: "dual-bank",
      },
      "tram-nam-hanh-phuc",
      {
        coverPhotoUrl: "/images/wedding/royal-crimson.webp",
        galleryPhotos: [
          "/images/wedding/royal-crimson.webp",
          "/images/wedding/stationery-detail.webp",
          "/images/wedding/midnight-starlight.webp",
        ],
      },
    ),
  },
  {
    slug: "dalat-garden",
    name: "Sân Vườn Đà Lạt",
    description:
      "Xanh thông cao nguyên dịu mắt kết hợp điểm nhấn hổ phách ấm cho tiệc ngoài trời.",
    category: "romantic",
    tier: "free",
    thumbnailUrl: "/images/wedding/dalat-garden.webp",
    defaultDoc: buildBaseDoc(
      "dalat-garden",
      {
        primary: "#2F4F3E",
        secondary: "#EFF5F0",
        accent: "#7C531E",
        text: "#1E2B23",
        background: "#FAFCFA",
      },
      { heading: "Playfair Display", body: "Be Vietnam Pro" },
      { opening: "curtain", particles: "petals", autoScrollSpeed: 0.04 },
      {
        hero: "garden-split",
        couple: "dual-family",
        love_story: "timeline-3",
        events_calendar: "ceremony-card",
        gallery: "masonry-grid",
        rsvp_wish: "inline-card",
        vietqr_gift: "dual-bank",
      },
      "anh-nang-cua-anh",
      {
        coverPhotoUrl: "/images/wedding/dalat-garden.webp",
        galleryPhotos: [
          "/images/wedding/dalat-garden.webp",
          "/images/wedding/blush-botanical.webp",
          "/images/wedding/stationery-detail.webp",
        ],
      },
    ),
  },
  {
    slug: "midnight-starlight",
    name: "Đêm Tiệc Ánh Sao",
    description:
      "Nền đêm tiệc huyền bí kết hợp ánh vàng champagne sang trọng cho dạ tiệc tối.",
    category: "luxury",
    tier: "pro",
    thumbnailUrl: "/images/wedding/midnight-starlight.webp",
    defaultDoc: buildBaseDoc(
      "midnight-starlight",
      {
        primary: "#E6C280",
        secondary: "#2A2226",
        accent: "#C89D66",
        text: "#FFFCF9",
        background: "#16100E",
      },
      { heading: "Playfair Display", body: "Be Vietnam Pro" },
      { opening: "curtain", particles: "sparkles", autoScrollSpeed: 0.05 },
      {
        hero: "nocturne-glow",
        couple: "dual-family",
        love_story: "timeline-3",
        events_calendar: "ceremony-card",
        gallery: "masonry-grid",
        rsvp_wish: "inline-card",
        vietqr_gift: "dual-bank",
      },
      "dem-sao-nguyen-uoc",
      {
        coverPhotoUrl: "/images/wedding/midnight-starlight.webp",
        galleryPhotos: [
          "/images/wedding/midnight-starlight.webp",
          "/images/wedding/editorial-vogue.webp",
          "/images/wedding/champagne-heritage.webp",
        ],
      },
    ),
  },
];

export function getTemplateBySlug(slug: string): FlagshipTemplate | undefined {
  return FLAGSHIP_TEMPLATES.find((tpl) => tpl.slug === slug);
}

function hasNonEmptyMediaString(val: unknown): val is string {
  return typeof val === "string" && val.trim().length > 0;
}

function hasPopulatedPhotos(val: unknown): boolean {
  if (!Array.isArray(val) || val.length === 0) return false;
  return val.some((item) => {
    if (typeof item === "string") return item.trim().length > 0;
    if (item && typeof item === "object" && "url" in item) {
      return hasNonEmptyMediaString((item as { url?: unknown }).url);
    }
    return false;
  });
}

/**
 * Applies a target template's theme and section variants onto an existing invitation document
 * while preserving section data, visibility, ordering, seo metadata, freeElements,
 * and user-configured music. Custom coverPhotoUrl and gallery photos are kept when populated,
 * otherwise inherited from the target template.
 */
export function applyTemplateToDocument(
  currentDoc: InvitationDocumentV2,
  templateDoc: InvitationDocumentV2,
): InvitationDocumentV2 {
  const templateSectionByType = new Map<string, InvitationSection>();
  for (const sec of templateDoc.sections) {
    if (!templateSectionByType.has(sec.type)) {
      templateSectionByType.set(sec.type, sec);
    }
  }

  const hasCustomMusic =
    Boolean(currentDoc.theme.music?.url?.trim()) ||
    Boolean(currentDoc.theme.music?.trackId?.trim());

  const hasCustomSeoCover = hasNonEmptyMediaString(currentDoc.seo?.coverPhotoUrl);
  const nextSeo = currentDoc.seo
    ? {
        ...currentDoc.seo,
        coverPhotoUrl: hasCustomSeoCover
          ? currentDoc.seo.coverPhotoUrl
          : (templateDoc.seo?.coverPhotoUrl ?? currentDoc.seo.coverPhotoUrl),
      }
    : templateDoc.seo
      ? { ...templateDoc.seo }
      : undefined;

  return {
    ...currentDoc,
    theme: {
      ...templateDoc.theme,
      palette: { ...templateDoc.theme.palette },
      fonts: { ...templateDoc.theme.fonts },
      effects: { ...templateDoc.theme.effects },
      music: hasCustomMusic
        ? { ...currentDoc.theme.music }
        : templateDoc.theme.music
          ? { ...templateDoc.theme.music }
          : undefined,
    },
    sections: currentDoc.sections.map((section) => {
      const templateSec = templateSectionByType.get(section.type);
      const nextVariant = templateSec?.variant ?? section.variant;
      let nextData = section.data;

      if (
        section.type === "hero" &&
        templateSec &&
        !hasNonEmptyMediaString(section.data.coverPhotoUrl) &&
        hasNonEmptyMediaString(templateSec.data.coverPhotoUrl)
      ) {
        nextData = {
          ...section.data,
          coverPhotoUrl: templateSec.data.coverPhotoUrl,
        };
      } else if (
        section.type === "gallery" &&
        templateSec &&
        !hasPopulatedPhotos(section.data.photos) &&
        hasPopulatedPhotos(templateSec.data.photos)
      ) {
        nextData = {
          ...section.data,
          photos: [...(templateSec.data.photos as unknown[])],
        };
      }

      return {
        ...section,
        variant: nextVariant,
        data: nextData,
      };
    }),
    freeElements: [...currentDoc.freeElements],
    ...(nextSeo ? { seo: nextSeo } : {}),
  };
}
