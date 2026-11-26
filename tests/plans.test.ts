import { describe, expect, it } from "vitest";
import {
  canCreateInvitation,
  canUploadMedia,
  getEffectivePlan,
  getPlanConfig,
  PLAN_CONFIGS,
} from "@/modules/billing/plans";

describe("Billing Plans & Quotas", () => {
  it("keeps Free tier generous with 5000 views and direct 0% fee VietQR", () => {
    expect(PLAN_CONFIGS.free.maxViews).toBe(5000);
    expect(PLAN_CONFIGS.free.features.bankQrDirect).toBe(true);
    expect(PLAN_CONFIGS.free.ledCheckinLimit).toBe(10);
  });

  it("prices Pro under CineLove Basic while unlocking premium features", () => {
    expect(PLAN_CONFIGS.pro.priceVnd).toBe(149_000);
    expect(PLAN_CONFIGS.pro.features.dynamicZaloOg).toBe(true);
    expect(PLAN_CONFIGS.pro.features.removeWatermark).toBe(true);
    expect(PLAN_CONFIGS.combo.features.ledLuckyDraw).toBe(true);
  });

  it("enforces invitation and media upload quotas properly", () => {
    expect(canCreateInvitation("free", 0)).toBe(true);
    expect(canCreateInvitation("free", 1)).toBe(false);
    expect(canCreateInvitation("pro", 2)).toBe(true);
    expect(canUploadMedia("free", 19)).toBe(true);
    expect(canUploadMedia("free", 20)).toBe(false);
    expect(getPlanConfig("unknown").sku).toBe("free");
  });

  it("resolves effective plan tier with expiration and unknown-tier fallbacks", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const past = new Date("2026-05-31T23:59:59.000Z");
    const future = new Date("2026-07-01T00:00:00.000Z");

    expect(getEffectivePlan("pro", past, now)).toBe("free");
    expect(getEffectivePlan("combo", now, now)).toBe("free");
    expect(getEffectivePlan("pro", future, now)).toBe("pro");
    expect(getEffectivePlan("combo", null, now)).toBe("combo");
    expect(getEffectivePlan("studio_pilot", undefined, now)).toBe("studio_pilot");
    expect(getEffectivePlan("free", past, now)).toBe("free");
    expect(getEffectivePlan("unknown_tier", future, now)).toBe("free");
    expect(getEffectivePlan(null, future, now)).toBe("free");
    expect(getEffectivePlan(undefined, future, now)).toBe("free");
  });
});
