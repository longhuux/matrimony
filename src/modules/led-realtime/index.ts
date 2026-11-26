import crypto from "node:crypto";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { invitations, ledCheckins, ledSessions } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { getRedis } from "@/lib/redis";

/**
 * Curated list of Vietnamese/English profanity, slurs, and spam terms filtered from auto-airing.
 * Short ambiguous syllables that collide with common polite Vietnamese words (e.g. "các", "lớn", "đủ")
 * are excluded here; owners can add stricter custom words per LED session.
 */
export const DEFAULT_BLOCKED_WORDS: readonly string[] = [
  // English profanity
  "fuck",
  "fucking",
  "fucker",
  "motherfucker",
  "shit",
  "bullshit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "dickhead",
  "whore",
  "slut",
  // Vietnamese profanity & insults
  "du ma",
  "du me",
  "dit me",
  "dit cu",
  "dit bo",
  "con cac",
  "cai lon",
  "lon me",
  "dau buoi",
  "mat day",
  "vo hoc",
  "khon nan",
  "cho de",
  "thang cho",
  "con cho",
  "oc cho",
  "suc vat",
  "ngu ngoc",
  "dm",
  "dmm",
  "dcm",
  "dcmm",
  "vcl",
  "vkl",
  "vl",
  "clmm",
  "clgt",
  "ccmm",
  // Spam / betting / scam terms
  "casino",
  "nha cai",
  "ca cuoc",
  "tai xiu",
  "no hu",
  "soi cau",
  "lo de",
  "ban ca doi thuong",
  "cho vay",
  "vay von",
  "http://",
  "https://",
  "bit.ly",
  "tinyurl",
];

export type LedThemeMode = "aurora" | "velvet" | "starlight" | "crimson";

export interface LedCheckinCard {
  id: string;
  guestName: string;
  message: string;
  photoKey: string | null;
  photoUrl: string | null;
  status: "pending" | "approved" | "rejected";
  ticketNumber: string;
  createdAt: string;
  moderatedAt: string | null;
}

export type LedEventPayload =
  | {
      type: "checkin_approved";
      checkin: LedCheckinCard;
    }
  | {
      type: "checkin_removed";
      id: string;
    }
  | {
      type: "lucky_draw";
      winnerTicket: string;
      winnerName: string;
      drawnAt: string;
      checkinId?: string;
      photoUrl?: string | null;
    }
  | {
      type: "theme_changed";
      themeMode: LedThemeMode;
      autoApprove: boolean;
      isActive: boolean;
    };

