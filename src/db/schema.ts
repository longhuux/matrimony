import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  InvitationDocumentV2,
  WeddingProfileData,
} from "@/modules/invitation-engine/schema";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const planTierEnum = pgEnum("plan_tier", ["free", "pro", "combo", "studio_pilot"]);
export const invitationStatusEnum = pgEnum("invitation_status", ["draft", "published", "paused"]);
export const rsvpStatusEnum = pgEnum("rsvp_status", ["pending", "attending", "declined"]);
export const ledCheckinStatusEnum = pgEnum("led_checkin_status", [
  "pending",
  "approved",
  "rejected",
]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "paid", "expired", "cancelled"]);
export const mediaKindEnum = pgEnum("media_kind", ["image", "audio", "font", "led_checkin"]);
export const mediaStatusEnum = pgEnum("media_status", ["pending", "confirmed"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name").notNull().default(""),
    avatarUrl: text("avatar_url"),
    emailVerified: boolean("email_verified").notNull().default(false),
    role: userRoleEnum("role").notNull().default("user"),
    plan: planTierEnum("plan").notNull().default("free"),
    planExpiresAt: timestamp("plan_expires_at", { withTimezone: true }),
    aiCredits: integer("ai_credits").notNull().default(3),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [check("users_ai_credits_non_negative", sql`${table.aiCredits} >= 0`)],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("auth_sessions_user_idx").on(table.userId),
    index("auth_sessions_expires_idx").on(table.expiresAt),
  ],
);

export const authOtpTokens = pgTable(
  "auth_otp_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("auth_otp_email_idx").on(table.email),
    index("auth_otp_email_created_idx").on(table.email, table.createdAt),
    index("auth_otp_expires_idx").on(table.expiresAt),
    check("auth_otp_attempts_non_negative", sql`${table.attempts} >= 0`),
  ],
);

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("oauth_provider_account_uidx").on(table.provider, table.providerAccountId),
    index("oauth_accounts_user_idx").on(table.userId),
  ],
);

export const weddingProfiles = pgTable(
  "wedding_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    groomInfo: jsonb("groom_info").$type<WeddingProfileData["groom"]>().notNull(),
    brideInfo: jsonb("bride_info").$type<WeddingProfileData["bride"]>().notNull(),
    events: jsonb("events").$type<WeddingProfileData["events"]>().notNull().default([]),
    bankAccounts: jsonb("bank_accounts")
      .$type<WeddingProfileData["bankAccounts"]>()
      .notNull()
      .default([]),
    photoKeys: jsonb("photo_keys").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("wedding_profiles_user_idx").on(table.userId)],
);

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("wedding"),
    tier: planTierEnum("tier").notNull().default("free"),
    thumbnailUrl: text("thumbnail_url").notNull().default(""),
    defaultDoc: jsonb("default_doc").$type<InvitationDocumentV2>().notNull(),
    usageCount: integer("usage_count").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [check("templates_usage_count_non_negative", sql`${table.usageCount} >= 0`)],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "set null" }),
    profileId: uuid("profile_id").references(() => weddingProfiles.id, { onDelete: "set null" }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    status: invitationStatusEnum("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    viewCount: integer("view_count").notNull().default(0),
    docJson: jsonb("doc_json").$type<InvitationDocumentV2>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("invitations_user_idx").on(table.userId),
    index("invitations_user_status_idx").on(table.userId, table.status),
    index("invitations_status_expires_idx").on(table.status, table.expiresAt),
    check("invitations_version_positive", sql`${table.version} >= 1`),
    check("invitations_view_count_non_negative", sql`${table.viewCount} >= 0`),
  ],
);

export const invitationVersions = pgTable(
  "invitation_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => invitations.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    source: text("source").notNull().default("manual"),
    docJson: jsonb("doc_json").$type<InvitationDocumentV2>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("invitation_versions_inv_idx").on(table.invitationId),
    uniqueIndex("invitation_versions_inv_ver_uidx").on(table.invitationId, table.version),
    check("invitation_versions_version_positive", sql`${table.version} >= 1`),
  ],
);

