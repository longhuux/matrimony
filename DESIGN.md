---
name: Matrimony
version: 1.0.0
updated: 2026-11-26
stack: nextjs-15-tailwind-v4
mode: light-editorial-plus-dark-stage
theme: editorial-wedding-atelier
colors:
  ivory: "#FFFCF9"
  surface: "#FFFDFB"
  blush: "#F5ECE6"
  blush-hover: "#FBF2EC"
  amber-surface: "#FFF4E8"
  burgundy: "#8B2635"
  burgundy-dark: "#6C1C28"
  amber-text: "#7C531E"
  gold: "#C89D66"
  botanical-rose: "#9B4A5B"
  ink: "#231B18"
  ink-secondary: "#5A4B44"
  ink-muted: "#6B5B53"
  border: "#EADBD1"
  border-strong: "#D9C5B7"
  stage-bg: "#16100E"
  stage-surface: "#231B18"
  stage-text: "#FFFCF9"
  stage-muted: "#D9C5B7"
  stage-accent: "#E6C280"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, Times New Roman, serif"
    fontSize: "3.75rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Playfair Display, Georgia, Times New Roman, serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Playfair Display, Georgia, Times New Roman, serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0em"
  body:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "0em"
  label:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.02em"
radius:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "9999px"
spacing:
  space-1: "0.25rem"
  space-2: "0.5rem"
  space-3: "0.75rem"
  space-4: "1rem"
  space-6: "1.5rem"
  space-8: "2rem"
  space-12: "3rem"
  space-16: "4rem"
  space-section: "6rem"
motion:
  fast: "150ms"
  base: "240ms"
  enter: "520ms"
  easing: "cubic-bezier(0.22, 1, 0.36, 1)"
---

# Design System: Matrimony

## Visual Theme & Atmosphere

**Creative North Star: "The Editorial Wedding Atelier"**

Matrimony balances the tactile warmth of fine cotton wedding stationery with the speed and precision of a modern mobile-first web studio. Every marketing, authentication, and workspace surface rests on a warm ivory paper ground (`#FFFCF9`) framed by soft blush tints (`#F5ECE6`), hairline champagne-taupe borders (`#EADBD1`), and deep espresso ink (`#231B18`) rather than sterile blue-gray tech neutrals.

Primary actions and ceremonial highlights are anchored in Editorial Burgundy (`#8B2635`), evoking traditional Vietnamese crimson wedding wax seals and silk ribbons without visual noise. For the reception-hall Live LED projection surface (`/stage/[slug]`), the system intentionally shifts into an ambient Dark Banquet Stage polarity (`--color-stage-bg: #16100E` ground, `--color-stage-text: #FFFCF9` typography, `--color-stage-accent: #E6C280` gold accents) so projected guest photos and wishes glow cleanly in dimly lit banquet halls.

**Key Characteristics:**
- Warm stationery ivory ground (`#FFFCF9`) paired with warm porcelain cards (`#FFFDFB`, tinted toward ivory rather than pure `#FFFFFF`) and blush accents (`#F5ECE6`).
- High-contrast Vietnamese editorial serif headings (`Playfair Display`) paired with geometric humanist sans-serif body & controls (`Be Vietnam Pro`).
- Pill-shaped action buttons (`9999px`) contrasted with softly rounded editorial cards (`16px`) and form fields (`12px`).
- WCAG 2.1 AA compliant muted text (`#6B5B53`), warm amber badges (`#7C531E` on `#FFF4E8`), and botanical pills (`#9B4A5B`).
- Calm, flat-by-default elevation relying on warm hairline borders (`#EADBD1`) and subtle warm-ink ambient shadows (`rgba(35, 27, 24, 0.04)`).

## Color Palette & Roles

The palette pairs warm paper neutrals with ceremonial burgundy and antique gold, verified for accessible text contrast across mobile and desktop screens.

