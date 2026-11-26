import { describe, expect, it } from "vitest";
import { invitationDocumentV2Schema, type InvitationDocumentV2 } from "@/modules/invitation-engine/schema";
import {
  applyTemplateToDocument,
  FLAGSHIP_TEMPLATES,
  getTemplateBySlug,
} from "@/modules/invitation-engine/templates";

describe("Flagship Templates & Template Switching", () => {
  it("exposes 8 unique flagship templates that all pass invitationDocumentV2Schema.parse", () => {
    expect(FLAGSHIP_TEMPLATES).toHaveLength(8);

    const slugs = new Set<string>();
    for (const template of FLAGSHIP_TEMPLATES) {
      expect(slugs.has(template.slug)).toBe(false);
      slugs.add(template.slug);

      const parsed = invitationDocumentV2Schema.parse(template.defaultDoc);
      expect(parsed.schemaVersion).toBe(2);
      expect(parsed.theme.templateId).toBe(template.slug);
      expect(parsed.sections.length).toBeGreaterThanOrEqual(7);
      expect(getTemplateBySlug(template.slug)).toBe(template);
    }

    expect(getTemplateBySlug("non-existent-template")).toBeUndefined();
  });

  it("switches palette, fonts, effects, templateId, and variants while preserving section data, visibility, order, seo, freeElements, and custom music", () => {
    const sourceTemplate = getTemplateBySlug("modern-ivory");
    const targetTemplate = getTemplateBySlug("midnight-starlight");
    expect(sourceTemplate).toBeDefined();
    expect(targetTemplate).toBeDefined();
    if (!sourceTemplate || !targetTemplate) return;

    const customFreeElement = {
      id: "overlay_heart_1",
      kind: "sticker" as const,
      xPercent: 42,
      yPercent: 18,
      widthPercent: 15,
      rotation: -12,
      zIndex: 25,
      props: { stickerId: "gold-heart" },
    };

    const customSeo = {
      title: "Thiệp Cưới Minh & Linh",
      description: "Trân trọng kính mời tới dự lễ thành hôn của chúng mình.",
      coverPhotoUrl: "https://cdn.matrimony.vn/couple/cover.jpg",
    };

    const customMusic = {
      trackId: "custom-upload",
      title: "Bản Nhạc Của Tụi Mình",
      url: "/api/media/minh-linh/song.mp3",
    };

    const reorderedSections = sourceTemplate.defaultDoc.sections.map((section, idx) => {
      if (section.type === "hero") {
        return {
          ...section,
          order: 1,
          visible: true,
          data: {
            ...section.data,
            headline: "Minh & Linh",
            subtitle: "17/02/2026 • Mùng 1 Tết Bính Ngọ",
            coverPhotoUrl: "/api/media/hero.jpg",
          },
        };
      }
      if (section.type === "vietqr_gift") {
        return {
          ...section,
          order: 0,
          visible: false,
          data: {
            title: "Gửi Lời Chúc & Mừng Cưới",
            bankAccounts: [{ bankBin: "970436", accountNumber: "0123456789" }],
          },
        };
      }
      return {
        ...section,
        order: idx + 2,
      };
    });

    const currentDoc: InvitationDocumentV2 = {
      ...sourceTemplate.defaultDoc,
      theme: {
        ...sourceTemplate.defaultDoc.theme,
        music: customMusic,
      },
      sections: reorderedSections,
      freeElements: [customFreeElement],
      seo: customSeo,
    };

    const switched = applyTemplateToDocument(currentDoc, targetTemplate.defaultDoc);

    expect(invitationDocumentV2Schema.safeParse(switched).success).toBe(true);
    expect(switched.theme.templateId).toBe(targetTemplate.slug);
    expect(switched.theme.palette).toEqual(targetTemplate.defaultDoc.theme.palette);
    expect(switched.theme.fonts).toEqual(targetTemplate.defaultDoc.theme.fonts);
    expect(switched.theme.effects).toEqual(targetTemplate.defaultDoc.theme.effects);
    expect(switched.theme.music).toEqual(customMusic);

    expect(switched.freeElements).toEqual([customFreeElement]);
    expect(switched.seo).toEqual(customSeo);

    expect(switched.sections).toHaveLength(currentDoc.sections.length);
    for (let i = 0; i < currentDoc.sections.length; i += 1) {
      const before = currentDoc.sections[i];
      const after = switched.sections[i];
      const targetSec = targetTemplate.defaultDoc.sections.find((s) => s.type === before.type);

      expect(after.id).toBe(before.id);
      expect(after.type).toBe(before.type);
      expect(after.data).toEqual(before.data);
      expect(after.visible).toBe(before.visible);
      expect(after.order).toBe(before.order);
      expect(after.variant).toBe(targetSec ? targetSec.variant : before.variant);
    }
  });

  it("adopts target template music when current document has no custom music configured", () => {
    const sourceTemplate = getTemplateBySlug("modern-ivory");
    const targetTemplate = getTemplateBySlug("royal-crimson");
    expect(sourceTemplate).toBeDefined();
    expect(targetTemplate).toBeDefined();
    if (!sourceTemplate || !targetTemplate) return;

    const currentDocWithoutMusic: InvitationDocumentV2 = {
      ...sourceTemplate.defaultDoc,
      theme: {
        ...sourceTemplate.defaultDoc.theme,
        music: {
          trackId: "   ",
          url: "",
          title: "",
        },
      },
    };

    const switched = applyTemplateToDocument(currentDocWithoutMusic, targetTemplate.defaultDoc);
    expect(switched.theme.music).toEqual(targetTemplate.defaultDoc.theme.music);
  });
});
