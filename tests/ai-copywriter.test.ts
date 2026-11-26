import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvCacheForTests } from "@/lib/env";
import { generateWeddingCopy } from "@/modules/ai/copywriter";

describe("AI Wedding Copywriter Curated Fallback", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    resetEnvCacheForTests();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetEnvCacheForTests();
  });

  it("generates distinct Vietnamese curated fallback copy across romantic, formal, and playful tones when GEMINI_API_KEY is unset", async () => {
    const baseInput = {
      groomName: "Minh Quân",
      brideName: "Khánh Linh",
      venueName: "Gem Center Quận 1",
      weddingDate: "20/10/2026",
      meetingStory: "Quen nhau tại một buổi triển lãm ảnh ở Sài Gòn",
    };

    const romantic = await generateWeddingCopy({ ...baseInput, tone: "romantic" });
    const formal = await generateWeddingCopy({ ...baseInput, tone: "formal" });
    const playful = await generateWeddingCopy({ ...baseInput, tone: "playful" });

    for (const copy of [romantic, formal, playful]) {
      expect(copy.provider).toBe("curated-vn");
      expect(copy.headline).toContain("Minh Quân");
      expect(copy.headline).toContain("Khánh Linh");
      expect(copy.inviteMessage).toContain("Minh Quân");
      expect(copy.inviteMessage).toContain("Khánh Linh");
      expect(copy.inviteMessage).toContain("Gem Center Quận 1");
      expect(copy.inviteMessage).toContain("20/10/2026");
      expect(copy.milestones.length).toBe(3);
      expect(copy.milestones[0]?.caption).toContain(baseInput.meetingStory);
      expect(copy.milestones[2]?.caption).toContain("Gem Center Quận 1");
    }

    // Distinct copy across all 3 tones
    expect(new Set([romantic.badge, formal.badge, playful.badge]).size).toBe(3);
    expect(new Set([romantic.storyTitle, formal.storyTitle, playful.storyTitle]).size).toBe(3);
    expect(new Set([romantic.inviteMessage, formal.inviteMessage, playful.inviteMessage]).size).toBe(3);
    expect(new Set([romantic.wishPrompt, formal.wishPrompt, playful.wishPrompt]).size).toBe(3);
  });
});
