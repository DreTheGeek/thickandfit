# THICK & FIT LANDING PAGE: FINAL BUILD SPEC

**Winning direction:** THE THREAD (intimate), rebuilt around the critics' fatal flaws.
**Grafted from losers:** the fill/outline bilingual pair and variable section beats (DOBLE VOZ), the aperture/plate screenshot frame and native CSS scroll-driven motion (Fixed Point), reader-letters testimonials and the no-max-width grid (La Portada), the numeral watermark and the four-tier vertical rhythm (Hard Rule).

Everything below is a decision, not an option. Where a critic's objection is rejected rather than fixed, it is called out under **Rejected objections**.

---

## 0. VERIFIED REPO FACTS THIS SPEC IS BUILT ON

Confirmed against the working tree before writing:

- `framer-motion` is **not installed**. Dependencies are next 16.2.6, react 19.2.4, next-intl, next-themes, supabase, mux, sentry, posthog, zod, d3-force, zxing, web-push. The brief's claim that Framer Motion is available is **wrong for this repo**. All motion in this spec is native CSS. Do not add the dependency.
- `src/app/es/page.tsx` is `export { default, generateMetadata } from '../page'`. **One component renders both locales.** Every measurement in this spec is stated for the longer of the two strings.
- Assets in `public/brand/img/`: `steph-hero.avif`, `steph-about.avif`, `steph-footer.avif`, `app-1..4.avif`, `ba-1..6.avif`. There are **three** portraits, not one. The `ba-*` client photos are **not used in v1** (see section 12).
- Display face: `public/assets/fonts/a0274ead7b73.woff2`, Gulams Condensed SemBd, single weight 600, upm 1000, cap height 700, ascent 936, descent -205, full Spanish coverage (Á É Í Ó Ú Ü Ñ ¿ ¡ all present). **Spanish display type is not a glyph risk. Close that risk.**
- `MarketingNav` is `sticky top-0 z-50`, contains the only EN/ES twin link, and its height is **locale-dependent** (`Empieza tu camino` vs `Start your journey`). Never hardcode its height.
- `next-themes` mounts app-wide with `attribute="data-theme"`, and `globals.css` inverts `--c-ink` and `--c-bg` under dark. The marketing page must pin itself to light (section 2.4).
- `StickyCta` is `fixed inset-x-0 bottom-0 z-50`.

---

## 1. DELETE LIST (do this first, in one commit, before building anything)

From `src/app/page.tsx`:

1. **Every `mx-auto max-w-[1180px]` container.** All 13 of them. This is the single largest cause of the dead space and the sameness. Nothing on this page is width-capped by a shared container ever again.
2. **Every two-tone headline.** That means `text-faint` / `#757575` on light grounds **and** `text-white/40` and `text-white/50` on the ink sections. The grey trick lives in both places; deleting only the light one leaves the disease on every dark section.
3. **The `Phones` component** (the one stacking two composites per row with `w-[52%]` / `w-[56%]` and drop shadows). Deleted outright, not restyled.
4. **Every `box-shadow` and every `border-radius` above 4px** on this route. The hero's `shadow-[0_24px_70px_...]` plus `rounded-[26px]` on a transparent-alpha AVIF is literally the "grey slab with a visible seam" the client saw: the shadow paints a rectangle behind the cutout and shows through it. Delete the shadow, do not soften it.
5. **The `Eyebrow` icon badge.** Eyebrows become bare 11px labels sitting behind a 12px tick on the thread.
6. **The testimonial cards**: rounded surface, shadow, monogram avatar circle. All three go.
7. **The FAQ accordion behaviour** (see section 11.13, all answers open).
8. **The pill-with-check-circle group** in the closing CTA.
9. **The uniform `py-24` / `py-32`.** Replaced by the four-tier beat scale in section 5.

Do not delete `MarketingNav`, `StickyCta`, `Marquee`, or `ScrollStory`'s reduced-motion architecture. Those are reused.

---

## 2. FOUNDATIONS

### 2.1 Colour tokens (literal, scoped, non-inverting)

The marketing route wraps in `.tf-light` and **re-declares raw hex**, not semantic tokens:

```css
.tf-light {
  --c-bg:      #e7e5df;  /* warm cream ground */
  --c-surface: #ffffff;  /* white plate */
  --c-ink:     #0f0f0f;
  --c-line:    #ddd9d0;  /* hairline on light */
  --c-line-d:  rgba(231,229,223,0.18); /* hairline on ink */
  --c-soft:    #5c5c5c;  /* body-adjacent metadata only */
  color-scheme: light;
}
```

Hard rules:
- `#5c5c5c` and `#757575` may **never** be applied to anything rendered above 20px. Grey is body-adjacent metadata only. This is a lint-checkable rule; enforce it in review.
- **No green anywhere on this route.** Not decorative, not functional. The functional `#5ebe62` inside `app-3.avif` is killed at build time (section 12.2), not at runtime.
- The whole page uses exactly four surfaces: cream, white, ink, and photograph.

### 2.2 Type faces and the fallback that must not shift

`next/font/local` for Gulams. Today `globals.css` sets `.tf-display { font-family: var(--font-gulams), Impact, sans-serif }`, which bypasses next/font's metric-adjusted fallback entirely. Impact does not exist on Android, so the real fallback is Roboto, roughly 40 percent wider per glyph, on the largest text on the page. That is a guaranteed CLS failure on the LCP element.

Fix, both halves required:

```css
@font-face {
  font-family: 'Gulams Fallback';
  src: local('Arial Narrow'), local('Roboto Condensed'), local('Helvetica Neue');
  size-adjust: 88%;
  ascent-override: 93.6%;
  descent-override: 20.5%;
  line-gap-override: 0%;
}
.tf-display { font-family: var(--font-gulams), 'Gulams Fallback', sans-serif; }
```

and set `display: 'block'` (not `'swap'`) on the localFont call with a short block period, so the 132px headline never renders in a mismatched face at all. Metrics to verify against: upm 1000, ascent 936, descent -205, cap 700.