### Primary
- **Editorial Burgundy** (`#8B2635`): Primary brand accent, primary CTA fill, active icons, pricing highlight border, and brand badge mark. Reserved for key calls-to-action and ceremonial emphasis.
- **Deep Claret Hover** (`#6C1C28`): Hover and active state for primary burgundy buttons and links.

### Secondary & Accent
- **Antique Gold** (`#C89D66`): Celebratory secondary highlight for wedding accents, Lucky Draw moments, and Live LED stage framing. Never used for small body text on light backgrounds.
- **Warm Amber Badge Ink** (`#7C531E`): High-contrast (`>= 6.1:1`) badge label ink paired exclusively with **Soft Amber Mist** (`#FFF4E8`) for feature tags and milestone pills.
- **Blush Botanical Rose** (`#9B4A5B`): High-contrast (`>= 5.2:1`) pill fill with `#FFFFFF` label text for the `Blush Botanical` template preview.

### Neutral
- **Warm Ivory Ground** (`#FFFCF9`): Global page background across landing, login, and dashboard surfaces.
- **Warm Porcelain Surface** (`#FFFDFB`): Elevated card fill, form inputs, and dashboard header surface — tinted slightly toward ivory rather than pure `#FFFFFF` so cards sit organically on warm cotton paper.
- **Soft Blush Tint** (`#F5ECE6`): Secondary button background, icon containers, and subtle section pills; shifts to **Warm Cream Hover** (`#FBF2EC`) on interactive outline hover.
- **Espresso Ink** (`#231B18`): Primary headings, card titles, input text, and high-emphasis body copy.
- **Roasted Umber Secondary** (`#5A4B44`): Secondary descriptive paragraphs, navigation links, and roadmap descriptions.
- **Muted Taupe Ink** (`#6B5B53`): WCAG AA (`>= 5.7:1` on `#FFFCF9` and `#FFFDFB`) captions, metadata, form placeholders, divider text, and footer copy.
- **Champagne Hairline Border** (`#EADBD1`): Card borders, horizontal dividers, and template preview frames.
- **Warm Sand Input Border** (`#D9C5B7`): Outline button borders and form input strokes.

### Live LED Stage Mode (Dark Polarity)
- **Banquet Obsidian** (`--color-stage-bg: #16100E`): Fullscreen 16:9 LED stage canvas background.
- **Velvet Espresso Card** (`--color-stage-surface: #231B18`): Floating guest photo and wish card surface on the LED wall.
- **Stage Ivory** (`--color-stage-text: #FFFCF9`) & **Stage Taupe** (`--color-stage-muted: #D9C5B7`): Primary and secondary guest message typography on dark stage surfaces.
- **Stage Gold Accent** (`--color-stage-accent: #E6C280`): Celebratory highlight and frame ornament on dark banquet stage surfaces.

### Named Rules
**The Warm Paper & Ink Rule.** Never pair cool slate grays (`#64748B`, `#F8FAFC`) or pure `#000000` black with `#FFFCF9` ivory. All neutrals stay rooted in warm umber (`#231B18` -> `#5A4B44` -> `#6B5B53`) so typography feels printed on stationery rather than overlaid on a generic SaaS template.

**The Verified Contrast Rule.** All small text (`<= 14px`) must meet `>= 4.5:1` contrast against its immediate surface (`#6B5B53` minimum on light grounds, `#7C531E` on `#FFF4E8`, `#FFFFFF` on `#8B2635` or `#9B4A5B`).

## Typography Rules

**Display Font:** `Playfair Display` (weights `500`, `600`, `700`, `latin` + `vietnamese` subsets, fallback `Georgia, "Times New Roman", serif`)
**Body & UI Font:** `Be Vietnam Pro` (weights `400`, `500`, `600`, `700`, `latin` + `vietnamese` subsets, fallback `ui-sans-serif, system-ui, sans-serif`)

**Character:** `Playfair Display` brings high-contrast editorial romance suited to couple names and invitation titles, while `Be Vietnam Pro` was engineered specifically for crisp Vietnamese diacritics in small mobile UI labels, pricing tables, and form inputs.

