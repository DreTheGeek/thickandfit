# Thick & Fit — Design Handoff for Claude Code

## What this is
A complete, bilingual (EN/ES) visual design package for the **Thick & Fit** fitness coaching app, covering all three surfaces and every contracted feature across Phases 1–3. This bundle is the **visual source of truth** that pairs with the PRDs already in the repo (`Build/02-prds/` and `.planning/`).

## How to use this with Claude Code
These `.dc.html` files are **design references** — interactive HTML prototypes showing the intended look, copy, and behavior. They are **not** production code to copy verbatim. Your job:

1. **Read the PRDs first** (`Build/01-foundation-docs/` for the blueprint, `Build/02-prds/` for the 48 feature PRDs). The PRDs define *what* to build and the data model; these designs define *how it looks and feels*.
2. **Recreate each screen** in the repo's real stack (Next.js / React + Supabase + Stripe, per the agreement) using its existing patterns — not by embedding the HTML.
3. **Match the visual system pixel-for-pixel** using the Design Tokens below. This is **high-fidelity** — final colors, type, spacing, and interactions are intentional.

## How to view the prototypes
Open any `.dc.html` file directly in a browser (they load `support.js` from this folder). Start with **`Thick & Fit - Design Hub.dc.html`** — it links to every other surface and explains the system. **`Thick & Fit - Scope Audit.dc.html`** maps every contracted feature to its design.

---

## Design Tokens

### Color
| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0f0f0f` | Primary text, buttons, dark surfaces, sidebar |
| `--surface` | `#ffffff` | Cards |
| `--bg` | `#fafafa` | App background |
| `--bg-warm` | `#f0f0f0` | Secondary surfaces, inset cards, segmented tracks |
| `--line` | `#e4e4e4` / `#ececec` | Hairlines, borders |
| `--muted` | `#767676` | Secondary text, captions |
| `--text-soft` | `#5c5c5c` | Body copy on light |
| `--accent` | `#5EBE62` | Positive/active ONLY (completion, streaks, live data, success). Never decorative. |
| `--accent-ink` | `#053b07` | Text on green |
| Status: pending `#FBE6A2`/`#6b5200` · alert `#F3C0C0`/`#7a1f1f` · warning `#c89a2b` |

**Rule:** The product is monochrome. Green is functional only (a completed set, a positive trend, a live indicator). No gradients as decoration, no green buttons in the coach console.

### Typography
| Role | Font | Notes |
|---|---|---|
| Display / headings | **Gulams Condensed** (`assets/fonts/gulams.woff2`, weight 600) | UPPERCASE, line-height ~0.85, tracking +0.5px. Her real brand font. |
| Body / UI | **Inter** (400/500/600/700) | All running copy, labels, inputs |
| Eyebrows / labels | Inter 600, UPPERCASE, letter-spacing 1–3px |

Fallback for Gulams: `Impact, sans-serif`.

### Shape & spacing
- **Buttons:** pill (`border-radius: 100vw`), often paired with a circular arrow badge (see landing/nav). Uppercase Inter 600, letter-spacing 1px.
- **Cards:** `border-radius: 14–16px` (app/admin), `2px` only for the gallery frames. Subtle shadow `0 1px 3px rgba(0,0,0,.08)`; dark hero cards use photo + black gradient overlay.
- **Avatars:** monochrome monogram circles (initials on `#0f0f0f`) until real member photos exist.
- **Exercise thumbnails:** movement still + small play badge (tap → demo video). Muscle map on the exercise detail screen.
- **Icons:** thin line icons, `stroke-width: 1.6–1.8`, `currentColor`. No emoji anywhere.

### Motion
- Macro/goal rings animate-fill on load (`stroke-dashoffset`).
- Milestone confetti on workout-complete / streak / goal hit.
- Press feedback: `transform: scale(.97); opacity:.85` on `:active` for any `cursor:pointer`.

---

## Surfaces & screens