Inter stays as-is. Do not add a third family. **Caveat and all handwriting are cut** (section 4.4).

### 2.3 The measurement constant every display line is checked against

Average uppercase advance in Gulams Condensed SemBd is **0.352em**. Max characters per display line:

```
max_chars = floor(available_px / (font_size_px * 0.352))
```

**Hard copy rule: no display line exceeds 16 characters in either locale.** Not 16 in English and whatever Spanish comes out as. Sixteen in both, because both render through the same component. Spanish copy is **authored to that constraint**, never translated into it.

### 2.4 Dark-mode pin

`next-themes` persists on the same origin, so a returning member who toggled dark inside the app lands on a near-black "warm cream" page. The route wrapper must carry `data-theme="light"` on the wrapping element **and** re-declare the raw hex above. Setting one without the other still breaks: `MarketingNav` and `MarketingFooter` read semantic tokens.

### 2.5 Overflow rule (this one eats a day if you get it backwards)

This page bleeds photographs off the viewport edge in several places and uses `position: sticky` in two. `overflow-x: hidden` creates a scroll container and **kills every sticky descendant**.

- On `html`: `overflow-x: clip;`
- **Never** `overflow: hidden` on any ancestor of a sticky element.
- Never `width: 100vw` for bleed (it includes the classic scrollbar and produces horizontal scroll on Windows Chrome). Bleed is `margin-inline: calc(var(--gutter) * -1); width: auto;` inside a full-width parent.

---

## 3. THE THREAD (the one structural idea)

A single 1px vertical rule at a fixed viewport x, running the full height of the page, with everything hanging off it. It is functional, not ornamental: section openers put a 24px horizontal tick through it, testimonial interruptions put a 9px filled dot on it, and one quote widens it from 1px to 3px.

**Thread x:**

| Viewport | `--thread-x` | Content column starts at |
|---|---|---|
| 320 to 639 | 20px | thread + 16px |
| 640 to 1023 | 32px | thread + 32px |
| 1024 to 1439 | 88px | thread + 56px |
| 1440+ | `max(88px, (100vw - 1240px) / 2)` | thread + 56px |

Declared once as a custom property in four `@media` blocks in `globals.css`, referenced as `left: var(--thread-x)` and `padding-left: calc(var(--thread-x) + 56px)`.

**Resolving the "one element cannot change colour on ink sections" flaw.** It cannot, so it is not one element. The thread is **per-section**: every `<Section>` renders its own absolutely positioned 1px rule at `var(--thread-x)`, spanning that section's full height, coloured `var(--c-line)` on light grounds and `var(--c-line-d)` on ink. Sections abut with zero gap, so the thread reads as continuous from the wordmark to the footer. The draw animation is likewise per-section (section 7.2), which is *better* than one global scroll-driven scaleY: it draws as you arrive at each section rather than as a single progress meter, which also kills the "the thread is a race bar" objection.

---

## 4. TYPE SYSTEM

### 4.1 Scale

All display is Gulams Condensed, uppercase, single weight 600. Tokens on `.tf-light`:

```css
--t-mega:  clamp(40px, 13vw, 132px);   /* hero + closing only */
--t-loud:  clamp(34px, 9vw, 96px);     /* section openers */
--t-mid:   clamp(24px, 5vw, 52px);     /* feature heads, pull quotes */
--t-stat:  clamp(72px, 22vw, 260px);   /* the 256 only */
--t-price: clamp(56px, 16vw, 180px);   /* price numeral only */
```

At `min-width: 1024px`, `--t-mega` and `--t-loud` swap their vw term so the headline cannot collide with the portrait:

```css
@media (min-width: 1024px) {
  --t-mega: clamp(72px, 9.5vw, 132px);
  --t-loud: clamp(56px, 7vw,   96px);
}
```

**Why 9.5vw:** the desktop headline column is capped at 56vw. 16 characters at 0.352em must fit in 56vw, so `font-size ≤ 56vw / (16 × 0.352) = 9.94vw`. At 9.5vw the cap of 132px is reached at 1390px, and above that the headline stops growing while the column keeps growing, so the gap to the portrait only ever widens. **The overlap bug that killed the original hero at 1440 and 1920 is arithmetically impossible under this rule.**

**Leading and tracking.** `line-height: 0.86` at mega and loud, `0.94` at mid. Accented Spanish caps rise 226 units above cap height in this face, so 0.82 leading (which two losing directions specified) collides `Á` on line N+1 with line N. **0.86 is the floor. Do not go tighter.** Tracking is em-relative, never fixed px: `-0.01em` at mega, `-0.005em` at loud, `0` at mid. Do **not** globally mutate `.tf-display`: 41 files inside the logged-in product reference it. Create `.tf-mega`, `.tf-loud`, `.tf-mid`, `.tf-stat`, `.tf-price` as new classes.

### 4.2 Inter

- Long-form body: 17px / 1.68, `var(--c-ink)` at full ink on light, `rgba(255,255,255,0.78)` on ink. Measure capped at **44ch desktop, 34ch mobile**. Never 62ch. The short measure is also what absorbs Spanish running 20 to 25 percent longer without reflowing anything.
- Eyebrow / label: 11px, 600, uppercase, tracking 0.2em, `var(--c-soft)`. Sits behind a 12px tick on the thread. No badge, no icon, no chip.
- **Testimonial body: 19px / 1.7 Inter Regular, `var(--c-ink)`, full ink, never italic, never grey, never display caps.** Her clients' words carry the same weight as her headlines. That one decision is the trust argument.
- **Testimonial attribution: 15px / 600 Inter, full ink, sentence case, with city and language.** Not 11px uppercase grey. The critics were right: if the thesis is that the client outranks the marketing, the *name* is the proof and it cannot be set as fine print.

### 4.3 What replaces the two-tone grey, exactly

Four devices. **A section uses at most one.** No two adjacent sections use the same one. Assignment table in section 11.