export interface LedCheckinCounts {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

/**
 * Strips diacritics (NFD), converts đ/Đ -> d, lowercases, and collapses whitespace.
 */
export function normalizeForFilter(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripPunctuationForTokens(normalizedText: string): string {
  return normalizedText
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks whether input text contains any default or custom blocked word/phrase.
 */
export function containsBlockedWord(text: string, customBlockedWords?: string[]): boolean {
  const normalized = normalizeForFilter(text);
  if (!normalized) return false;

  const tokenized = stripPunctuationForTokens(normalized);
  const terms = [...DEFAULT_BLOCKED_WORDS, ...(customBlockedWords ?? [])];

  for (const rawTerm of terms) {
    const normalizedTerm = normalizeForFilter(rawTerm);
    if (!normalizedTerm) continue;

    // URLs / domains with punctuation (e.g., "http://", "bit.ly") match directly on normalized text.
    if (normalizedTerm.includes("://") || normalizedTerm.includes(".")) {
      if (normalized.includes(normalizedTerm)) {
        return true;
      }
    }

    const termTokens = stripPunctuationForTokens(normalizedTerm);
    if (!termTokens) continue;

    const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(termTokens)}(?:$|\\s)`);
    if (pattern.test(tokenized)) {
      return true;
    }
  }

  return false;
}

/**
 * Formats a 1-based ticket index into a padded lucky draw ticket string (e.g., "#0001").
 */
export function allocateLuckyTicket(seedIndex: number): string {
  const safeIndex = Math.max(0, Math.trunc(seedIndex));
  return `#${String(safeIndex).padStart(4, "0")}`;
}

/**
 * Picks a uniform random lucky draw winner from eligible candidates using crypto.randomInt.
 */
export function pickLuckyDrawWinner<T extends { ticketNumber: string; guestName: string }>(
  candidates: T[],
): T | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0] ?? null;
  const idx = crypto.randomInt(0, candidates.length);
  return candidates[idx] ?? null;
}

/**
 * Returns the Redis Pub/Sub channel name for a wedding LED stage slug.
 */
export function getLedChannel(slug: string): string {
  return `led:channel:${slug}`;
}

/**
 * Publishes an LED realtime event over Redis Pub/Sub without crashing callers if Redis is unavailable.
 */
export async function publishLedEvent(slug: string, event: LedEventPayload): Promise<void> {
  try {
    const redis = getRedis();
    if (redis.status === "wait") {
      await redis.connect();
    }
    await redis.publish(getLedChannel(slug), JSON.stringify(event));
  } catch (err) {
    console.warn(
      "[led-realtime] Failed to publish LED event:",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Sanitizes an invitation slug for safe filesystem subpaths.
 */
export function sanitizeLedSlug(slug: string): string {
  return slug.replace(/[^a-zA-Z0-9_-]/g, "");
}

/**
 * Resolves a stored LED photoKey into a public URL according to STORAGE_DRIVER.
 */
export function resolveLedPhotoPublicUrl(slug: string, photoKey: string | null): string | null {
  if (!photoKey) return null;
  const env = getEnv();
  if (env.STORAGE_DRIVER === "r2" && env.R2_PUBLIC_URL) {
    const base = env.R2_PUBLIC_URL.replace(/\/+$/, "");
    return `${base}/${photoKey.replace(/^\/+/, "")}`;
  }
  return `/api/led/${encodeURIComponent(slug)}/checkin/upload?key=${encodeURIComponent(photoKey)}`;
}

/**
 * Maps a led_checkins DB row into a public LED stage card payload.
 */
export function toLedCheckinCard(
  slug: string,
  row: {
    id: string;
    guestName: string;
    message: string;
    photoKey: string | null;
    status: "pending" | "approved" | "rejected";
    ticketNumber: string;
    createdAt: Date;
    moderatedAt: Date | null;
  },
): LedCheckinCard {
  return {
    id: row.id,
    guestName: row.guestName,
    message: row.message,
    photoKey: row.photoKey,
    photoUrl: resolveLedPhotoPublicUrl(slug, row.photoKey),
    status: row.status,
    ticketNumber: row.ticketNumber,
    createdAt: row.createdAt.toISOString(),
    moderatedAt: row.moderatedAt ? row.moderatedAt.toISOString() : null,
  };
}

/**
 * Applies a Redis fixed-window IP rate limit. Fails open when Redis is unreachable.
 */
export async function checkIpRateLimit(
  namespace: string,
  ipAddress: string | null,
  maxRequests: number,
  windowSeconds: number,
): Promise<boolean> {
  const clientKey = ipAddress?.trim() || "unknown";
  const redisKey = `rl:${namespace}:${clientKey}`;

  try {
    const redis = getRedis();
    if (redis.status === "wait") {
      await redis.connect();
    }
    const current = await redis.incr(redisKey);
    if (current === 1) {
      await redis.expire(redisKey, windowSeconds);
    }
    return current <= maxRequests;
  } catch (err) {
    console.warn(
      "[rate-limit] Redis unavailable, failing open:",
      err instanceof Error ? err.message : err,
    );
    return true;
  }
}

/**
 * Aggregates check-in counts by moderation status for an LED session.
 */
export async function getLedSessionCounts(ledSessionId: string): Promise<LedCheckinCounts> {
  const rows = await db
    .select({
      status: ledCheckins.status,
      value: count(),
    })
    .from(ledCheckins)
    .where(eq(ledCheckins.ledSessionId, ledSessionId))
    .groupBy(ledCheckins.status);

  const counts: LedCheckinCounts = { pending: 0, approved: 0, rejected: 0, total: 0 };
  for (const row of rows) {
    const num = Number(row.value);
    if (row.status === "pending") counts.pending = num;
    else if (row.status === "approved") counts.approved = num;
    else if (row.status === "rejected") counts.rejected = num;
    counts.total += num;
  }
  return counts;
}

export interface LedPublicFeed {
  ownerId: string;
  sessionId: string;
  invitation: {
    title: string;
    slug: string;
  };
  session: {
    themeMode: LedThemeMode;
    stageCode: string;
    autoApprove: boolean;
    isActive: boolean;
    luckyDrawState: {
      winnerTicket?: string;
      winnerName?: string;
      drawnAt?: string;
    };
  };
  approved: LedCheckinCard[];
}

/**
 * Fetches the public LED stage state and approved check-in cards for an invitation slug.
 */
export async function fetchLedPublicFeed(slug: string): Promise<LedPublicFeed | null> {
  const [target] = await db
    .select({
      ownerId: invitations.userId,
      title: invitations.title,
      slug: invitations.slug,
      session: ledSessions,
    })
    .from(invitations)
    .innerJoin(ledSessions, eq(ledSessions.invitationId, invitations.id))
    .where(eq(invitations.slug, slug))
    .limit(1);

  if (!target) return null;

  const approvedRows = await db
    .select()
    .from(ledCheckins)
    .where(and(eq(ledCheckins.ledSessionId, target.session.id), eq(ledCheckins.status, "approved")))
    .orderBy(desc(ledCheckins.moderatedAt), desc(ledCheckins.createdAt))
    .limit(200);

  return {
    ownerId: target.ownerId,
    sessionId: target.session.id,
    invitation: {
      title: target.title,
      slug: target.slug,
    },
    session: {
      themeMode: target.session.themeMode as LedThemeMode,
      stageCode: target.session.stageCode,
      autoApprove: target.session.autoApprove,
      isActive: target.session.isActive,
      luckyDrawState: target.session.luckyDrawState ?? {},
    },
    approved: approvedRows.map((row) => toLedCheckinCard(target.slug, row)),
  };
}
