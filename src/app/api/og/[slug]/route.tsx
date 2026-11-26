import { and, eq } from "drizzle-orm";
import { ImageResponse } from "next/og";
import { db } from "@/db";
import { guests, invitations, weddingProfiles } from "@/db/schema";
import { isoDateToLunar } from "@/modules/invitation-engine/lunar";
import { hydrateDocumentWithProfile } from "@/modules/invitation-engine/schema";

export const runtime = "nodejs";

const OG_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=3600";

function cleanPlaceholder(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed || /\{\{[^}]+\}\}/.test(trimmed)) return fallback;
  return trimmed;
}

function renderFallbackOg(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#FFFCF9",
          padding: 36,
          fontFamily: "serif",
          color: "#231B18",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            border: "2px solid #C89D66",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              border: "1px solid #8B2635",
              padding: 48,
            }}
          >
            <div
              style={{
                fontSize: 20,
                letterSpacing: 6,
                textTransform: "uppercase",
                color: "#8B2635",
                marginBottom: 18,
              }}
            >
              MATRIMONY • THIỆP CƯỚI ĐIỆN TỬ
            </div>
            <div
              style={{
                fontSize: 54,
                fontWeight: 700,
                color: "#231B18",
                textAlign: "center",
              }}
            >
              Trân trọng báo tin ngày chung đôi
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      status: 404,
      headers: {
        "Cache-Control": OG_CACHE_CONTROL,
      },
    },
  );
}

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<ImageResponse> {
  const { slug } = await context.params;
  const [invitation] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.slug, slug))
    .limit(1);

  if (!invitation) {
    return renderFallbackOg();
  }

  let doc = invitation.docJson;
  let fallbackDateSubtitle = "";

  if (invitation.profileId) {
    const [profile] = await db
      .select()
      .from(weddingProfiles)
      .where(eq(weddingProfiles.id, invitation.profileId))
      .limit(1);

    if (profile) {
      doc = hydrateDocumentWithProfile(doc, {
        groom: profile.groomInfo,
        bride: profile.brideInfo,
        events: profile.events,
        bankAccounts: profile.bankAccounts,
      });

      const firstEvent = profile.events[0];
      if (firstEvent) {
        const solar = firstEvent.date.split("-").reverse().join("/");
        const lunar = isoDateToLunar(firstEvent.date);
        fallbackDateSubtitle = lunar ? `${solar} • ${lunar.formatted}` : solar;
      }
    }
  }

  const guestCode = new URL(req.url).searchParams.get("guest")?.trim();
  let matchedGuest: { salutation: string; fullName: string } | null = null;
  if (guestCode) {
    const [guest] = await db
      .select({
        salutation: guests.salutation,
        fullName: guests.fullName,
      })
      .from(guests)
      .where(and(eq(guests.invitationId, invitation.id), eq(guests.inviteCode, guestCode)))
      .limit(1);
    if (guest) {
      matchedGuest = guest;
    }
  }

  const palette = doc.theme?.palette ?? {
    background: "#FFFCF9",
    primary: "#8B2635",
    accent: "#C89D66",
    text: "#231B18",
    secondary: "#F5ECE6",
  };

  const bg = palette.background || "#FFFCF9";
  const primary = palette.primary || "#8B2635";
  const accent = palette.accent || "#C89D66";
  const textColor = palette.text || "#231B18";
  const secondary = palette.secondary || "#F5ECE6";

  const heroSection = doc.sections.find((s) => s.type === "hero");
  const eventsSection = doc.sections.find((s) => s.type === "events_calendar");

  const badge = cleanPlaceholder(heroSection?.data?.badge, "TRÂN TRỌNG BÁO TIN");
  const headline = cleanPlaceholder(heroSection?.data?.headline, invitation.title);

  const eventDate = cleanPlaceholder(eventsSection?.data?.eventDate);
  const eventDateLunar = cleanPlaceholder(eventsSection?.data?.eventDateLunar);
  const heroSubtitle = cleanPlaceholder(heroSection?.data?.subtitle);
  const venueName = cleanPlaceholder(eventsSection?.data?.venueName);

  const dateSubtitle =
    heroSubtitle ||
    [eventDate, eventDateLunar].filter(Boolean).join(" • ") ||
    fallbackDateSubtitle ||
    "Hân hạnh đón tiếp gia đình và bạn bè thân thiết";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: bg,
          padding: 32,
          color: textColor,
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            padding: 12,
            border: `2px solid ${accent}`,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: "center",
              border: `1px solid ${primary}`,
              padding: "44px 56px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  letterSpacing: 6,
                  textTransform: "uppercase",
                  color: primary,
                  fontWeight: 600,
                }}
              >
                {badge}
              </div>
              <div
                style={{
                  width: 72,
                  height: 2,
                  backgroundColor: accent,
                  marginTop: 14,
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: headline.length > 26 ? 56 : 68,
                  fontWeight: 700,
                  color: textColor,
                  lineHeight: 1.15,
                  textAlign: "center",
                }}
              >
                {headline}
              </div>
              <div
                style={{
                  fontSize: 26,
                  color: primary,
                  marginTop: 18,
                  textAlign: "center",
                }}
              >
                {dateSubtitle}
              </div>
              {venueName ? (
                <div
                  style={{
                    fontSize: 20,
                    color: textColor,
                    opacity: 0.78,
                    marginTop: 10,
                    textAlign: "center",
                  }}
                >
                  {venueName}
                </div>
              ) : null}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "100%",
              }}
            >
              {matchedGuest ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: secondary,
                    border: `1.5px solid ${accent}`,
                    borderRadius: 999,
                    padding: "12px 32px",
                    fontSize: 24,
                    fontWeight: 600,
                    color: primary,
                  }}
                >
                  {`Trân trọng kính mời: ${matchedGuest.salutation} ${matchedGuest.fullName}`}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 16,
                    letterSpacing: 4,
                    textTransform: "uppercase",
                    color: accent,
                  }}
                >
                  WEDDING INVITATION
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": OG_CACHE_CONTROL,
      },
    },
  );
}
