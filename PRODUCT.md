<!-- impeccable:product-schema 1 -->

# Product: Matrimony

## Platform

web

## Users

- **Primary Users (100% B2C Vietnam):** Young Vietnamese couples (brides & grooms) creating a responsive, mobile-first digital wedding invitation in 3–5 minutes directly on their smartphone and running interactive celebration moments at the wedding reception hall.
- **Secondary Pilot Audience (Week 3):** Vietnamese wedding photography studios, wedding planners, and event MCs adopting `Pilot Studio` (`499.000đ` for 5 Pro invitations + unlimited Live LED) to bundle digital invitations + reception hall LED check-in for their clients.

## Product Purpose

Matrimony enables couples to turn their wedding photos into a fast-loading, culturally authentic Vietnamese wedding website in minutes, distribute personalized Zalo invitation links (`/invite/[code]`) with guest-named preview cards, engage reception guests in real time via an interactive Live LED wall, and receive direct P2P wedding gifts via VietQR with 0% commission.

Success means:
- A couple completes and publishes an invitation on mobile in under 5 minutes without layout breakage.
- Guests opening `/invite/[code]` on Zalo/Messenger immediately see a personalized `1200×630` preview image and sub-second mobile page load.
- Reception guests scan table QR codes to send photos and wishes to the venue LED screen in `< 500ms` with safe 1-tap moderation.

## Positioning

Matrimony differentiates across four core product pillars:

1. **Live LED Realtime SSE (`/stage/[slug]`, `/checkin/[slug]`, `/dashboard/led-mod`):** Unlike static projection loops, guests scan a table QR code to upload WebP photos (`< 500KB`) and wishes; the MC or couple moderates with 1 tap on mobile, pushing approved check-ins via Redis Pub/Sub and Server-Sent Events (SSE) onto the 16:9 venue LED screen alongside an interactive Lucky Draw.
2. **Mobile-first Hybrid Schema v2 Editor & Dynamic Zalo OG (`/api/og/[slug]`):** Structured 3-layer JSONB Document Schema v2 (`theme`, `sections`, `freeElements`) lets couples switch across wedding styles in 1 tap without losing photos/copy or breaking mobile layout, while `@vercel/og` (Satori) renders personalized `1200×630` Zalo/Facebook preview cards per guest.
3. **AI Magic Setup:** Client-side zero-cost color palette extraction and face-aware smart cropping (`focalPoint`) prevent faces from being clipped on mobile or OG cards, paired with Gemini Flash AI copywriting for love stories and invitations.
4. **Generous Free Tier (5,000 Views) & Direct VietQR 0% Fee:**
   - **Miễn phí (`0đ`):** 6 months, 1 invitation, 5,000 views, 20 images, 30 personalized guests, 3 AI credits, 10 LED check-ins, direct VietQR (0% fee).
   - **Pro (`149.000đ`):** 3 years, 3 invitations, 50,000 views, 100 images, unlimited personalized guests + Dynamic Zalo OG, 15 AI credits, 100 LED check-ins, watermark removal, premium templates, custom MP3/font.
   - **Combo Full Đám Cưới (`249.000đ`):** 5 years, 5 invitations, unlimited views, 200 images, unlimited personalized guests + Dynamic Zalo OG, 30 AI credits, unlimited LED check-ins + Lucky Draw.
   - **Pilot Studio (`499.000đ`):** 3 years/invitation, 5 Pro invitations + unlimited LED, unlimited views, 750 images, 100 AI credits, Lucky Draw.

## Operating Context

- **Vietnamese Wedding Cultural Nuances (Non-negotiable):**
  - Dual-family structure displaying both **Nhà Trai** (groom's family) and **Nhà Gái** (bride's family) details, parents' names, addresses, map links, and separate VietQR bank accounts side by side.
  - Support for multiple ceremony rituals (**Lễ Vu Quy**, **Lễ Thành Hôn**, **Lễ Tân Hôn**, **Báo Hỷ**) within a single wedding profile.
  - Accurate Vietnamese **Âm lịch Can Chi** (UTC+7 lunar calendar conversion including leap months) rendered alongside Gregorian ceremony dates.
  - **Zalo-first mobile distribution:** Most guests open invitations inside Zalo's in-app browser on 4G mobile networks, requiring lightweight Vietnamese-subset typography (`Be Vietnam Pro`, `Playfair Display`) and crisp OG preview cards.