### Hierarchy
- **Display** (`700`, `2.25rem` mobile / `3.75rem` desktop, `line-height: 1.15`, `letter-spacing: -0.025em`): Hero headlines on the marketing landing page only.
- **Headline** (`700`, `1.875rem`, `line-height: 1.25`, `letter-spacing: -0.015em`): Section titles and dashboard greeting (`<h1>` on `/dashboard`).
- **Title** (`600`–`700`, `1.125rem`–`1.5rem`, `line-height: 1.35`): Card headings, modal/auth titles, and template names.
- **Body** (`400`, `0.875rem`–`1.125rem`, `line-height: 1.625`, max measure `65ch`–`72ch`): Feature descriptions, pricing lists, and onboarding guidance.
- **Label** (`600`, `0.6875rem`–`0.75rem`, `line-height: 1.4`, `letter-spacing: 0.02em`–`0.05em`): Form labels, status badges, pill tags, and metadata captions.

### Named Rules
**The Vietnamese Diacritic Clarity Rule.** Never tighten display tracking below `-0.03em` or compress line-height below `1.15` on Vietnamese uppercase/lowercase stacked accents (such as `Ế`, `Ộ`, `Ầ`, `Ự`). Always load `vietnamese` font subsets with `display: "swap"`.

## Component Stylings

All component tokens resolve via CSS custom properties defined on `:root` in `src/app/globals.css`, keeping light editorial defaults consistent while allowing Live LED dark stage mode overrides.

### Button
- **Tokens:** Background `var(--color-burgundy)` (`#8B2635`) for `primary`, `var(--color-blush)` (`#F5ECE6`) for `secondary`, `var(--color-surface)` (`#FFFDFB`) for `outline`, transparent for `ghost`; foreground `var(--color-ivory)` (`primary`) or `var(--color-ink)` (`secondary`/`outline`/`ghost`); radius `var(--radius-pill)` (`9999px`); focus outline `2px solid #8B2635` (`var(--color-burgundy)`) with `2px` offset (`>= 7.5:1` contrast, instant appearance).
- **Sizes & States:** `sm` (`36px` height, `16px` horizontal padding), `md` (`44px` height, `24px` horizontal padding), `lg` (`48px` height, `28px` horizontal padding). Hover shifts `primary` to `var(--color-burgundy-dark)`, `secondary` to `var(--color-border)`, and `outline` to `var(--color-blush-hover)`. Disabled reduces opacity to `0.5`.

### Card
- **Tokens:** Background `var(--color-surface)` (`#FFFDFB`), border `1px solid var(--color-border)` (`#EADBD1`), radius `var(--radius-lg)` (`16px`), elevation `var(--shadow-card)` (`0 8px 30px rgba(35, 27, 24, 0.04)`), padding `20px`–`28px` (`1.25rem`–`1.75rem`).
- **Highlighted Pricing Card:** Upgrades border to `2px solid var(--color-burgundy)` with a subtle `4px` outer halo at 10% burgundy opacity.

### Input
- **Tokens:** Height `40px` (`2.5rem`), background `var(--color-surface)` (`#FFFDFB`), border `1px solid var(--color-border-strong)` (`#D9C5B7`), radius `var(--radius-md)` (`12px`), text `var(--color-ink)`, placeholder `var(--color-ink-muted)` (`#6B5B53`), leading icon `var(--color-ink-muted)`.
- **Focus & Autofill:** Focus applies the universal `2px solid #8B2635` (`var(--color-burgundy)`) `:focus-visible` outline with `2px` offset. Auth inputs include `autoComplete` (`email` / `one-time-code`) and `suppressHydrationWarning` to tolerate browser/extension attribute injection.