1. **RULE BREAK.** Line 1 solid, a full-bleed 1px hairline, line 2 solid. The rule carries the hierarchy, not a tint.
2. **INLINE KNOCKOUT.** The subordinate line gets `background: var(--c-ink); color: var(--c-bg); padding: 0 0.12em; box-decoration-break: clone;` so it is a knocked-out inline block that wraps correctly. On ink grounds, inverted.
3. **SCALE STEP.** The second line is set at **1.28× the first**, not smaller and not lighter. It dominates by mass, which is a positive signal where grey was a negative one.
4. **GROUND INVERSION.** The whole section flips to ink with cream type. The contrast comes from the band, not from the word.

**Outline / `-webkit-text-stroke` is banned from this page.** Three independent critics converged on it: it inverts perceived weight (so it *is* the grey trick with better PR), it breaks up on mid-range Android sub-pixel rendering, `paint-order: stroke fill` is a no-op with a transparent fill, it is invisible to automated contrast tooling, and its floor of ~56px means it cannot exist at all at mobile display sizes. It also, in every direction that proposed it, ended up marking Spanish as the hollow language. Gone.

### 4.4 Handwriting is cut

Caveat, the rotated lowercase asides, the wobbling SVG underline, the hand-drawn arrow at the price, and the script signature are all removed. Three critics independently identified that stack as the off-the-shelf "authentic personal brand" kit (Stan Store / ConvertKit / MLM funnel grammar) and as the single fastest way to make a real coach read as a funnel. Warmth comes from the copy and from the one full-colour photograph, not from a Google script face pretending to be her hand.

If and when Stephanie writes eight phrases on paper and they are traced to SVG paths, they can be added back as real marks. Until that asset exists, it does not exist.

---

## 5. LAYOUT AND RHYTHM

### 5.1 Grid

```css
.tf-plate {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  column-gap: clamp(12px, 1.6vw, 28px);
  padding-inline: var(--gutter);
}
--gutter: clamp(16px, 3.2vw, 56px);
```

**There is no max-width on the grid.** At wide viewports the columns get wider and the vw-clamped display type keeps up; body copy never inherits that width because it is capped at 44ch and pinned to a named span.

Below 768px the 12 columns are declared but every span rewrites to `1 / -1` or `1 / 9`.

### 5.2 The right-side inventory (this is the rule that keeps the page from decaying)

Deleting the centered container removes the safety net. A left-anchored ragged-right page reads as confident only if **every** section has something deliberate on the right. Three permitted options, and this is a PR checklist item, not a guideline:

- **(a) a bleeding photograph**
- **(b) a second column of real content**
- **(c) a hard stop at 52vw with a ragged right edge and the thread's tick furniture**

The critics correctly did the asset math: there are 3 portraits and 4 screenshots against 18 sections, so option (a) cannot carry the page and would have produced twelve consecutive right-bleeds. **Hard cap: option (a) is used exactly five times.** The distribution is fixed in section 11 and is not negotiable during build.

### 5.3 Vertical rhythm (four beats, no two adjacent the same)

```css
--beat-tight:  clamp(48px,  7vw,  80px);
--beat-normal: clamp(88px, 12vw, 148px);
--beat-open:   clamp(128px, 19vw, 220px);
--beat-bleed:  0;
```

Assigned per section in the table in section 11. **No two consecutive sections share a beat value.** The commitment section is deliberately asymmetric: tight above, open below, so it reads as her pausing.

Use `svh` and `dvh`, never `vh`. Any full-height section is `min-height: 92svh`, never `100svh`, so the next beat always peeks.

---

## 6. THE HERO

### 6.1 Nav stays. This is non-negotiable.

The winning direction specified "no nav bar on mobile." **Rejected.** `MarketingNav` holds the only EN/ES twin link, the only route to pricing and sign-in, and the only crawlable path from `/` to `/es`. Removing it on the device that carries almost all traffic, on a bilingual product, is a broken entry point, not confident minimalism.

Changes to the nav, minimal:
1. The EN/ES twin link gets a **44px minimum tap target** and moves to `13px` on all breakpoints (currently 12px on mobile). It is the most important control on the page for half the audience and it is currently the smallest thing in the bar.
2. Nav height is measured, never assumed. It is locale-dependent. Write it to a CSS variable:

```js
// one tiny client component, ResizeObserver on the header
document.documentElement.style.setProperty('--nav-h', `${h}px`);
```
with `--nav-h: 68px` as the CSS fallback. Every hero height calculation uses `calc(100svh - var(--nav-h))`.

### 6.2 Portrait choice and treatment

Use **`steph-footer.avif`** (760x1126, clean alpha cutout, direct eye contact, hands resting on her own midsection). Not `steph-hero.avif`, which is an arms-up flex on a baked-in dark grey gradient panel. "I am fitter than you" is the wrong first frame for a woman who has failed before. Hands on her own body with a direct gaze says "I have this body too." This reasoning governs every asset choice on the page.

**The portrait renders in full natural colour.** This overrules the winning direction's `grayscale(1)`.

Rationale, because this will be questioned: the brand constraint is a monochrome *palette*, cream and ink and white. It does not require desaturating the only human being on the page. Three audience-lens critiques independently flagged that draining a curvy Latina woman in a yellow crop top to grey is the coldest possible reading of the rule, that it disconnects the page from the colour Instagram grid the visitor just came from, and that it converts the single warmest asset in the folder into wallpaper. Colour used exactly once, on exactly one subject, on an otherwise monochrome page, is a stronger art direction than colour used nowhere. It also removes a `filter` from the LCP element, which is a measurable performance win.

Treatment, therefore:
- No filter. No blend mode. No duotone sandwich. No shadow. No radius. No card. No slab.
- One `-webkit-mask-image` / `mask-image: linear-gradient(to bottom, #000 62%, transparent 96%)` on the bleeding edge only, so she dissolves into the cream instead of terminating in a seam. **This mask is load-bearing structure, not polish, and it is the first thing to check on a real device.**
- Never place a mask or blend inside a `position: sticky` ancestor (iOS Safari stacking bug). No sticky section on this page contains a masked photograph.

