import { describe, expect, it } from "vitest";
import {
  bankAccountItemSchema,
  hydrateDocumentWithProfile,
  invitationDocumentV2Schema,
  personProfileSchema,
  weddingEventSchema,
  weddingProfileDataSchema,
} from "@/modules/invitation-engine/schema";

describe("Document Schema v2 & Profile Hydration", () => {
  const sampleDoc = invitationDocumentV2Schema.parse({
    schemaVersion: 2,
    theme: {
      templateId: "modern-ivory",
      palette: {
        primary: "#8B2635",
        secondary: "#F5ECE6",
        accent: "#C89D66",
        text: "#231B18",
        background: "#FFFCF9",
      },
      fonts: { heading: "Playfair Display", body: "Be Vietnam Pro" },
      effects: { opening: "envelope", particles: "petals", autoScrollSpeed: 0.04 },
    },
    sections: [
      {
        id: "sec_hero",
        type: "hero",
        variant: "editorial-full",
        visible: true,
        order: 0,
        data: {
          headline: "{{coupleNames}}",
          subtitle: "{{eventDate}} | {{eventDateLunar}}",
        },
      },
      {
        id: "sec_events",
        type: "events_calendar",
        variant: "ceremony-card",
        visible: true,
        order: 1,
        data: {
          venue: "{{venueName}}",
          groomParents: "{{groomParents}}",
        },
      },
    ],
    freeElements: [],
  });

  const sampleProfile = weddingProfileDataSchema.parse({
    groom: {
      fullName: "Nguyễn Văn Minh",
      shortName: "Minh",
      fatherName: "Ông Nguyễn Văn A",
      motherName: "Bà Trần Thị B",
      homeMapUrl: "https://maps.google.com/?q=nha-trai",
    },
    bride: {
      fullName: "Lê Ngọc Linh",
      shortName: "Linh",
      fatherName: "Ông Lê Văn C",
      motherName: "Bà Phạm Thị D",
      homeMapUrl: "https://maps.google.com/?q=nha-gai",
    },
    events: [
      {
        id: "ev_main",
        type: "thanh_hon",
        title: "Lễ Thành Hôn",
        date: "2026-02-17",
        welcomeTime: "10:15",
        time: "11:00",
        venueName: "Trung tâm Tiệc cưới Lotus",
        venueAddress: "Hà Nội",
        venueMapUrl: "https://maps.google.com/?q=lotus",
      },
    ],
    mainEventId: "ev_main",
    bankAccounts: [],
  });

  it("hydrates tokens cleanly without mutating the template document", () => {
    const hydrated = hydrateDocumentWithProfile(sampleDoc, sampleProfile);
    expect(hydrated.sections[0].data.headline).toBe("Minh & Linh");
    expect(hydrated.sections[0].data.subtitle).toContain("17/02/2026");
    expect(hydrated.sections[0].data.subtitle).toContain("Bính Ngọ");
    expect(hydrated.sections[1].data.venue).toBe("Trung tâm Tiệc cưới Lotus");
    expect(hydrated.sections[1].data.groomParents).toBe("Ông Nguyễn Văn A & Bà Trần Thị B");
    // Original doc remains untouched
    expect(sampleDoc.sections[0].data.headline).toBe("{{coupleNames}}");
  });

  it("hydrates welcomeTime, groomHomeMapLink, and brideHomeMapLink", () => {
    const docWithLinks = invitationDocumentV2Schema.parse({
      ...sampleDoc,
      sections: [
        ...sampleDoc.sections,
        {
          id: "sec_links",
          type: "couple",
          variant: "dual-family",
          visible: true,
          order: 2,
          data: {
            welcome: "{{welcomeTime}}",
            groomMap: "{{groomHomeMapLink}}",
            brideMap: "{{brideHomeMapLink}}",
          },
        },
      ],
    });

    const hydrated = hydrateDocumentWithProfile(docWithLinks, sampleProfile);
    expect(hydrated.sections[2].data.welcome).toBe("10:15");
    expect(hydrated.sections[2].data.groomMap).toBe("https://maps.google.com/?q=nha-trai");
    expect(hydrated.sections[2].data.brideMap).toBe("https://maps.google.com/?q=nha-gai");
  });

  it("leaves prototype pollution token keys untouched as literal strings", () => {
    const docWithProtoTokens = invitationDocumentV2Schema.parse({
      ...sampleDoc,
      sections: [
        {
          id: "sec_proto",
          type: "hero",
          variant: "editorial-full",
          visible: true,
          order: 0,
          data: {
            ctor: "{{constructor}}",
            proto: "{{__proto__}}",
            str: "{{toString}}",
            nested: ["{{constructor}}", { inner: "{{toString}}" }],
          },
        },
      ],
    });

    const hydrated = hydrateDocumentWithProfile(docWithProtoTokens, sampleProfile);
    expect(hydrated.sections[0].data.ctor).toBe("{{constructor}}");
    expect(hydrated.sections[0].data.proto).toBe("{{__proto__}}");
    expect(hydrated.sections[0].data.str).toBe("{{toString}}");
    expect(hydrated.sections[0].data.nested).toEqual(["{{constructor}}", { inner: "{{toString}}" }]);
  });

  it("rejects unsafe URL protocols and accepts valid https URLs or empty string", () => {
    for (const unsafeUrl of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"]) {
      expect(
        personProfileSchema.safeParse({
          fullName: "Nguyễn Văn Minh",
          shortName: "Minh",
          homeMapUrl: unsafeUrl,
        }).success,
      ).toBe(false);

      expect(
        weddingEventSchema.safeParse({
          id: "ev_1",
          type: "thanh_hon",
          title: "Lễ Thành Hôn",
          date: "2026-02-17",
          venueMapUrl: unsafeUrl,
        }).success,
      ).toBe(false);

      expect(
        invitationDocumentV2Schema.safeParse({
          ...sampleDoc,
          theme: {
            ...sampleDoc.theme,
            music: { url: unsafeUrl },
          },
        }).success,
      ).toBe(false);
    }

    for (const validUrl of ["https://maps.google.com/?q=hanoi", ""]) {
      expect(
        personProfileSchema.safeParse({
          fullName: "Nguyễn Văn Minh",
          shortName: "Minh",
          homeMapUrl: validUrl,
        }).success,
      ).toBe(true);

      expect(
        weddingEventSchema.safeParse({
          id: "ev_1",
          type: "thanh_hon",
          title: "Lễ Thành Hôn",
          date: "2026-02-17",
          venueMapUrl: validUrl,
        }).success,
      ).toBe(true);

      expect(
        invitationDocumentV2Schema.safeParse({
          ...sampleDoc,
          theme: {
            ...sampleDoc.theme,
            music: { url: validUrl },
          },
        }).success,
      ).toBe(true);
    }
  });

  it("rejects invalid calendar dates on weddingEventSchema", () => {
    expect(
      weddingEventSchema.safeParse({
        id: "ev_invalid",
        type: "thanh_hon",
        title: "Lễ Thành Hôn",
        date: "2026-02-31",
      }).success,
    ).toBe(false);

    expect(
      weddingEventSchema.safeParse({
        id: "ev_leap_invalid",
        type: "thanh_hon",
        title: "Lễ Thành Hôn",
        date: "2025-02-29",
      }).success,
    ).toBe(false);
  });

  it("enforces /^[a-zA-Z0-9]{4,30}$/ on bankAccountItemSchema.accountNumber", () => {
    expect(
      bankAccountItemSchema.safeParse({
        side: "groom",
        bankBin: "970436",
        bankShortName: "VCB",
        accountNumber: "VCB0123456789",
        accountHolder: "NGUYEN VAN MINH",
      }).success,
    ).toBe(true);

    for (const badAccount of ["123", "0123-4567", "0123 4567", "A".repeat(31)]) {
      expect(
        bankAccountItemSchema.safeParse({
          side: "groom",
          bankBin: "970436",
          bankShortName: "VCB",
          accountNumber: badAccount,
          accountHolder: "NGUYEN VAN MINH",
        }).success,
      ).toBe(false);
    }
  });
});