### Badge
- **Tokens:** Radius `var(--radius-pill)` (`9999px`), padding `2px 10px` (`0.125rem 0.625rem`), `11px` (`0.6875rem`) semibold.
  - **Milestone / Highlight Badge:** `var(--color-amber-surface)` (`#FFF4E8`) background with `var(--color-amber-text)` (`#7C531E`) text.
  - **Ceremony / Plan Badge:** `var(--color-blush)` (`#F5ECE6`) background with `var(--color-burgundy)` text and `1px solid var(--color-border)` stroke.
  - **Template Tier Pill:** Solid accent fill (`var(--color-burgundy)` or `var(--color-botanical-rose)`) with `var(--color-ivory)` (`#FFFCF9`) text.

### Wedding Template Preview Card
- **Tokens:** Outer container uses `Card` (`var(--color-surface)`, `var(--radius-lg)`, `var(--color-border)`), housing a `3:4` aspect-ratio inner stationery frame (`var(--radius-md)`, `1px solid var(--color-border)`) tinted to the theme's own paper background (`#FFFCF9`, `#FFF5F3`, `#F7F5EF`, `#FFF7FA`, `#F8F8F7`), centered serif title in `var(--color-ink)`, `Responsive 100%` caption in `var(--color-ink-muted)`, and tier pill (`Miễn phí` / `Pro`) in WCAG-compliant accent fill.

### Live LED Stage Overlay Tokens (Dark Mode)
- **Tokens:** Canvas `var(--color-stage-bg)` (`#16100E`), card surface `var(--color-stage-surface)` (`#231B18`), primary guest quote `var(--color-stage-text)` (`#FFFCF9`), secondary guest metadata `var(--color-stage-muted)` (`#D9C5B7`), celebratory highlight `var(--color-stage-accent)` (`#E6C280`).

## Photography & Editorial Media

- **Curated Asset Library (`/public/images/wedding/*.webp`):** All marketing and template showcase photography lives locally as optimized WebP assets in `/public/images/wedding/`:
  - `hero-couple.webp` — Hero editorial couple portrait
  - `stationery-detail.webp` — Fine-art invitation stationery detail
  - `champagne-heritage.webp` — Champagne Heritage theme preview
  - `blush-botanical.webp` — Blush Botanical theme preview
  - `dalat-garden.webp` — Dalat Garden theme preview
  - `editorial-vogue.webp` — Editorial Vogue theme preview
  - `royal-crimson.webp` — Royal Crimson theme preview
  - `midnight-starlight.webp` — Midnight Starlight theme preview
- **Art Direction:** Prefer natural window light, warm cotton/champagne tones, and fine-art Vietnamese/editorial wedding framing; avoid cool fluorescent stock photography or generic clipart.

## Layout Principles

- **Viewport Overflow Guard:** Set `html, body { overflow-x: clip; }` (and `overflow-x-clip` on `<body>`) so horizontal decor never causes unwanted page scrollbars while preserving `position: sticky` behavior.
- **Page Container:** Centered `max-w-6xl` (`1152px`) container with `16px` (`px-4`) mobile gutters and `24px` (`px-6`) tablet/desktop gutters. Auth and error states narrow to `max-w-md` (`448px`).
- **Responsive Grid Rhythm:**
  - Feature differentiators: `1` column on mobile -> `2` columns (`md:grid-cols-2`, `gap-6` / `24px`).
  - Template showcase: `1` column -> `2` columns (`sm`) -> `5` columns (`lg:grid-cols-5`, `gap-5` / `20px`).
  - Pricing plans: `1` column -> `2` columns (`md`) -> `4` columns (`lg:grid-cols-4`, `gap-6` / `24px`).
  - Dashboard KPIs: `1` column -> `3` columns (`sm:grid-cols-3`, `gap-5` / `20px`); Roadmap grid: `1` -> `2` -> `3` columns.
- **Sticky Navigation:** Header stays `sticky top-0 z-30` with subtle `backdrop-blur-md` over `90%` ivory (`#FFFCF9/90`) and `1px` bottom border (`#EFE3DA`).

## Depth & Elevation