### 6.3 Mobile hero, measured (375 x 812, real numbers)

Usable height after browser chrome ≈ 744px. Minus nav (68px EN / 68px ES) = **676px of fold**.

| Element | Height | Running |
|---|---|---|
| top padding | 24 | 24 |
| eyebrow, 11px | 15 | 39 |
| gap | 20 | 59 |
| headline, 3 lines @ 13vw (48.75px) × 0.86 | 126 | 185 |
| gap | 22 | 207 |
| sub, 3 lines @ 16px / 1.65 | 79 | 286 |
| gap | 24 | 310 |
| CTA bar, 56px | 56 | 366 |
| gap | 14 | 380 |
| trial line, 15px / 1.5 | 23 | 403 |
| gap | 16 | 419 |
| proof line, 13px | 18 | **437** |

**239px of remaining fold** goes to the portrait, which bleeds off the right edge at 76vw and off the bottom of the fold, cropped at roughly mid-torso *while her face sits in the visible upper third*. She is behind the type at z-index 0; type is z-index 2 with no blend.

At **320px**: 13vw = 41.6px, three headline lines = 107px, so the budget gains 19px. Sub wraps to 4 lines, costing 26px. Net +7px. **The fold holds at 320.**

At **iPhone SE (667px tall, ~460px usable after chrome and nav)**: the portrait band collapses to zero and the trial line plus proof line drop below the fold. Accepted. The CTA at 366px still clears. Verify this device explicitly; it is common in LATAM.

**Instagram in-app webview:** usable height runs roughly 40 to 60px shorter than Safari and `svh` resolution there is unreliable. Because the hero is a *flow* layout with a `min-height`, not a fixed-height composition, it degrades by simply showing less portrait. Do not build the hero as an absolutely positioned composition; it must survive an unexpected viewport height by cropping the photo, never by pushing the CTA down.

### 6.4 Desktop hero (1024+)

Thread at 88px (or the 1440+ formula). Headline in the left **56vw**, three lines at `--t-mega`, solid ink, no second tone, **RULE BREAK** as its hierarchy device. Portrait occupies the right **40vw starting at 60vw**, top-aligned so her eyes land near 32vh, bleeding off the right and bottom edges with the same bottom mask. CTA is an inline ink bar, 260px wide. Proof sits on the thread beneath it behind a 12px tick.

### 6.5 Hero copy (authored per locale, not translated)

EN, three lines, all ≤ 13 characters:

```
THE WOMAN
WHO KEEPS
SHOWING UP
```

Sub: *"That is who you become here. Not in twelve weeks. Over a life you actually like living. Workouts I filmed myself, food that still tastes like home, and me in your corner in English or in Spanish."*

CTA: **START WITH ME**
Under CTA, 15px, full ink, **not micro type**: *"3 days free. Cancel anytime, no phone call and no guilt."*
Proof, one line, 13px: **256** in ink semibold + *"women coached one to one"* in `--c-soft`.

ES, three lines, authored to the same character budget:

```
LA MUJER
QUE VUELVE
CADA DIA
```

Sub: *"Eso es lo que te vas a volver aqui. No en doce semanas. En una vida que de verdad te gusta vivir. Entrenamientos que grabe yo, comida que todavia sabe a casa, y yo contigo en ingles o en espanol."*

CTA: **EMPIEZA CONMIGO**
Under CTA: *"3 dias gratis. Cancela cuando quieras, sin llamadas y sin culpa."*
Proof: **256** + *"mujeres que entrene una por una"*

Flag for Stephanie: the Spanish here is written, not translated, and it still needs her eyes. The bar is already set by `src/messages/es.json`, which contains real written Spanish ("como te salga", "ya te fallo una app antes"). Every remaining string must clear that bar. **Do not ship machine Spanish anywhere, and specifically never code-switch inside one line** (`562,000 SIGUIENDOLA` is exactly the tell that ends trust).

### 6.6 The 562,000 decision, resolved

**256 is the largest numeral on the page. 562,000 is not shown above the fold and is not the monument.**

Two of three lenses argued this independently and they are right: 562,000 is a reach metric that reads as "you will be one of 562,000, get in line," and it invites the reader to compute that 561,744 people did not buy. 256 women who actually paid and stayed is the trust proof, and this page sells trust. 562,000 appears once, in the stats section, at `--t-loud`, under a label that frames it as reach and not as proof.

Have this argument with Stephanie explicitly. Do not ship it quietly.

---

## 7. MOTION

**Engine: native CSS scroll-driven animations plus `position: sticky`. Zero animation JS. Zero new dependencies.**

Everything scroll-linked runs off the main thread, which is exactly what saves the mid-range Android this audience is on. `ScrollStory`'s existing rAF + reduced-motion architecture is kept as the fallback pattern where a timeline is not supported.

### 7.1 The support guard, written correctly

```css
@supports (animation-timeline: view()) {
  .tf-reveal { animation: tf-reveal linear both; animation-timeline: view(); animation-range: entry 15% cover 40%; }
}
```

**The `animation-timeline` binding must live inside the `@supports` block, not just the keyframes.** Without that, an unsupporting browser runs the animation once against the document timeline on load and every reveal fires off-screen.

**Invariant, and it is what makes the whole thing safe: nothing on this page is hidden by default.** Every keyframe's 100 percent state is the readable state, and the 0 percent state is applied *by the animation*, never as a standing CSS rule. So a browser without timeline support, a browser with JS off, and a crawler all get the complete page. There is no `initial: opacity 0` shipped in the stylesheet anywhere. This also means no `@supports not (...)` fallback rule is needed, and no headline can ever be permanently invisible.

### 7.2 The four primitives, and that is all