### 1. Marketing site — `Thick & Fit - Landing Page.dc.html`
Mirrors her live site. Hero ("Helping women *fall in love* with the journey"), client-success gallery, coaching cards, about, dark testimonials, accordion FAQ, footer. Real logo + photography. **Do not redesign** — this matches what exists today.

### 2. Subscriber app — `Thick & Fit - Mobile App.dc.html` (interactive)
Bottom nav: **Today · Chat · Activities · Nutrition · You** (matches her current app so migrated clients don't relearn). 12+ tap-through screens: Today/home, Workouts (photo hero), Exercise player (reps + weight steppers, set tracker, video), Nutrition (animated macro ring), Add Food (Search/Scan/AI Photo), Community feed, Challenges, Habits, Messages hub → Coach chat (voice notes + file attachments), You (goal + weight tracker), Check-in, Progress. EN/ES toggle, bezel/bare toggle.

### 3. Coach dashboard — `Thick & Fit - Coach Dashboard.dc.html` (interactive)
Sidebar IA mirroring Lenus. Overview (KPIs + live activity + charts), Subscribers (segment-tag filters: Spanish/GLP-1/PCOS/Bride/Workout-only/Churned + win-back), Subscriber Profile (8 tabs: Overview/Nutrition/Workouts/Community/Progress/Messages/Billing/Notes), Program Builder, Create Broadcast, App Health, Billing & Renewals.

### 4. Screen libraries (static spec catalogs — every state, for reference)
- **`Thick & Fit - Customer Screens.dc.html`** — auth (sign in/up, forgot, verify), onboarding (goal → about → weight prediction → plan), paywall + checkout + success, workout (follow-along, rest, complete, swap), nutrition (AI photo + result, barcode, recipe), account (manage, cancel, settings, chat), store (shopping list, digital store, premium $2.99 upsell), Phase 3 (affiliate store, live stream).
- **`Thick & Fit - Admin Screens.dc.html`** — coach login, create challenge, automation, analytics, payouts, branding, support inbox, billing & renewals, form/question builder, notifications & email, LATAM multi-currency pricing.
- **`Thick & Fit - System & Edge.dc.html`** — 404, 500, offline, maintenance, empty, loading skeleton, trial-ended, admin 404. All on-brand, bilingual.

### Reference
- **`Thick & Fit - Design System.dc.html`** — the canonical token/component kit.
- **`Thick & Fit - Design Hub.dc.html`** — start here; links everything.
- **`Thick & Fit - Scope Audit.dc.html`** — contracted-feature → design-status matrix.

---

## Bilingual (non-negotiable, day one)
Every string ships EN + ES. The pattern is an independent UI-language toggle (the Fitia model): the interface language and the food-database language resolve separately. In these prototypes, copy lives in a per-file `T()` dictionary with `en`/`es` objects — use those as your translation source strings. Build with i18n keys from the start; do not hardcode English.

## Assets
- `assets/logo-black.svg`, `assets/logo-white.svg` — her real script wordmark.
- `assets/fonts/gulams.woff2` — brand display font.
- `assets/img/*.avif` — her real hero, transformation, and current-app marketing photos (placeholders for product photography to be shot; swap exercise/member photos when filmed).

## What's design-complete vs. still open
Per the Scope Audit: **all Phase 1, 2, and 3 features have designs.** Remaining work is *depth refinement* (drip-builder trigger detail, AI-capture live shimmer, coach-toolbox roles/permissions) and **build-only** items needing no design (PWA install, app-store submission, infra wiring). Real exercise-demo videos and member face photos are placeholders.

## Suggested build order (matches the agreement's phases)
1. **Phase 1:** auth + bilingual i18n scaffold, onboarding, workout system, subscriber dashboard, Stripe billing, basic coach admin, PWA.
2. **Phase 2:** nutrition (macros/food DB/barcode), meal plans/recipes, community, check-ins, habits, multi-form builder.
3. **Phase 3:** drip + AI messaging, full coach toolbox, digital store + $2.99 upsell + affiliate, gamification, push/email, then live streaming + AI photo logging + LATAM pricing.