Matrimony is **flat-by-default and hairline-bounded**, relying on tonal paper separation (`#FFFCF9` ground vs `#FFFDFB` warm porcelain cards vs `#F5ECE6` blush tints) rather than heavy drop shadows.

### Shadow Vocabulary & Motion
- **Card Resting Shadow** (`box-shadow: 0 8px 30px rgba(35, 27, 24, 0.04)`): Soft warm-ink ambient lift used on `Card` containers so warm porcelain cards separate gently from the warm ivory paper ground.
- **Elevated / Modal Surface** (`box-shadow: 0 12px 36px rgba(35, 27, 24, 0.08)`): Reserved for overlays, dropdowns, and focused stage cards.
- **Universal Focus Outline** (`2px solid #8B2635`, `outline-offset: 2px`): Applied globally via `:where(a, button, input, select, textarea, summary):focus-visible` for instant `>= 7.5:1` keyboard focus visibility.
- **Hero Entrance (`[data-enter]`):** Fades in and lifts `12px` via `@keyframes editorial-enter` over `var(--duration-enter)` (`520ms`) with `var(--ease-editorial)` (`cubic-bezier(0.22, 1, 0.36, 1)`), and cleanly resets to `opacity: 1; transform: none; animation: none;` under `@media (prefers-reduced-motion: reduce)`.

### Named Rules
**The Whisper Shadow Rule.** Never apply cold pure-black shadows (`rgba(0,0,0,0.25)`) or hard neobrutalist block offsets on editorial wedding surfaces; tint every shadow with espresso ink (`rgba(35, 27, 24, ...)`).

## Do's and Don'ts

### Do:
- **Do** use `#6B5B53` (never `#8C7A70`) for muted text, captions, placeholders, and input icons on `#FFFCF9` and `#FFFDFB`.
- **Do** use `#7C531E` on `#FFF4E8` for warm amber status pills and `#9B4A5B` (never `#B56576`) for Blush Botanical white-text pills.
- **Do** wrap every page's primary content in `<main>` and rely on the universal `2px solid #8B2635` (`outline-offset: 2px`) `:focus-visible` outline across every `<Link>`, `<a href>`, `<button>`, and `<input>`.
- **Do** write natural Vietnamese B2C copy (`"3 năm"`, `"5 năm"`, `"Đăng nhập nhanh bằng mã xác thực Email OTP bên dưới."`).
- **Do** pair `role="alert"` on error banners and `role="status" aria-live="polite"` on status/OTP confirmation banners.

### Don't:
- **Don't** leak engineering jargon (`"Schema v2"`, `"biến môi trường"`, `"PostgreSQL + Redis"`) into customer-facing headings or subtitles.
- **Don't** render fixed-pixel `500px` canvas layouts or break dual-family (`Nhà Trai` / `Nhà Gái`) symmetry on mobile viewports (`390px`).
- **Don't** invent fake testimonials, fake couple names, or unverified metrics on marketing or dashboard screens.
- **Don't** use gradient text, hard offset shadows, or emoji icons in place of `lucide-react` stroke icons.

## Design System Governance

- **Single Source of Truth:** `src/app/globals.css` owns live CSS custom properties and Tailwind v4 `@theme inline` tokens; `DESIGN.md` frontmatter and prose document the canonical specification; `.impeccable/design.json` extends those tokens with OKLCH tonal ramps, shadow/motion metadata, and shadow-DOM-ready `ds-` component snippets.
- **Sync Policy:** Any addition or contrast adjustment to color tokens, typography hierarchy, or core UI primitives (`button.tsx`, `card.tsx`, inputs, badges) must update `src/app/globals.css`, `DESIGN.md`, and `.impeccable/design.json` in the same change.
- **Verification Gate:** Before shipping new UI surfaces or templates, verify TypeScript (`pnpm typecheck`), lint (`pnpm lint`), WCAG 2.1 AA contrast (`>= 4.5:1` small text), and both `390×844` mobile and `1280×800` desktop renders.