- **5 Flagship Wedding Themes:**
  1. `Ivory Minimal` (`modern-ivory`, Miễn phí)
  2. `Sắc Son Truyền Thống` (`royal-crimson`, Miễn phí)
  3. `Champagne Heritage` (`european-classic`, Pro)
  4. `Blush Botanical` (`pastel-bloom`, Miễn phí)
  5. `Editorial Tạp Chí` (`editorial-vogue`, Pro)

## Capabilities and Constraints

- **Technical Stack:** Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS v4, PostgreSQL 16 + Drizzle ORM (JSONB Document Schema v2 with optimistic locking), Redis 7 (Pub/Sub, Cache, Sliding-window Rate Limit), Cloudflare R2 (`0đ` egress presigned PUT + local driver fallback), Google OAuth & 6-digit Email OTP (`httpOnly` session cookie), and PayOS / SePay VietQR HMAC webhook billing.
- **Explicit Anti-Goals (v1):**
  - No B2B multi-tenant studio white-label portal in v1 (deferred to Phase 2).
  - No virtual gift coin wallet, escrow holding, or marketplace transaction commission on wedding gifts (100% direct P2P VietQR to couple's bank account).
  - No freeform fixed-width (`500px`) drag-and-drop canvas that breaks mobile responsiveness (optional `%`-coordinate Pro Canvas overlay is deferred to Phase 1).
  - No hostile anti-DevTools blocking or forced browser redirects; licensing and quotas are enforced server-side.

## Brand Commitments

- **Brand Name:** `Matrimony` (`support@matrimony.vn`).
- **Voice & Copy:** Warm, refined, trustworthy Vietnamese B2C tone. User-facing surfaces must never expose internal engineering jargon (e.g., no `"Schema v2"`, `"biến môi trường"`, or database/infrastructure status messages).
- **Color & Type Anchors (WCAG-verified):** Warm Ivory `#FFFCF9` canvas, Editorial Burgundy `#8B2635` primary accent, Warm Gold `#C89D66` highlight, Deep Espresso Ink `#231B18`, paired with `Playfair Display` headings and `Be Vietnam Pro` body copy (`latin` + `vietnamese` subsets).

## Evidence on Hand

- Implemented application routes and modules in `/home/longdh/workspace/matrimony`: landing page (`src/app/page.tsx`), authentication (`src/app/login/page.tsx`, `src/components/auth/login-form.tsx`), workspace dashboard (`src/app/dashboard/page.tsx`), Drizzle schema (`src/db/schema.ts`), 5 flagship seeded templates (`src/db/seed.ts`), plan definitions (`src/modules/billing/plans.ts`), Vietnamese lunar converter (`src/modules/invitation-engine/lunar.ts`), Document Schema v2 (`src/modules/invitation-engine/schema.ts`), and Napas EMVCo VietQR payload generator (`src/modules/vietqr/index.ts`).
- **Absences not to fabricate:** No real customer testimonials, couple case studies, or studio partner logos exist yet; marketing and dashboard surfaces must not invent social proof quotes or customer metrics.

## Product Principles

1. **Mobile-First Without Fragility:** Every invitation and editor flow works effortlessly with one thumb on a phone and adapts cleanly across viewports without overlapping text.
2. **Cultural Fidelity for Vietnamese Weddings:** Dual-family parity, multiple ceremony schedules, Can Chi lunar dates, and Zalo-ready sharing are first-class primitives, not afterthoughts.
3. **Zero-Friction Monetization & Transparent Gifts:** Generous free limits earn organic sharing; VietQR gifts transfer directly at 0% fee; upgrades unlock instantly via PayOS/SePay.
4. **Live Reception Magic with Safe Control:** Reception LED interactivity creates unforgettable shared moments while 1-tap moderation keeps hosts fully in control.
5. **Human Copy Over Engineering Jargon:** Every label, error, and empty state speaks the couple's language clearly and calmly.

## Accessibility & Inclusion

- `[inferred]` Target WCAG 2.1 AA contrast compliance across all interactive and editorial surfaces (`>= 4.5:1` for normal text, `>= 3:1` for large text and UI components).
- `[inferred]` Full keyboard navigation with visible focus indicators (`focus-visible:ring-2`), semantic HTML landmarks (`<header>`, `<main>`, `<footer>`), ARIA live regions (`role="alert"`, `role="status"`), and autofill-friendly form attributes (`autoComplete`, `inputMode`) across mobile Zalo, Safari, and Chrome browsers.
