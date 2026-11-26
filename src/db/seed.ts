import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import {
  guests,
  invitations,
  ledCheckins,
  ledSessions,
  templates,
  users,
  weddingProfiles,
  wishes,
} from "./schema";
import {
  hydrateDocumentWithProfile,
  weddingProfileDataSchema,
} from "@/modules/invitation-engine/schema";
import {
  FLAGSHIP_TEMPLATES,
  getTemplateBySlug,
} from "@/modules/invitation-engine/templates";

function loadLocalEnv(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadLocalEnv();

async function seedTemplates(): Promise<Map<string, string>> {
  const templateIds = new Map<string, string>();
  for (const tpl of FLAGSHIP_TEMPLATES) {
    const [row] = await db
      .insert(templates)
      .values({
        slug: tpl.slug,
        name: tpl.name,
        description: tpl.description,
        category: tpl.category,
        tier: tpl.tier,
        thumbnailUrl: tpl.thumbnailUrl,
        defaultDoc: tpl.defaultDoc,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: templates.slug,
        set: {
          name: tpl.name,
          description: tpl.description,
          category: tpl.category,
          tier: tpl.tier,
          thumbnailUrl: tpl.thumbnailUrl,
          defaultDoc: tpl.defaultDoc,
          isActive: true,
          updatedAt: new Date(),
        },
      })
      .returning({ id: templates.id, slug: templates.slug });

    if (row) {
      templateIds.set(row.slug, row.id);
    }
  }
  return templateIds;
}

const DEMO_COVER_PHOTO = "/images/wedding/hero-couple.webp";
const DEMO_GALLERY_PHOTOS = [
  "/images/wedding/hero-couple.webp",
  "/images/wedding/stationery-detail.webp",
  "/images/wedding/champagne-heritage.webp",
  "/images/wedding/dalat-garden.webp",
  "/images/wedding/midnight-starlight.webp",
];

async function seedDemoShowcase(templateIds: Map<string, string>): Promise<void> {
  const demoEmail = "demo@matrimony.vn";
  const [demoUser] = await db
    .insert(users)
    .values({
      email: demoEmail,
      name: "Nguyễn Gia Huy & Trần Minh Anh",
      emailVerified: true,
      role: "user",
      plan: "pro",
      aiCredits: 25,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: "Nguyễn Gia Huy & Trần Minh Anh",
        emailVerified: true,
        plan: "pro",
        updatedAt: new Date(),
      },
    })
    .returning();

  const demoProfileData = weddingProfileDataSchema.parse({
    groom: {
      fullName: "Nguyễn Gia Huy",
      shortName: "Gia Huy",
      phone: "0901234567",
      fatherName: "Ông Nguyễn Văn Thành",
      motherName: "Bà Lê Thị Hồng",
      homeAddress: "24 Trần Hưng Đạo, Quận 5, TP. Hồ Chí Minh",
      homeMapUrl: "https://maps.google.com/?q=24+Tran+Hung+Dao+Quan+5+HCMC",
    },
    bride: {
      fullName: "Trần Minh Anh",
      shortName: "Minh Anh",
      phone: "0907654321",
      fatherName: "Ông Trần Quốc Tuấn",
      motherName: "Bà Phạm Thanh Mai",
      homeAddress: "48 Nguyễn Du, Quận 1, TP. Hồ Chí Minh",
      homeMapUrl: "https://maps.google.com/?q=48+Nguyen+Du+Quan+1+HCMC",
    },
    events: [
      {
        id: "ev_vu_quy",
        type: "vu_quy",
        title: "Lễ Vu Quy",
        date: "2026-10-18",
        welcomeTime: "08:00",
        time: "08:30",
        venueName: "Tư gia Nhà Gái",
        venueAddress: "48 Nguyễn Du, Bến Nghé, Quận 1, TP. Hồ Chí Minh",
        venueMapUrl: "https://maps.google.com/?q=48+Nguyen+Du+Quan+1+HCMC",
      },
      {
        id: "ev_thanh_hon",
        type: "tiec_cuoi",
        title: "Tiệc Cưới Thành Hôn",
        date: "2026-10-25",
        welcomeTime: "17:30",
        time: "18:30",
        venueName: "Trung tâm Hội nghị Gem Center",
        venueAddress: "8 Nguyễn Bỉnh Khiêm, Đa Kao, Quận 1, TP. Hồ Chí Minh",
        venueMapUrl: "https://maps.google.com/?q=Gem+Center+Ho+Chi+Minh",
      },
    ],
    mainEventId: "ev_thanh_hon",
    bankAccounts: [
      {
        side: "groom",
        bankBin: "970436",
        bankShortName: "VCB",
        accountNumber: "0071001234567",
        accountHolder: "NGUYEN GIA HUY",
      },
      {
        side: "bride",
        bankBin: "970407",
        bankShortName: "TCB",
        accountNumber: "19036888999001",
        accountHolder: "TRAN MINH ANH",
      },
    ],
  });

  const profileName = "Hồ sơ cưới Gia Huy & Minh Anh";
  const existingProfile = await db
    .select({ id: weddingProfiles.id })
    .from(weddingProfiles)
    .where(
      and(
        eq(weddingProfiles.userId, demoUser.id),
        eq(weddingProfiles.name, profileName),
      ),
    )
    .limit(1);

  let profileId: string;
  if (existingProfile[0]) {
    profileId = existingProfile[0].id;
    await db
      .update(weddingProfiles)
      .set({
        groomInfo: demoProfileData.groom,
        brideInfo: demoProfileData.bride,
        events: demoProfileData.events,
        bankAccounts: demoProfileData.bankAccounts,
        photoKeys: DEMO_GALLERY_PHOTOS,
        updatedAt: new Date(),
      })
      .where(eq(weddingProfiles.id, profileId));
  } else {
    const [insertedProfile] = await db
      .insert(weddingProfiles)
      .values({
        userId: demoUser.id,
        name: profileName,
        groomInfo: demoProfileData.groom,
        brideInfo: demoProfileData.bride,
        events: demoProfileData.events,
        bankAccounts: demoProfileData.bankAccounts,
        photoKeys: DEMO_GALLERY_PHOTOS,
      })
      .returning({ id: weddingProfiles.id });
    profileId = insertedProfile.id;
  }

  const baseTpl = getTemplateBySlug("modern-ivory") ?? FLAGSHIP_TEMPLATES[0];
  const hydratedBaseDoc = hydrateDocumentWithProfile(baseTpl.defaultDoc, demoProfileData);
  const hydratedDoc = {
    ...hydratedBaseDoc,
    sections: hydratedBaseDoc.sections.map((section) => {
      if (section.type === "hero") {
        return {
          ...section,
          data: {
            ...section.data,
            coverPhotoUrl: DEMO_COVER_PHOTO,
          },
        };
      }
      if (section.type === "gallery") {
        return {
          ...section,
          data: {
            ...section.data,
            photos: [...DEMO_GALLERY_PHOTOS],
          },
        };
      }
      return section;
    }),
    seo: {
      title: "Thiệp Cưới Nguyễn Gia Huy & Trần Minh Anh — 25/10/2026",
      description:
        "Trân trọng kính mời bạn đến chung vui trong lễ Thành Hôn của Gia Huy & Minh Anh tại Gem Center, TP. Hồ Chí Minh.",
      coverPhotoUrl: DEMO_COVER_PHOTO,
    },
  };

  const invitationSlug = "minh-anh-gia-huy";
  const [demoInvitation] = await db
    .insert(invitations)
    .values({
      userId: demoUser.id,
      templateId: templateIds.get("modern-ivory") ?? null,
      profileId,
      slug: invitationSlug,
      title: "Thiệp Cưới Gia Huy & Minh Anh",
      status: "published",
      version: 1,
      docJson: hydratedDoc,
      publishedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: invitations.slug,
      set: {
        userId: demoUser.id,
        templateId: templateIds.get("modern-ivory") ?? null,
        profileId,
        title: "Thiệp Cưới Gia Huy & Minh Anh",
        status: "published",
        docJson: hydratedDoc,
        updatedAt: new Date(),
      },
    })
    .returning();

  const demoGuests = [
    {
      inviteCode: "VIP001",
      fullName: "Nguyễn Hoàng Nam",
      salutation: "Anh",
      greeting:
        "Trân trọng kính mời anh Hoàng Nam đến chung vui cùng hai gia đình trong ngày trọng đại!",
      groupName: "dong-nghiep",
      guestSide: "groom",
      rsvpStatus: "attending" as const,
      attendeeCount: 2,
      transportation: "self",
      note: "Chúc mừng đôi uyên ương trăm năm hạnh phúc!",
      isSent: true,
    },
    {
      inviteCode: "BAN002",
      fullName: "Lê Thảo Vy",
      salutation: "Bạn",
      greeting:
        "Thân mời Thảo Vy đến dự tiệc tối và lưu lại những khoảnh khắc thật đẹp cùng Minh Anh & Gia Huy!",
      groupName: "ban-than",
      guestSide: "bride",
      rsvpStatus: "attending" as const,
      attendeeCount: 1,
      transportation: "self",
      note: "Hẹn gặp hai bạn tại Gem Center!",
      isSent: true,
    },
    {
      inviteCode: "GIA003",
      fullName: "Trần Quốc Bảo",
      salutation: "Chú",
      greeting:
        "Kính mời chú Quốc Bảo cùng gia đình thu xếp thời gian đến dự lễ Thành Hôn của hai cháu.",
      groupName: "ho-hang",
      guestSide: "bride",
      rsvpStatus: "pending" as const,
      attendeeCount: 2,
      transportation: "pickup",
      note: "",
      isSent: true,
    },
  ];

  for (const guest of demoGuests) {
    await db
      .insert(guests)
      .values({
        invitationId: demoInvitation.id,
        ...guest,
      })
      .onConflictDoUpdate({
        target: guests.inviteCode,
        set: {
          invitationId: demoInvitation.id,
          fullName: guest.fullName,
          salutation: guest.salutation,
          greeting: guest.greeting,
          groupName: guest.groupName,
          guestSide: guest.guestSide,
          rsvpStatus: guest.rsvpStatus,
          attendeeCount: guest.attendeeCount,
          transportation: guest.transportation,
          note: guest.note,
          isSent: guest.isSent,
          updatedAt: new Date(),
        },
      });
  }

  const demoWishes = [
    {
      senderName: "Anh Nguyễn Hoàng Nam",
      content:
        "Chúc Gia Huy & Minh Anh trăm năm hạnh phúc, luôn giữ mãi nụ cười rạng rỡ như ngày đầu!",
    },
    {
      senderName: "Lê Thảo Vy",
      content:
        "Thương chúc cô dâu Minh Anh thật xinh đẹp và mãi bình yên bên chú rể Gia Huy nhé!",
    },
    {
      senderName: "Phạm Minh Tuấn",
      content:
        "Chúc hai bạn một hành trình hôn nhân ngập tràn yêu thương và những kỷ niệm đáng nhớ.",
    },
    {
      senderName: "Đặng Ngọc Mai",
      content:
        "Happy Wedding! Hẹn sớm gặp lại hai vợ chồng tại sảnh tiệc Gem Center!",
    },
  ];

  const existingWishes = await db
    .select({ senderName: wishes.senderName })
    .from(wishes)
    .where(eq(wishes.invitationId, demoInvitation.id));
  const existingSenders = new Set(existingWishes.map((w) => w.senderName));

  for (const wish of demoWishes) {
    if (!existingSenders.has(wish.senderName)) {
      await db.insert(wishes).values({
        invitationId: demoInvitation.id,
        senderName: wish.senderName,
        content: wish.content,
        isApproved: true,
      });
    }
  }

  const [demoLedSession] = await db
    .insert(ledSessions)
    .values({
      invitationId: demoInvitation.id,
      stageCode: "MINH-ANH-2026",
      themeMode: "obsidian-gold",
      autoApprove: false,
      blockedWords: [],
      luckyDrawState: {},
      isActive: true,
    })
    .onConflictDoUpdate({
      target: ledSessions.invitationId,
      set: {
        stageCode: "MINH-ANH-2026",
        themeMode: "obsidian-gold",
        isActive: true,
        updatedAt: new Date(),
      },
    })
    .returning();

  const demoCheckins = [
    {
      ticketNumber: "#0001",
      guestName: "Nguyễn Hoàng Nam",
      message: "Chúc Gia Huy & Minh Anh trăm năm hạnh phúc viên mãn!",
    },
    {
      ticketNumber: "#0002",
      guestName: "Lê Thảo Vy",
      message: "Cô dâu hôm nay đẹp xuất sắc luôn, chúc mừng hai bạn!",
    },
    {
      ticketNumber: "#0003",
      guestName: "Phạm Minh Tuấn",
      message: "Chúc đôi bạn trẻ sớm đón tin vui và luôn đồng hành bên nhau!",
    },
    {
      ticketNumber: "#0004",
      guestName: "Đặng Ngọc Mai",
      message: "Không khí tiệc cưới thật ấm áp và sang trọng, Happy Wedding!",
    },
  ];

  for (const item of demoCheckins) {
    await db
      .insert(ledCheckins)
      .values({
        ledSessionId: demoLedSession.id,
        guestName: item.guestName,
        message: item.message,
        ticketNumber: item.ticketNumber,
        status: "approved",
        moderatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [ledCheckins.ledSessionId, ledCheckins.ticketNumber],
        set: {
          guestName: item.guestName,
          message: item.message,
          status: "approved",
          moderatedAt: new Date(),
        },
      });
  }
}

async function seed(): Promise<void> {
  const templateIds = await seedTemplates();
  await seedDemoShowcase(templateIds);
  console.log(
    `Seeded ${FLAGSHIP_TEMPLATES.length} wedding templates and demo showcase (/s/minh-anh-gia-huy).`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