export const guests = pgTable(
  "guests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => invitations.id, { onDelete: "cascade" }),
    inviteCode: text("invite_code").notNull().unique(),
    fullName: text("full_name").notNull(),
    salutation: text("salutation").notNull().default("Bạn"),
    greeting: text("greeting").notNull().default(""),
    groupName: text("group_name").notNull().default("ban-be"),
    guestSide: text("guest_side").notNull().default("groom"),
    rsvpStatus: rsvpStatusEnum("rsvp_status").notNull().default("pending"),
    attendeeCount: integer("attendee_count").notNull().default(1),
    transportation: text("transportation").notNull().default("self"),
    note: text("note").notNull().default(""),
    isSent: boolean("is_sent").notNull().default(false),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    rsvpUpdatedAt: timestamp("rsvp_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("guests_invitation_idx").on(table.invitationId),
    check("guests_attendee_count_non_negative", sql`${table.attendeeCount} >= 0`),
  ],
);

export const wishes = pgTable(
  "wishes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => invitations.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id").references(() => guests.id, { onDelete: "set null" }),
    senderName: text("sender_name").notNull(),
    content: text("content").notNull(),
    isApproved: boolean("is_approved").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("wishes_invitation_idx").on(table.invitationId),
    index("wishes_inv_approved_created_idx").on(
      table.invitationId,
      table.isApproved,
      table.createdAt,
    ),
  ],
);

export const ledSessions = pgTable("led_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  invitationId: uuid("invitation_id")
    .notNull()
    .unique()
    .references(() => invitations.id, { onDelete: "cascade" }),
  stageCode: text("stage_code").notNull().unique(),
  themeMode: text("theme_mode").notNull().default("aurora"),
  autoApprove: boolean("auto_approve").notNull().default(false),
  blockedWords: jsonb("blocked_words").$type<string[]>().notNull().default([]),
  luckyDrawState: jsonb("lucky_draw_state")
    .$type<{ winnerTicket?: string; winnerName?: string; drawnAt?: string }>()
    .notNull()
    .default({}),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const ledCheckins = pgTable(
  "led_checkins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ledSessionId: uuid("led_session_id")
      .notNull()
      .references(() => ledSessions.id, { onDelete: "cascade" }),
    guestName: text("guest_name").notNull(),
    message: text("message").notNull().default(""),
    photoKey: text("photo_key"),
    status: ledCheckinStatusEnum("status").notNull().default("pending"),
    ticketNumber: text("ticket_number").notNull(),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("led_checkins_session_idx").on(table.ledSessionId),
    uniqueIndex("led_checkins_session_ticket_uidx").on(table.ledSessionId, table.ticketNumber),
    index("led_checkins_session_status_created_idx").on(
      table.ledSessionId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orderCode: text("order_code").notNull().unique(),
    sku: text("sku").notNull(),
    amountVnd: integer("amount_vnd").notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    provider: text("provider").notNull().default("payos"),
    checkoutUrl: text("checkout_url"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("orders_user_idx").on(table.userId),
    index("orders_status_expires_idx").on(table.status, table.expiresAt),
    check("orders_amount_non_negative", sql`${table.amountVnd} >= 0`),
  ],
);

export const paymentWebhooks = pgTable(
  "payment_webhooks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    providerTxId: text("provider_tx_id").notNull().unique(),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("payment_webhooks_order_idx").on(table.orderId)],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invitationId: uuid("invitation_id").references(() => invitations.id, { onDelete: "set null" }),
    kind: mediaKindEnum("kind").notNull(),
    status: mediaStatusEnum("status").notNull().default("pending"),
    r2Key: text("r2_key").notNull().unique(),
    publicUrl: text("public_url").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("media_assets_user_idx").on(table.userId),
    index("media_assets_user_kind_status_idx").on(table.userId, table.kind, table.status),
    index("media_assets_invitation_idx").on(table.invitationId),
    check("media_assets_size_positive", sql`${table.sizeBytes} > 0`),
  ],
);

export const aiCreditLedger = pgTable(
  "ai_credit_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason").notNull(),
    refId: text("ref_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_credit_ledger_user_idx").on(table.userId),
    check("ai_credit_ledger_balance_non_negative", sql`${table.balanceAfter} >= 0`),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type TemplateRow = typeof templates.$inferSelect;
export type InvitationRow = typeof invitations.$inferSelect;