1. **Section reveal.** `opacity 0 → 1`, `translateY(14px) → 0`, `cubic-bezier(0.16, 1, 0.3, 1)`, over `entry 15% cover 40%`. Applied to **section openers and interruptions only.** Never to body paragraphs. **Never staggered across list items**: stagger on a five-item list is the tell of a template.
2. **Thread draw.** Per-section, `transform: scaleY(0) → 1`, `transform-origin: top`, over `entry 0% cover 30%`. Transform only, never touches layout.
3. **Aperture wipe.** `clip-path: inset(0 50% 0 50%) → inset(0)` over `entry 10% cover 35%`. Used only on the four screenshot plates. A window opening, not a device floating in.
4. **Ticker.** The existing pure-CSS `translate3d` loop from `marquee.tsx`, one duplicated track, duplicate `aria-hidden`, slowed to 42s. Paused off-screen via IntersectionObserver (already in that component).

**Banned outright:** parallax on mobile, count-up numerals, smooth-scroll override, scroll hijacking, `scroll-snap-type` on `html`, `backdrop-filter` beyond the one already on the nav, animated `filter`, animated `background-color`, animated `width`/`height`/`box-shadow`, standing `will-change`, and any `mix-blend-mode` on this page at all.

The only animated properties on the entire route are `opacity`, `transform`, and `clip-path`.

Scroll-linked motion is additionally gated to `@media (min-width: 1024px) and (pointer: fine)` **for the reveal only**. On phones, reveals resolve instantly. A 76vw photograph repainting per frame on a Moto G is the single worst thing this page could do, and the audience it would hurt is the primary audience.

### 7.3 Reduced motion, one authoritative block

```css
@media (prefers-reduced-motion: reduce) {
  .tf-light *, .tf-light *::before, .tf-light *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    animation-timeline: none !important;
    transition-duration: 1ms !important;
  }
  .tf-marquee { animation: none; }
}
```

Plus: the sticky week-story section drops its sticky and renders as a plain stacked list with all four steps visible, and the marquee renders three phrases wrapped statically. Because every keyframe ends at the readable state, this block is safe by construction. It is CSS, so it also holds correctly before hydration.

### 7.4 Texture

**One** non-fixed, non-blended tiled grain layer:

```css
.tf-light { background-image: url("data:image/svg+xml,...feTurbulence 180x180..."); background-size: 180px; }
```

`baseFrequency 0.86`, `numOctaves 3`, `stitchTiles="stitch"`, explicit `width="180" height="180"` on the `<svg>` (without them the intrinsic size is undefined and browsers disagree), opacity baked into the SVG rect at roughly 4 percent, applied on the cream and white grounds only.

**No `position: fixed`. No `mix-blend-mode`.** A fixed blended full-viewport layer must re-blend against scrolling content every frame, which is precisely the jank the perf budget exists to prevent, and it is the reason the winning direction had to switch its own texture off below 640px. This version costs one tiled background paint, is not composited per frame, and therefore **ships on mobile**, where roughly 85 percent of the traffic actually is.

CSP is already fine for this: `src/proxy.ts` sets `img-src 'self' data: https:`.

---

## 8. IMAGES AND PERFORMANCE

- The hero portrait uses `next/image` with `priority`, `fetchPriority="high"`, explicit `sizes`, and explicit intrinsic `width`/`height`. It is the LCP element and carries **no filter, no mask on the LCP-relevant region, no blend**. (The bottom mask affects only the lower 38 percent, which is outside the LCP paint area.)
- Everything below the fold: `loading="lazy"` plus explicit `width`/`height` to hold layout.
- `app-1..4.avif` are re-processed **at build time with sharp** into grayscale, correctly cropped derivatives (section 12). No runtime `filter: grayscale(1)` on 6+ images, which would be 6+ GPU textures and repaint pressure on the target device.
- Two of the existing screenshot sources in `public/assets/images/` are 660KB and 880KB PNGs while everything else in that folder is AVIF. Convert them.
- Budget check on a throttled Moto G class device before merge: LCP under 2.5s, CLS under 0.05, zero long tasks over 200ms during scroll.

---

## 9. THE BILINGUAL SYSTEM (the thing the category gets wrong)

This is the product's actual differentiator and it is treated as function, not decoration.

**Parity rules, all hard:**

1. **Spanish is never the outlined, hollowed, smaller, clipped, or secondary track.** Not in the ticker, not in the bilingual section, not anywhere. Every direction that tried "EN solid / ES outline" made Spanish structurally the echo of English, on a page selling to Latin America. Both languages, wherever they appear together, are set at identical size, identical weight, identical fill.
2. **Display type is authored per locale to 16 characters per line.** Never translated to the same line count. Never hyphenated with `&shy;` to force Spanish into an English grid (and note: `&shy;` written into `en.json`/`es.json` renders as the literal string, it must be the `­` character, and it is invisible in review and gets stripped by translation tooling, so **do not use it at all**).
3. **The EN/ES switch is above the fold, in the nav, at a 44px tap target, on every breakpoint.**
4. **The four app screenshots must exist in Spanish captures for `/es`.** Four English screenshots on a Spanish page is how every app that treats this audience as an afterthought gets caught, and nutrition is the thing she is buying. This is an asset dependency, not a design decision. If Spanish captures do not exist by build time, the feature rows on `/es` ship **type-only** rather than shipping English UI to a Spanish reader.
5. **The five testimonials are currently byte-identical English in both `en.json` and `es.json`.** That is a content gap, not a principle. Two options, pick one before build: (a) source four Spanish testimonials from her 256 clients across LATAM, or (b) run each original quote in the woman's own language with a Spanish rendering beneath it **in the same ink at the same size**. Option (a) is better. Shipping the current state means the loudest human voices on the Spanish page are in English.
6. Per-locale display scaling, if it is ever needed, is one CSS custom property scoped by `:lang(es)`, never a forked component. `src/app/es/page.tsx` re-exports the same component; there is nothing to fork.

**Section 13 (the bilingual pitch) is where the system states itself:** the EN line and the ES line at identical `--t-loud`, both solid, stacked in exact register in the same block, with a single 1px `var(--c-line)` rule between them rotated 4deg via a pseudo-element. Symmetry is the argument. No body copy explaining the promise.

