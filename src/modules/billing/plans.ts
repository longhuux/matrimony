export type PlanTier = "free" | "pro" | "combo" | "studio_pilot";

export interface PlanConfig {
  sku: PlanTier;
  name: string;
  priceVnd: number;
  durationMonths: number;
  maxWebsites: number;
  maxImages: number;
  maxViews: number; // -1 = unlimited
  maxGuestsPerInvitation: number; // -1 = unlimited
  aiCreditsGrant: number;
  ledCheckinLimit: number; // -1 = unlimited
  features: {
    bankQrDirect: boolean;
    removeWatermark: boolean;
    premiumTemplates: boolean;
    dynamicZaloOg: boolean;
    customMusic: boolean;
    customFont: boolean;
    ledRealtime: boolean;
    ledLuckyDraw: boolean;
  };
}

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  free: {
    sku: "free",
    name: "Miễn phí",
    priceVnd: 0,
    durationMonths: 6,
    maxWebsites: 1,
    maxImages: 20,
    maxViews: 5000,
    maxGuestsPerInvitation: 30,
    aiCreditsGrant: 3,
    ledCheckinLimit: 10,
    features: {
      bankQrDirect: true,
      removeWatermark: false,
      premiumTemplates: false,
      dynamicZaloOg: false,
      customMusic: false,
      customFont: false,
      ledRealtime: true,
      ledLuckyDraw: false,
    },
  },
  pro: {
    sku: "pro",
    name: "Pro",
    priceVnd: 149_000,
    durationMonths: 36,
    maxWebsites: 3,
    maxImages: 100,
    maxViews: 50_000,
    maxGuestsPerInvitation: -1,
    aiCreditsGrant: 15,
    ledCheckinLimit: 100,
    features: {
      bankQrDirect: true,
      removeWatermark: true,
      premiumTemplates: true,
      dynamicZaloOg: true,
      customMusic: true,
      customFont: true,
      ledRealtime: true,
      ledLuckyDraw: false,
    },
  },
  combo: {
    sku: "combo",
    name: "Combo Full Đám Cưới",
    priceVnd: 249_000,
    durationMonths: 60,
    maxWebsites: 5,
    maxImages: 200,
    maxViews: -1,
    maxGuestsPerInvitation: -1,
    aiCreditsGrant: 30,
    ledCheckinLimit: -1,
    features: {
      bankQrDirect: true,
      removeWatermark: true,
      premiumTemplates: true,
      dynamicZaloOg: true,
      customMusic: true,
      customFont: true,
      ledRealtime: true,
      ledLuckyDraw: true,
    },
  },
  studio_pilot: {
    sku: "studio_pilot",
    name: "Pilot Studio (5 thiệp Pro + LED)",
    priceVnd: 499_000,
    durationMonths: 36,
    maxWebsites: 5,
    maxImages: 750,
    maxViews: -1,
    maxGuestsPerInvitation: -1,
    aiCreditsGrant: 100,
    ledCheckinLimit: -1,
    features: {
      bankQrDirect: true,
      removeWatermark: true,
      premiumTemplates: true,
      dynamicZaloOg: true,
      customMusic: true,
      customFont: true,
      ledRealtime: true,
      ledLuckyDraw: true,
    },
  },
};

/**
 * Resolves the user's effective plan tier, falling back to free when expired or unrecognized.
 */
export function getEffectivePlan(
  plan: string | null | undefined,
  planExpiresAt?: Date | null,
  now: Date = new Date(),
): PlanTier {
  if (!plan || !(plan in PLAN_CONFIGS)) {
    return "free";
  }
  if (plan !== "free" && planExpiresAt && planExpiresAt.getTime() <= now.getTime()) {
    return "free";
  }
  return plan as PlanTier;
}

export function getPlanConfig(plan: string | null | undefined): PlanConfig {
  if (plan && plan in PLAN_CONFIGS) {
    return PLAN_CONFIGS[plan as PlanTier];
  }
  return PLAN_CONFIGS.free;
}

export function canCreateInvitation(plan: string, currentCount: number): boolean {
  const cfg = getPlanConfig(plan);
  return cfg.maxWebsites === -1 || currentCount < cfg.maxWebsites;
}

export function canUploadMedia(plan: string, currentImageCount: number): boolean {
  const cfg = getPlanConfig(plan);
  return cfg.maxImages === -1 || currentImageCount < cfg.maxImages;
}
