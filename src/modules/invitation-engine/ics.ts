export interface BuildWeddingIcsInput {
  title: string;
  date: string;
  time?: string;
  venueName?: string;
  venueAddress?: string;
  description?: string;
  url?: string;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function parseDateParts(rawDate: string): { year: number; month: number; day: number } | null {
  const trimmed = rawDate.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    };
  }
  const vnMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (vnMatch) {
    return {
      year: Number(vnMatch[3]),
      month: Number(vnMatch[2]),
      day: Number(vnMatch[1]),
    };
  }
  return null;
}

function parseTimeParts(rawTime?: string): { hour: number; minute: number } {
  if (!rawTime) return { hour: 11, minute: 0 };
  const match = /^(\d{1,2}):(\d{2})/.exec(rawTime.trim());
  if (!match) return { hour: 11, minute: 0 };
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return { hour, minute };
}

function formatUtcTimestamp(date: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, "0");
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}T` +
    `${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}` +
    `${pad(date.getUTCSeconds())}Z`
  );
}

/**
 * Generates an RFC 5545 compliant iCalendar (.ics) string for a Vietnamese wedding ceremony.
 * Interprets input local time in Asia/Ho_Chi_Minh (UTC+7) and encodes a 3-hour window in UTC.
 */
export function buildWeddingIcs(input: BuildWeddingIcsInput): string {
  const parsedDate = parseDateParts(input.date);
  const now = new Date();
  const { hour, minute } = parseTimeParts(input.time);

  // Convert Asia/Ho_Chi_Minh (UTC+7) local wall time to UTC milliseconds
  const startMs = parsedDate
    ? Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day, hour - 7, minute, 0)
    : now.getTime();
  const endMs = startMs + 3 * 60 * 60 * 1000;

  const dtStamp = formatUtcTimestamp(now);
  const dtStart = formatUtcTimestamp(new Date(startMs));
  const dtEnd = formatUtcTimestamp(new Date(endMs));

  const locationParts = [input.venueName?.trim(), input.venueAddress?.trim()].filter(Boolean);
  const location = locationParts.join(" — ");
  const uidSlug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Matrimony.vn//Wedding Invitation//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uidSlug || "matrimony"}-${dtStart}@matrimony.vn`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(input.title.trim() || "Lễ Cưới")}`,
  ];

  if (location) {
    lines.push(`LOCATION:${escapeIcsText(location)}`);
  }
  if (input.description?.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(input.description.trim())}`);
  }
  if (input.url?.trim()) {
    lines.push(`URL:${input.url.trim()}`);
  }

  lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR");

  return `${lines.join("\r\n")}\r\n`;
}