---

## 10. PHONE SCREENSHOTS: THE APERTURE

### 10.1 The diagnosis (verified, and it changes what "fix" means)

The four files are not screenshots. `app-1` (547x960) and `app-2` (647x1183) are two-phone composites; `app-3` (840x1019) is a **three-phone** composite at three different scales. All four have iOS chrome, Dynamic Island and status bars **baked into the raster**, all four carry alpha, and their aspect ratios are 0.57 / 0.55 / 0.82 / 0.60. The "clusters of 2 to 4 mockups at inconsistent scales" is baked into the pixels. **No amount of re-laying-out fixes it**, and the current `Phones` component compounds it by stacking two composites per row, so one feature row can show four phones.

### 10.2 The build-time asset step (required, do this before writing any JSX)

A `sharp` script produces new derivatives checked into the repo:

For each of the four sources, crop to the **front-most, largest single phone**, then crop away the top 44px so no iOS clock survives, then remove the device chrome region, then `grayscale`, then output at 3x the largest rendered size:

| Source | Crop target | Output aspect | Notes |
|---|---|---|---|
| `app-1` | front phone, the video player mid-demo | 4:5 | This crop is a **person** demonstrating an exercise, not a UI |
| `app-2` | front phone, message thread, excluding status bar and input row | 1:1 | A real conversation |
| `app-3` | middle phone, the macro card only, ring at roughly 30 percent of frame | 3:2 | **This is where the green ring lives. Grayscale here is mandatory and is what keeps the page brand-legal.** |
| `app-4` | the single clearest claim region | 4:5 | |

Grayscale is baked, never applied at runtime. Green never reaches a browser on this route.

**Resolution honesty:** the sources are 547 to 840px wide and already lossy. A 2.2x detail crop of a 547px capture upscales compressed UI text and is *less* legible than the whole screen, which defeats the reason for cropping. **Therefore: no crop exceeds 1.4x of its source region, and every plate is rendered at a display size the source can actually support.** If a required crop cannot clear that bar, that row ships type-only. Fresh 3x device-pixel captures from the running app are the real fix and should be requested; the spec ships without them, at four plates instead of six.

### 10.3 The aperture

One component. Identical at every use.

```css
.tf-aperture {
  aspect-ratio: var(--ap, 4 / 5);
  overflow: hidden;
  background: var(--c-surface);   /* load-bearing: fills the alpha so transparent
                                     corners stop leaking the page ground */
  border: 1px solid var(--c-line); /* on non-bleeding edges only */
  border-radius: 0;
}
.tf-aperture img { width: 100%; height: 100%; object-fit: cover; object-position: var(--pos); }
```

- **No device frame. No bezel. No notch. No rounded corners. No shadow. No perspective. No overlap. No rotation.**
- The frame is the constant; the content is the variable. That is the exact inverse of the current page, and it is why inconsistent source dimensions stop mattering: no source edge is ever visible.
- Caption directly beneath, separated by a 1px rule, 11px uppercase tracking 0.2em: `PLATE 02 / NUTRITION`. The caption is what converts a screenshot from evidence of laziness into evidence of craft, and it is where a real amount of the page's warmth lives. Write the captions in her voice, per locale.
- The aperture **shares the page grid**: it spans named columns, aligns to the same baseline, and on exactly two rows it bleeds past the gutter and is clipped by the viewport. A shape the layout cuts cannot look accidental.

### 10.4 Hard rules that encode the thesis

- **Never more than one aperture per section. Never two visible in the same viewport.**
- **No screenshot exceeds 460px on any axis, and no screenshot is ever the tallest element in its band.** Her face is always larger than any piece of UI. The app is evidence; the women are the subject.
- The hero contains **no screenshot at all.**
- Feature row 5 gets **no image**. It gets the numeral watermark instead (section 11.10). The sequence needs a rest, and this is also how five rows come out of four assets without inventing anything.
- Aspect varies per row (4:5, 1:1, 3:2, 4:5, none) and the bleeding side alternates, so five rows do not read as five identical boxes.

---

## 11. SECTION BY SECTION

Order is preserved exactly as briefed. The five testimonials are pulled out of their block and redistributed as **interruptions** between Stephanie's sections, which converts social proof from a module into a rhythm and kills the carousel without replacing it with a grid.

Legend: **G** = ground, **B** = beat, **D** = hierarchy device, **R** = right-side option (a/b/c).

| # | Section | G | B | D | R |
|---|---|---|---|---|---|
| 1 | Hero | cream | bleed | rule break | **a** |
| 2 | Ticker | ink | bleed | ground inv. | full bleed |
| 3 | Interruption 1, Zakeya D. | cream | tight | knockout | c |
| 4 | Problem | ink | normal | rule break | **b** |
| 5 | Commitment | cream | tight above / open below | scale step | c |
| 6 | Interruption 2, Minta T. | white | tight | knockout | c |
| 7 | Stats | cream | normal | scale step | c |
| 8 | A week with me | cream → ink | open | rule break | **b** |
| 9 | Interruption 3, Rowena L. | cream | tight | thread widen | c |
| 10 | Feature rows (5) | cream/white/cream/white/ink | normal | alternating step / knockout | **a** ×4, c ×1 |
| 11 | Interruption 4, Guadalupe U. | ink | tight | ground inv. | c |
| 12 | Origin story | cream | open | rule break | **a** |
| 13 | Bilingual | white | tight | (symmetry is the device) | **b** |
| 14 | Interruption 5, Genesis R. | cream | open | knockout | c |
| 15 | Process (2 steps) | white | normal | numeral watermark | **b** |
| 16 | Pricing teaser | cream | tight | scale step | c |
| 17 | FAQ | white | normal | rule break | **b** |
| 18 | Closing CTA | ink | open | scale step | **a** |

Right-side option (a) count: hero, four feature rows, origin, closing = **7**. Trim to 5 by making feature rows 3 and 5 option (c). Verify this count in review; it is the checklist item that keeps the ragged-right page from decaying.

**11.1 Hero.** Per section 6.

**11.2 Ticker.** Ink strip, 68px tall, full bleed, Gulams at 30px, EN and ES phrases alternating with a 6px white square between. Both languages at identical size and fill. The only full-bleed thin band on the page.

**11.3 Interruption 1 (Zakeya D.).** Placed **before** the problem section on purpose: her quote is about having stopped taking progress photos, and that is the reader's actual emotional state at second five. This is the single sharpest editorial judgment in the whole exercise and it survives even with no photograph. Quote at 19px full ink, attribution at 15px full ink with city.

**11.4 Problem.** Full-bleed ink. Headline `--t-loud` white, left. Three points hang off the thread with their own ticks, 17px / 1.7 at `rgba(255,255,255,0.78)`, 28px gaps, 44ch, stopping at 52vw. The right 48 percent carries **option (b)**: a second column holding the same three points restated as short Spanish lines at the same size, not as a caption. **The three points must indict the industry, never the reader.** At this scale on this ground, any sentence about her body or her failed attempts becomes an accusation carved in stone. Write them as "what every app did to you," not "what you did."

*(Note: `steph-about.avif` at 30 percent opacity behind this section, which the winning direction specified, is cut. It needed a blend mode, and there are no blend modes on this page.)*

**11.5 Commitment.** Cream. One `--t-mid` line on the thread. Very short. Tight above, open below, so it feels like she stopped talking. No image, no body copy. This is the only section allowed to be mostly air and it earns it because everything around it is dense.

**11.6 Interruption 2 (Minta T.).** **White ground**, the first white on the page, which reads as a page turn.

**11.7 Stats.** Cream. Not a row. Three numbers stack down the thread at three different scales with gaps of 40 / 88 / 40:
- **256** at `--t-stat` (up to 260px), label *"women I coached one to one"*
- **562,000** at `--t-loud`, label *"women following along"*
- **EN / ES** at `--t-mid`, label *"every screen, every week"*

256 is the biggest number on the page. That is an argument made purely in type size.

**11.8 A week with me.** Cream crossfading to ink. **Reworked from the losing scrollytelling pattern.** It is now text-led: `position: sticky` day label (`LUNES / MONDAY`, both languages, same size), steps as hairline rows down the thread, one 1px progress rule filling in the gutter. **Exactly one aperture appears, at the end of the sequence, and it is not the subject of the section.** Sticky only, no pinning library, no scroll interception, `overflow` untouched on every ancestor. Sticky duration capped at **220vh**; it is the only pinned section on the page. Crossfade is two stacked full-bleed grounds crossfaded on `opacity`, never an animated `background-color`.

**11.9 Interruption 3 (Rowena L.).** No photograph. The quote runs at 22px and **the thread widens from 1px to 3px for exactly the height of this quote.** Emphasis as a structural event instead of a decorative one. More of this, less ornament.

**11.10 Feature rows (5).** Grounds cycle cream / white / cream / white / ink. Text on the thread at `--t-mid`. One aperture per row, bleeding off alternating edges on rows 1 and 4 only. **Row 5 has no image**: it carries the feature number as a Gulams numeral at `--t-loud` in `var(--c-line)` sitting **behind** the text at z-index 0, overlapped roughly 40 percent by the text at z-index 1. Numerals as watermark, which is how you get numbering without a "how it works 1-2-3" grid.

**11.11 Interruption 4 (Guadalupe U.).** Ink ground, the only testimonial on ink. Placed one section before the bilingual pitch so the promise lands emotionally before it is argued. **Note the critique and act on it:** her quote is about leaving her comfort zone and says nothing about language, so do not use her name as a runway for the Spanish section. Either source a quote from her that is actually about language, or move her and put a client whose words are about being coached in Spanish in this slot.

**11.12 Origin story.** **Cream, not ink**, because this is the warmest beat on the page and ink is cold. `steph-hero.avif` at 38vw bleeding off the **left**, past the thread. Its baked-in grey gradient panel is **embraced**: a hard 1px `var(--c-ink)` edge on its two visible sides and a 4px offset, so it reads as a photographic print laid on the page with her head and legs breaking out of it. The seam becomes the point. This is the most confident move available and it converts a defect in the asset into the device. Full colour. Paragraphs at 17px / 1.68 in a 44ch column, first person, her voice. Pull quote at `--t-mid`. **No script signature.**

**11.13 Bilingual.** Per section 9.

**11.14 Interruption 5 (Genesis R.).** The longest quote gets the most room: 22px / 1.7 at 52ch, open beat both sides. Last emotional beat before the ask.

**11.15 Process.** White. Two steps, each headed by its actual verb. Numeral watermark as in row 5. No circles, no badges, no connecting line, no arrow. Step one copy is *"Tell me where you are."* Step two is *"I build the rest."* That sentence is the warmest thing that came out of the whole exercise and it should be treated as canon.

**11.16 Pricing teaser.** Cream, tight. Price at `--t-loud`, **not** at monument scale. Directly under it, at **17px full ink, not 11px micro**: *"3 days free. Cancel anytime, no phone call and no guilt. Same price in every country."* Billing distrust is the category failure this product exists to fix; setting the cancellation terms as fine print under a giant number is the visual grammar of exactly the apps that burned her. **The cancel line is the second most legible thing in this section.** No cards, no three-tier grid, no checkmark matrix. Plan names on hairlines, one CTA.

**11.17 FAQ.** White. Native `<details>`, **all four open by default**, no accordion, hairline separators, no cards, no container. Q at 17px / 600 ink, A at 16px / 1.68 `var(--c-ink)` at 52ch. Zero JS, fully in the RSC payload, fully indexable. Hiding the answers that reduce fear is the wrong trade. Do **not** add `interpolate-size: allow-keywords` to `:root`: that is a global switch that changes `height: auto` transition behaviour across the entire logged-in product.

**11.18 Closing CTA.** Ink, full bleed, `--t-mega` at the top of its range. **The only centered element on the entire page**, which is why it lands. The thread terminates in a 9px dot 40px above the headline. `steph-footer.avif` returns bottom-anchored, in colour, with a top mask, no blend, no mirroring (never horizontally flip the founder). White CTA bar. Under it, at 15px white: *"It's not a race, it's a marathon."* / *"No es una carrera, es un maraton."*

EN closing headline: `COME TRAIN / WITH ME.`
ES closing headline: `ENTRENA / CONMIGO.`

---

## 12. THE CLIENT PROGRESS PHOTOS (`ba-1` through `ba-6`): NOT IN V1

The winning direction hung five of its eighteen sections on these. Cut, for four independent reasons, any one of which is disqualifying:

1. **Consent.** These are real women's bodies photographed in their bedrooms. The current page's own code comments note they did not sign photo releases for a website. Posting to an existing audience and publishing on a public marketing page are materially different acts. **No image ships without written consent per image.**
2. **Decode.** `ba-1`, `ba-2` and `ba-3` fail in libheif ("bad seek", "bitstream not supported"). Two of the three named fallbacks for the highest-stakes slot were in the broken set.
3. **Baked artifacts.** `ba-4` and `ba-6` have bright red heart emoji burned into the raster over the faces.
4. **Framing.** Faces covered, bodies foregrounded, six anonymous torsos repeating down the page is the visual grammar of weight-loss advertising and clinical before/after studies. The file prefix implies pairs. If two frames of the same woman ever sit side by side, this page becomes transformation content and the entire "not a race, a marathon" thesis dies.

**The page is therefore designed quotes-only from the start, not as a degraded fallback.** Every interruption in section 11 is specified with option (c) as its right-side treatment. Nothing needs redrawing if consent never arrives. If consent, re-encodes, and a re-mask of the hearts to a flat ink shape all land later, photographs can be added to interruptions 1, 2 and 5 as an enhancement, and the three-option right-side inventory absorbs them without a redesign.

---

## 13. REJECTED OBJECTIONS (with reasons, so they do not get relitigated)

- **"The thread is one trick repeated eighteen times, same as the grey."** Rejected. The grey was a *value* trick applied to headlines; the thread is a *structural* spine that carries functional furniture (ticks, dots, one width event) and never touches type hierarchy. Hierarchy varies across four devices with an explicit no-two-adjacent rule, which the grey never had. The critique is right that the risk exists, which is why the rotation table in section 11 is mandatory rather than advisory.
- **"Kill the magazine/editorial genre, it's the new generic."** Partially accepted, partially rejected. The specific tells were removed: no vertical-rl folio credit lines, no "PLATE 05 / 14" gutter stamps, no "Issue No. 01" conceit, no outline type, no handwriting, no mirrored founder, no fixed blended grain, no display-caps testimonials. What remains (a left spine, a hairline meter, a short measure, oversized condensed display) is not a genre, it is typographic competence, and abandoning it would just mean picking a different genre.
- **"Grayscale everything for a true monochrome page."** Rejected. Monochrome is a palette constraint on the page's own surfaces. One woman in colour on an otherwise ink-and-cream page is stronger direction than uniform desaturation, warmer for this audience, and faster (no filter on the LCP element).
- **"Remove the nav on mobile."** Rejected outright. It holds the only EN/ES path.
- **"Set testimonials in the display face."** Rejected. Poster-typesetting five real women's words is what makes real testimonials read as fabricated.
- **"Make the price the monument."** Rejected. The cancel line is the load-bearing element of that section.

---

## 14. PRE-MERGE CHECKLIST

1. `grep` for `max-w-[1180px]`, `text-faint`, `text-white/4`, `text-white/5`, `shadow-`, `rounded-[` across `src/app/page.tsx`. All must return zero on this route.
2. `grep` for `framer-motion` and `motion/react`. Must return zero.
3. Every section audited against the right-side inventory: exactly 5 option (a), and every remaining section is (b) or (c). No section resolves to nothing.
4. No two adjacent sections share a beat value. No two adjacent sections share a hierarchy device.
5. Every display line is ≤ 16 characters **in both locales**, verified by rendering `/es` at 320px.
6. `/es` rendered at 320, 375, 390, and 768. Fold budget holds; nothing overflows horizontally.
7. iPhone SE (667px) and the Instagram in-app webview both checked by hand. CTA reachable.
8. `overflow-x: clip` on `html`; zero `overflow: hidden` on any sticky ancestor; zero horizontal scroll at every breakpoint.
9. Dark mode toggled in the app, then navigate to `/`. Page renders cream and ink.
10. Reduced motion on: page complete, marquee static, sticky section stacked, nothing hidden.
11. JS disabled: page complete and readable.
12. Every masked photograph checked on a real iOS device, not DevTools. The masks are the structure.
13. Grayscale verified baked into the app derivatives; zero green pixels anywhere on the route.
14. No em dashes in any string in `en.json` or `es.json` on this route. No occurrence of the word "AI" in any user-facing copy.
15. Throttled mid-range Android: LCP under 2.5s, CLS under 0.05.
16. Spanish copy reviewed by a native LATAM speaker before merge. No code-switched lines. No machine gerunds.

---

## 15. OPEN DEPENDENCIES (block or degrade, stated so nobody discovers them mid-build)

1. **Spanish app screenshots.** Without them, `/es` feature rows ship type-only.
2. **Spanish testimonials**, or Spanish renderings of the five existing ones at equal weight.
3. **Fresh 3x device-pixel app captures.** Without them, four apertures instead of six, and no crop above 1.4x.
4. **Written per-image consent** for `ba-1..6`. Without it, the page ships as specified, quotes-only, with no redesign required.
5. **Stephanie's sign-off on 256 being physically larger than 562,000.** Have the argument out loud.
6. **Stephanie's own handwriting**, eight phrases on paper, if hand marks are ever wanted back.