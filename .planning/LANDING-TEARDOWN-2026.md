# THICK & FIT LANDING PAGE: EVIDENCE REPORT
### Based on 20 pages rendered live 2026-07-22 across five cohorts (fitness hardware, fitness apps, nutrition/macro, creator platforms, premium software, consumer wellness)

A note on method before anything else: every claim below is tied to a measured value from the teardowns. Where I am extrapolating, or where the evidence is thin or absent, I say so in the sentence. I have not invented a single hex, pixel, or pattern.

---

## 1. WHAT THEY ACTUALLY DO

### 1a. Ground colour is decided by audience, not by category

The cohorts split cleanly, and the split is not fitness-versus-software. It is who is buying.

**Near-black grounds** appear on: Tonal (#1C1C1A), Ladder (#0E0E0E), Fitbod (#191923), WHOOP's hero (pure #000), Linear (#08090A), Raycast (#07080A), and Kajabi's alternating dark sections (#0A0A0A). Every one of those is either equipment sold to a performance-identified buyer, or developer tooling.

**Light grounds** appear on: Calm (near-white), Headspace (white), Duolingo (pure #FFFFFF), Flo (pale pink wash over white), MyFitnessPal (white page with a blue hero panel), Cal AI (ivory-to-alice-blue gradient), Noom (cream #F6F4EE), Centr (#FFFFFF), Peloton (white), Strava (white), Skool (bone #F8F7F5), Playbook (#F7F8FD), Arc (cream #FFFCEC).

Every single consumer wellness and consumer nutrition page in the set is light. Calm, Headspace, Duolingo, Flo, Noom, MyFitnessPal, Cal AI. Seven for seven. The only dark-ground fitness apps are Fitbod and Ladder, and both are pitched at a hard-training self-image (Ladder's fold is a celebrity in a concrete gym; Fitbod's is a barbell bench press log).

Also worth noting: warm off-white is having a moment specifically. Noom cream #F6F4EE, Arc cream #FFFCEC, Skool bone #F8F7F5, Cal AI's ivory gradient. Warm-neutral is not a dated choice in 2026. It is one of the more current ones.

### 1b. Accent colour: one, and used narrowly. Except in software, where there is none.

The consumer pattern is a single saturated accent, deployed on very few elements:

- Ladder: acid yellow-green #E6FF00, on two CTA pills, one word in the banner, one word in the nav, and the star glyphs. Nothing else on the page is coloured.
- Fitbod: hot pink #F2305A on button fills, star icons, and uppercase eyebrow labels only.
- Playbook: violet #5F1ECC on the eyebrow line and two pills.
- Flo: pink on the CTA pill, the logo, the stars, and the outline icons.
- Headspace: blue #0061EF on literally every button.
- Duolingo: green #58CC02 on the primary button, the logo, and every section heading.
- Tonal: teal #11DDC4 as systemic button fill.
- Stan: mint #30FFB4 on exactly one button above the fold.
- WHOOP: blue-violet #4A53FF used in exactly one place above the fold, and notably not on the hero button.
- Centr inverts the convention: the accent yellow #F1EF17 is never a fill, it is the type colour inside a near-black pill.

Meanwhile, **premium software has no accent at all.** Kajabi's entire 8,401px page is #FDFDFC, #0A0A0A and one grey; every CTA is a black rectangle; there is exactly one chromatic moment in the whole document. Raycast's palette is white and greys, with its brand red appearing three times in the measured DOM. Linear has no accent in the page chrome whatsoever, and its hero CTA has a transparent background with no border. Cal AI has no brand colour at all.

**This is the single most important disagreement in the data.** Accent-free monochrome is the grammar of products sold to people who already want them. It is not the grammar of consumer subscriptions. Zero consumer fitness, nutrition, or wellness pages in this set are accent-free.

### 1c. Type: sentence case wins overwhelmingly, condensed is extinct, and nobody is shouting

Sentence or title case H1s: WHOOP, Oura, Peloton, Strava, MyFitnessPal, MacroFactor, Cal AI, Noom, Skool, Kajabi, Stan, Playbook, Linear, Raycast, Stripe, Arc, Calm, Headspace, Duolingo, Flo. Twenty of twenty-four measured headlines.

ALL CAPS H1s: Fitbod, Ladder, Centr, Tonal. Four, and all four sell hardware, equipment, or hard-training identity.

Now the part that matters most for Thick & Fit: **not one page in this set uses a condensed typeface.** And the two brands that do go big-uppercase-display both deliberately went the other way. Tonal's H1 is "GT Expanded", weight 900. Ladder's is "EKModenaExtendedHeavy", and the teardown flags this explicitly as "the opposite of the condensed athletic face the category usually reaches for". When a category's two loudest voices both reach for extended, condensed is the sound of the previous cycle.

Face category is near-monolithic: neo-grotesk or humanist grotesk. Inter (Cal AI, MyFitnessPal, Linear, Raycast, Peloton), Roboto (Flo, Skool), Figtree (Calm), Plus Jakarta Sans (Stan), plus a wall of proprietary grotesks (Haffer at Kajabi, Visuelt Pro at Playbook, Söhne at Stripe, Boathouse at Strava, Macro Sans at MacroFactor, Headspace Apercu, Untitled Sans at Noom, Degular at Centr, Proxima Nova at WHOOP). Exactly one serif in twenty-four: Oura's Editorial New, and it is doing a luxury-goods impression at weight 300.

Weight is bimodal and the split is instructive. **Light headlines signal confidence and price:** WHOOP 120px at weight 400, Oura 110px at 300, Stripe 48px at 300, Linear 64px at 510. **Heavy headlines signal energy and hustle:** Playbook 900, Stan 800, Fitbod 700, Arc 700, Calm 700, Headspace 700.

Tracking and leading are consistent almost everywhere: negative letter-spacing at display sizes (WHOOP -3.6px, Oura -5.5px, Kajabi -1.13px, Playbook -1.81px, Linear -1.408px, Stripe -0.96px, Arc -1.6px) and line-height at or below 1.0 (WHOOP 0.8, Playbook 0.90, Arc 0.975, MacroFactor 49px on 52px, Linear exactly 1.0, Centr 43.2px on 48px). Tight and dense is the house style.

Size is inversely correlated with brand strength in the consumer tier. Strava's H1 is 32px. Duolingo's is 32px, smaller than its own section headings. Flo 48px, Calm 49.5px, Skool 45px, MyFitnessPal 48px at mobile breakpoints. The 110-120px monsters are WHOOP and Oura, both selling desktop-researched hardware at $199 to $399.

### 1d. Social proof placement is the sharpest cohort disagreement in the whole set

**Proof physically above the H1, in DOM order:**
- Fitbod: the Apple "Editor's Choice / 250,000+ Reviews" laurel at y246, above the H1 at y351.
- Cal AI: "Loved by 5M users with ⭐ 4.9 rating" avatar pill, first element in the hero, before the headline.
- Flo: five stars plus "Over 7 million 5-star ratings" at y198, above the H1 at y232.
- Stripe: "Global GDP running on Stripe: 1.68501508%" at y163, above the H1 at y224.

**Proof inside the fold but after the headline:** Playbook (four stats at y196-464 plus a creator strip whose alt text carries individual revenue figures), Kajabi ($11B+ / 100K+ / 75M+ at y656 plus named creators with revenue tiers), Ladder (two laurels at y608), MyFitnessPal and Strava and Calm (all carry the number inside the subhead sentence).

**Proof deliberately withheld:** Linear puts its only number, 33,000 teams, at 89% scroll depth. WHOOP has no proof in the first screen and, remarkably, no star rating or review count anywhere on an 11,013px page. Raycast holds testimonials to y6,187 of 15,626. Oura leads its credibility section with a CNBC line about an $11 billion valuation, 5.4 screens down. Peloton's human proof is 4.3 screens down. Duolingo, the biggest consumer app in the entire set, has **no proof of any kind anywhere on its 7,803px homepage.** No rating, no count, no testimonial, no press logo.

The pattern: products with pre-existing category demand withhold. Products that must earn a stranger's click in three seconds front-load. Every product structurally comparable to Thick & Fit, that is, a low-priced consumer app acquired through paid or social channels, front-loads. Cal AI, Fitbod, Flo, Playbook. Four for four.

### 1e. CTAs: one to three, never more, and the vocabulary has shifted

Above-fold conversion CTA counts: Oura 1, WHOOP 1, Ladder 1 (repeated twice with the same label), Linear 1 (and it is a text link to a feature announcement, not signup), MacroFactor 1, Duolingo 2, Kajabi 2, Stan 2, Playbook 2, Cal AI 2 (both store badges), Flo 2 plus badges, Calm 3, Headspace 3 (all three the same voucher link), Fitbod 3, Stripe 4, Centr 3.

Nobody in the set has more than four, and the ones with three or four are running discount offers where all the CTAs resolve to the same URL.

Labels, verbatim: "JOIN NOW", "Explore", "Start for free", "Try Calm for Free", "Get Started", "GET STARTED", "FIND YOUR PLAN", "Download", "Start Free Trial", "Continue", "START NOW FOR FREE", "Try Flo today", "Shop deals", "Get 40% off".

Two labels are doing something more interesting than the rest. Ladder's "FIND YOUR PLAN" and Stan's "Continue" both imply a flow already in motion rather than a transaction. Centr's fixed bar carries "START YOUR FITQUIZ". Noom's nav carries a "Personality Quiz". Headspace's entire section two is a six-cell intent router ("Stress less", "Sleep soundly", "Manage anxiety", "Process thoughts", "Practice meditation", "Start therapy"). The consumer wellness cohort is converging on **quiz-or-router as the first commitment**, not purchase.

Notably absent from every hero in the set: "Learn more". Nobody offers an exit.

### 1f. Imagery: device frames are a minority, and the closest peer does something better

**Bare-cropped product UI, no frame:** Kajabi (six 1280x1590 captures, no chrome), Linear (Cloudflare-delivered screenshots, no frame, no shadow), Arc (four bare browser screenshots), Stan (nine layered PNGs), Playbook (creator cards at 26:35, explicitly not phone aspect), Ladder (a bare 364x150 in-app video), MyFitnessPal (five cropped feature-card mockups), Headspace (a chat card and an audio scrubber floating on coloured cards, no phone).

**Explicit device frames:** Fitbod (two overlapping iPhones, repeated in every feature section), MacroFactor (a three-phone composite plus a half-phone crop), Cal AI (a 700x700 phone-framed hero), Strava (an iPhone plus an Apple Watch), Flo (one iPhone frame).

So device frames are alive, but they cluster in app-store-download products, and the clustered-multiple-phones version is the oldest-feeling of them.

**Flo's treatment is the most current and it is the closest demographic peer in the entire set:** one iPhone-framed screenshot showing a real state (9:41 status bar, "December 17", "Period in 5 days", "Cycle day 25"), surrounded by four UI fragments cropped bare and floating free with no frame at all: a "Symptom patterns" card, a "Cycle trends" line chart, a chat bubble, a search field. One anchor, several unframed proofs of capability.

**Photography of people:** Ladder (a full-bleed 1440x848 celebrity portrait as the entire fold, headline set straight onto it), Centr (coach grid of 15 including Chris Hemsworth), Peloton (instructor lifestyle shots), Kajabi (studio portraits of named creators with revenue tiers in the caption), Playbook (25+ creator portraits), Tonal (eight named coaches), WHOOP (video of a person, plus lifestyle photography). Creator-led and coach-led products all lead with faces.

**And nobody, in twenty pages, shows a before-and-after.** Not one. Not Peloton, not Centr, not Ladder, not Fitbod, not Noom, which is a weight-loss company. Noom's own headline concedes the weight loss entirely to GLP-1 drugs and repositions around maintenance. This is the strongest single piece of evidence in the report, and I will come back to it.

### 1g. Motion: the category has gone quiet

Zero video elements: Tonal, Fitbod, MacroFactor, Cal AI, MyFitnessPal, Noom, Strava, Centr, Skool, Kajabi, Stan, Playbook, Linear, Raycast, Stripe, Calm, Headspace, Duolingo. Eighteen of twenty-four pages.

Autoplay hero video exists on four: WHOOP, Oura, Peloton, Arc. All four sell either hardware or a browser. Ladder ships seven video elements and **none of them autoplay**; all were still paused at currentTime 0 after a full 15,613px scroll. Flo's video is a click-to-play poster.

Keyframe animation is minimal to absent. Playbook runs 10,956px, the longest page in the creator cohort, with **zero @keyframes anywhere**, and its one scroll-stacking sequence is explicitly gated behind `prefers-reduced-motion` and disabled under a capture attribute. Stan's entire 7,865px document has exactly one animation: a 0.3s fade, fired once. Calm showed zero opacity or transform change across a stepped 0 to 2,600px scroll sweep on 65 sampled elements. MacroFactor and Skool are functionally static.

Sticky headers are near-universal. Scroll-jacking is essentially absent (Kajabi loads Lenis; nobody else does). Marquees exist on four pages (Kajabi's 30s product-card loop, Headspace's "find some headspace" repeated 36 times, Arc's 78.5-second testimonial crawl, Stripe's logo carousel), and in every case they are decorative rather than load-bearing.

### 1h. Second-section structure: proof, router, or the differentiator. Never a feature list.

- MyFitnessPal section 2 is pure proof: "5.5 Million 5-Star Reviews" on near-black with six testimonials and store badges.
- Fitbod section 2 is a numbers band: 4.8 Rating / 15M+ Downloads / 120M+ Workouts logged.
- Ladder section 2 is a bare press-logo wall on black with no copy and no CTA.
- Cal AI section 2 is six influencer cards linking out to Instagram Reels.
- Stan section 2 is five named creators with follower counts.
- Headspace section 2 is the six-cell intent router.
- Calm section 2 is three self-select columns: "Stress less." / "Sleep more." / "Live mindfully."
- Centr section 2 is a black proof band with four app-store laurels.
- Duolingo section 2 is "free. fun. effective."
- Kajabi section 2 is the product taxonomy.
- Flo section 2 is the feature run, because Flo already spent four proof claims above the fold.

The rule that falls out: **if proof is not in the fold, section two is proof. If proof is in the fold, section two is a router or the differentiator.**

### 1i. Premium software plays a different game entirely, and it is not transferable

I am separating this because it is where most redesigns go wrong.

Linear's hero has no signup button. The single above-the-fold CTA is an unstyled transparent text link at weight 400 advertising a feature. Raycast puts no image above the fold at all: 390px of empty space, then white Inter on #07080A over a WebGL canvas, first raster image at y1,510 of a 15,626px page. Stripe's headline is two stacked h1 elements with `mix-blend-mode: hard-light`, so the visible colour is computed per-frame and does not exist as a hex. Kajabi's hero conversion element is a bare email input with legal microcopy underneath. MacroFactor has no h1 at all, no subheadline, and not one full sentence of marketing copy above the fold: two words, a product name, and a Download button.

Every one of those is a flex that presupposes the visitor already knows what the product is and arrived intending to get it. Linear can bury 33,000 customers at 89% depth. Duolingo can run zero proof. WHOOP can charge $199 with no star rating on the page.

A $19.97 subscription clicked from an Instagram story by a woman who has never heard the phrase "macro tracking" cannot do any of this. **The premium software cohort is a reference for craft standards, not for structure.**

---

## 2. THE DOMINANT 2026 GRAMMAR

**Genuinely current, and well-evidenced:**

1. Sentence case display type, set tight. Negative tracking around -0.02 to -0.03em, line-height at or under 1.0. Observed on WHOOP, Oura, Kajabi, Playbook, Linear, Stripe, Arc, MacroFactor, Centr.
2. One accent colour, used on almost nothing. Ladder, Fitbod, Playbook, Stan, WHOOP, Flo, Duolingo. Or no accent at all if you are software.
3. Proof placed above the headline. Fitbod, Cal AI, Flo, Stripe. This was not the 2019 pattern and it is now the app pattern.
4. Motion restraint as a mark of quality. Playbook's zero-keyframe 10,956px page and Stan's single 0.3s fade are the current expression of polish. Reduced-motion gating (Playbook) is now table stakes.
5. Bare-cropped UI screenshots without device chrome. Kajabi, Linear, Arc, Stan, MyFitnessPal, Headspace.
6. Quiz or intent router as the first ask instead of a purchase. Ladder "FIND YOUR PLAN", Centr "START YOUR FITQUIZ", Headspace's six-cell router, Noom's Personality Quiz, Stan's "Continue".
7. A single distinctive typeface family carrying both display and body, differentiated only by weight and tracking. Kajabi (Haffer for both), Skool (Roboto for both), Flo (Roboto for both), MacroFactor (Macro Sans).
8. Warm off-white grounds returning in consumer. Noom, Arc, Skool, Cal AI.
9. Footnoted claims. Flo superscripts its H1, its rating line, its subhead and its handwritten line, all resolving to a References section.
10. HSA/FSA eligibility badges. WHOOP, Oura, Fitbod, Tonal, Noom, MyFitnessPal. Six of twenty-four. A real 2026 tic, and entirely irrelevant to a LATAM audience.

**2019 holdovers that are still present but reading old:**

1. Autoplay full-bleed hero video. Only four pages, all hardware or browser.
2. Marquees. Four pages, all decorative.
3. Floating device-mockup clusters. Fitbod's two overlapping phones and Stan's nine layered PNGs are the most dated-feeling imagery in the set.
4. "As seen in" press logo strips. Still present (Fitbod at y3,000, Ladder at y1,052, Oura at y3,916, MyFitnessPal two-thirds down) but always buried, never in the fold, and MyFitnessPal ships them as a single composite PNG with empty alt attributes, which is what you do to something you have stopped believing in.
5. Discount-bar-plus-coupon-headline. Peloton's H1 is literally "Up to $1,200 off select Peloton packages*". Headspace has no h1 at all and its 64px hero line is "Feel your best for our best price: 40% off". Tonal sells its fold to a Klaviyo email modal. This reads as retail, not brand.

**Genuinely dead, by absence:**

- Condensed display faces. Zero of twenty-four.
- ALL-CAPS as a whole-page system outside equipment brands. Four of twenty-four, all equipment.
- Decorative gradients. The only two are Stripe's live WebGL and Calm's CTA fill.
- Hero carousels of marketing slides. Tonal has one, it shipped with `init="false"`, and in a straightforward render it produced a 600px black rectangle where the headline should be.
- Skeuomorphic device shadows and 3/4 perspective mockups.

---

## 3. WHAT ALMOST NOBODY DOES

**Absent and it is a signal, do not fill the gap:**

- **Before-and-after transformation imagery. Zero of twenty-four.** Including Noom, a weight-loss company, which instead conceded weight loss to GLP-1s in its own headline and repositioned to maintenance. Including Peloton, Centr, Ladder, Fitbod. The category has left this behind, and it left independently of any ethical argument. Stephanie's constraint is not a handicap here. It is where the category already went.
- More than four above-fold CTAs. Nobody.
- Condensed type. Nobody.
- Video in the hero unless you sell a physical object. Four exceptions, all physical objects or a browser.
- Star ratings in the hardware cohort. WHOOP has none anywhere on the page. Oura has none. Signal that ratings are an app-store-distribution convention, not a universal trust device.
- "Learn more" as a hero CTA. Nobody.

**Absent and it is an opportunity:**

- **Language treated as first-class chrome.** Only two pages do it. Duolingo's *entire header* is the logo plus "SITE LANGUAGE: English", and a horizontally scrollable language strip is pinned to the bottom of the fold offering 43 options. Noom carries EN/DE/ES/KR in the nav. Both are the most multi-market products in the set. The evidence here is thin, two of twenty-four, and I want to be honest about that. But it is thin because nobody else in this set is bilingual-first, which is precisely the point. Nobody has occupied it.
- **Culturally specific food photography.** MyFitnessPal, the category leader, leads with a generic overhead salad bowl with eggs, greens, tomatoes and radishes, and shows no product at all above the fold. Cal AI leads with influencers, not food. Not one page in the nutrition cohort shows food anyone's grandmother made. Real Latin home cooking as hero imagery is unoccupied and it is literally the product.
- **Naming the coach in the H1.** Only Ladder does it: "HILARY DUFF TRAINS ON LADDER", a headline that does not mention the product, the category, or a benefit. It is the boldest H1 in the set. For a product where 562,000 people already follow the coach and are arriving from her own Instagram, the warm click is being wasted if the fold does not confirm they are in the right place.
- **A stated safety or care posture.** Zero of twenty-four. The nearest analogue is Flo's section three, which sells three trust columns: "Predictions you can plan around", "Personal data that stays private to you", "Powered by doctors, trusted by millions", each with an arrow link out to a deeper page, plus a References section resolving its headline footnotes. There is no observed precedent for surfacing a disordered-eating screen on a landing page. The evidence is absent, not negative. I would still do it, on the strength of Flo's structure, but it is an extrapolation and I am flagging it as one.
- **Printing the price.** Mixed. Calm prints "$203.88" struck to "$79.99/yr" and "$6.67/mo" with a 14-day trial badge and runs the actual checkout on the homepage. WHOOP prints "Starts at $199", Oura "From $349", Peloton prints a full price grid, Centr has a pricing block. But most app subscriptions hide it. At $19.97 the price is an argument, not an objection, which flips the calculus.

---

## 4. WHERE THICK & FIT'S CURRENT PAGE SITS

Blunt version: the client is right, and the reasons are measurable rather than aesthetic.

**Heavy CONDENSED ALL-CAPS display type throughout. This is the worst call on the page.**

Zero of twenty-four pages use a condensed face. Zero. Only four use ALL CAPS, and all four are equipment brands (Fitbod, Ladder, Centr, Tonal), and the two that go biggest with uppercase display both chose *extended* faces: Ladder's EKModenaExtendedHeavy, Tonal's GT Expanded. The teardown of Ladder calls this out unprompted as the opposite of the condensed athletic face the category reaches for. Condensed all-caps is the visual signature of 2018-2021 boutique-gym and supplement branding. It reads as tired because it is.

There is a second, product-specific problem. Spanish sets roughly 20 to 25 percent longer than English, and accented capitals (Á, É, Í, Ó, Ú, Ñ) are hostile to tight all-caps setting: the diacritics either collide with the line above or force the leading open, which destroys the exact density the treatment is trying to buy. On a page where every headline must work in two languages at 390px, condensed caps is a structural liability, not just a stylistic one. That is reasoning, not observation, and I flag it as such, but it compounds the evidence.

**Strict monochrome with no accent colour. Off-trend for this audience, and it is borrowing the wrong cohort's grammar.**

Accent-free monochrome is real and current, but it belongs exclusively to premium software: Kajabi (every CTA a black rectangle, one chromatic moment on 8,401px), Raycast (brand red appears three times in the whole DOM), Linear (transparent hero CTA with no border), Cal AI (no brand colour at all). Every single consumer fitness, nutrition and wellness page in the set has exactly one saturated accent. Ladder, Fitbod, Playbook, Stan, Tonal, Flo, Headspace, Duolingo, Calm, Noom, MyFitnessPal, Centr, WHOOP.

Linear can go accent-free because all the colour lives inside the product screenshot: 90 occurrences of pink #F79CE0, plus peach, periwinkle, cream, teal, all inside the simulated workspace. The page is grey so the product can be loud. If Thick & Fit's page is monochrome *and* the screenshots are monochrome, there is nothing on the page for the eye to land on, and no visual cue for where to tap on a phone.

**iPhone mockup clusters. Half defensible, but it is the tiredest available version.**

Precedented: Fitbod runs two overlapping phones in every section, MacroFactor a three-phone composite, Stan nine layered PNGs. But the premium and creator cohorts have moved to bare crops (Kajabi, Linear, Arc, Playbook, MyFitnessPal, Headspace), and the closest demographic peer, Flo, uses one framed phone as an anchor surrounded by unframed floating UI fragments. The cluster says "app" generically. Flo's arrangement says what the app specifically does.

**Alternating cream and black bands. Defensible, but the rhythm is the problem, not the device.**

Band-flipping to near-black is well precedented: Kajabi flips to #0A0A0A five times, MyFitnessPal flips to #151824 for its proof section, Ladder is black throughout, Duolingo has one navy band for Super Duolingo, Centr uses full-bleed black behind its ratings. But in every case the dark band is *doing a job*: it isolates the proof section or the premium tier. Alternating on a fixed schedule turns punctuation into wallpaper. Use two or three dark bands with intent, not a pattern.

**Warm cream ground. Keep it. This is the one clearly correct decision on the page.**

Noom #F6F4EE, Arc #FFFCEC, Skool #F8F7F5, Cal AI's ivory gradient. Warm off-white is current, it is the right register for a women's coaching product, and it is the only thing distinguishing the page from a generic dark fitness template. Do not throw this out with the rest.

**The 1px vertical rule down the page. Evidence is thin, and I will say so.**

Not one of the twenty-four pages uses a persistent vertical rule. That is not evidence against it, it is an absence of evidence, and a single hairline is a small enough gesture that it could survive. But its associations are editorial-brutalist agency portfolio circa 2021, and it costs horizontal room at 390px where every pixel is contested. I would drop it, but I am not claiming the data proves anything here.

**What is missing entirely and matters more than any of the above:** on the evidence, the two things that should be doing the heaviest lifting in the fold are Stephanie herself and the bilingual capability, and neither is a visual system decision. Ladder proved a coach's name can *be* the headline. Duolingo proved a language selector can be the only thing in the header. Those are the two moves the current page is not making.

---

## 5. THE DIRECTION

Every call below cites the observation it comes from.

### Ground
Warm off-white as the primary ground, roughly in the #FAF8F4 to #F7F5F0 range. Two, at most three, full-bleed near-black bands used as punctuation for specific jobs: one behind the proof section, one behind the price section.

*Why:* seven of seven consumer wellness and nutrition pages are light (Calm, Headspace, Duolingo, Flo, Noom, MyFitnessPal, Cal AI). Warm off-white specifically is current (Noom #F6F4EE, Arc #FFFCEC, Skool #F8F7F5). Dark grounds in this set belong to equipment and developer tooling. Intentional dark bands are precedented as isolation devices (MyFitnessPal's #151824 proof section, Kajabi's five dark flips, Centr's black ratings band).

### Accent
Exactly one saturated colour. It appears on: the primary CTA fill, the star or proof glyphs, and small uppercase eyebrow labels above section headings. Nothing else on the page is coloured. Do not flood a section with it.

*Why:* this is the precise usage pattern at Fitbod (buttons, stars, eyebrows, nothing else), Ladder (two pills, two words, the stars), Playbook (eyebrow plus two pills), Flo (pill, logo, stars, icons). It is the difference between a page with one clickable thing and a page with none.

Choose a hue with high chroma that survives on cream, and give it enough contrast against warm off-white to clear WCAG AA on the button label. If Stephanie's brand insists on restraint, Centr's inversion is the escape hatch: a near-black pill with the accent used as the *type colour inside it*. That is a legitimate, observed, and unusual move that keeps the page quiet and still gives the eye a target.

### Typeface category
One humanist or neo-grotesk family, carrying both display and body, differentiated by weight and tracking only. Free options with the required Latin-Extended coverage: **Inter** (used by Cal AI, MyFitnessPal, Linear, Raycast, Peloton), **Figtree** (Calm, and it is the closest free equivalent to the warm-humanist register), **Plus Jakarta Sans** (Stan), **Roboto** (Flo, Skool).

Display setting: weight 700 to 800, letter-spacing around -0.02em, line-height 1.0 to 1.05.

*Why:* neo-grotesk and humanist grotesk is the near-universal category (Inter, Roboto, Söhne, Haffer, Visuelt, Apercu, Untitled Sans, Figtree, Boathouse, Degular). Single-family systems are the current pattern (Kajabi, Skool, Flo, MacroFactor). Tight negative tracking and sub-1.0 leading is the near-universal display setting. Heavy weight rather than light is correct because Thick & Fit is in the energetic creator tier (Playbook 900, Stan 800, Fitbod 700, Calm 700), not the confident-luxury tier (Oura 300, Stripe 300, WHOOP 400) which requires existing brand demand.

**Hard requirement:** full Latin-Extended-A coverage. Every heading, button label, and eyebrow must render á é í ó ú ñ ¿ ¡ correctly at every weight you ship. Inter and Figtree both do. Verify before committing, because a font that falls back on accented characters will visibly break the Spanish page and nobody will be able to say why it looks wrong.

### Headline case
Sentence case. No exceptions, anywhere on the page, including section headings and eyebrows.

*Why:* twenty of twenty-four headlines are sentence or title case. The four ALL-CAPS pages are Fitbod, Ladder, Centr and Tonal, all equipment or hard-training identity brands. Consumer wellness is zero for seven on caps. Sentence case also solves the Spanish accented-capitals problem for free.

### Headline size
40 to 52px on desktop. 30 to 36px on mobile.

*Why:* the biggest consumer brands run small. Strava 32px, Duolingo 32px, Skool 45px, Flo 48px, MyFitnessPal 48px at mobile breakpoints, Calm 49.5px. The 110 to 120px monsters are WHOOP and Oura, selling $199 to $399 hardware to a desktop-researching buyer. Thick & Fit's traffic is arriving on a phone from an Instagram link. Size the headline for the phone and let desktop inherit.

### Imagery treatment
**One anchor plus fragments.** A single phone-framed screenshot showing the photo-to-macro capture in progress on a real plate of Latin home cooking, surrounded by three or four bare, unframed UI fragments floating free: the macro breakdown card, the cooked-versus-raw toggle, a message from Stephanie, a Spanish-language screen.

Plus real photography of Stephanie, cropped bare to the frame edge, no rounding, no device, no drop shadow.

Never a before-and-after.

*Why:* the one-anchor-plus-floating-fragments arrangement is exactly Flo's, the closest demographic peer in the set, and it communicates specific capability where a phone cluster only communicates "there is an app". Bare-cropped photography flush to the edge is the creator-led convention (Ladder's full-bleed 1440x848 celebrity fold, Playbook's 25+ portrait cards, Kajabi's studio creator shots, Strava's edge-flush bare crop). Zero of twenty-four pages show a before-and-after, including a weight-loss company.

The specific instruction on the food: photograph food a Latin household actually cooks, and make it identifiable. MyFitnessPal, the category leader, uses a generic overhead salad bowl. That is the single most copy-pasted image decision in nutrition and it is unoccupied territory to walk away from it.

### Above-fold anatomy, in DOM order

1. **Language toggle, EN / ES, in the header.** Visible, tappable, two labels, not a globe icon and not a footer link.
   *Why:* Duolingo's entire header is the logo plus "SITE LANGUAGE: English", with a language strip pinned to the bottom of the fold. Noom carries EN/DE/ES/KR in its nav. Evidence is thin at two of twenty-four, and I said so, but both are the most multi-market products in the set and this is the product's declared differentiator. If it is in the footer, it is not a differentiator, it is a setting.

2. **A proof line above the H1.** Stars or a number, in the accent colour. It must be true and pre-launch honest: "256 women coached one to one" or "562,000 women follow Stephanie" work; a fabricated app-store rating does not.
   *Why:* Fitbod's Apple laurel sits at y246 above its H1 at y351. Cal AI's rating pill is the first element in the hero. Flo's five stars sit at y198 above its H1 at y232. Stripe's GDP statistic sits above its H1. All four of the products structurally like this one front-load.

3. **H1, sentence case, 40 to 52px, weight 700 to 800, tracking -0.02em.** It should either name Stephanie or name the differentiator. Ladder's "HILARY DUFF TRAINS ON LADDER" is the precedent for the first; Flo's "We're Flo, the world's #1 women's health app" and MyFitnessPal's "The world's #1 nutrition tracking app" are the precedent for the second. Given 562,000 warm followers, Stephanie's name in the fold is defensible and unusual.

4. **Subhead, 18 to 24px**, carrying the second proof point and the two differentiators in plain language: bilingual, and real food photographed as it was actually cooked.
   *Why:* MyFitnessPal's only above-fold proof is inside its subhead ("Join over 280 million people"). Strava's only proof on the entire desktop page is one clause in the subhead. Flo's subhead carries its 420-million number. The subhead is where the consumer cohort puts the argument.

5. **One primary CTA.** Label it as a flow, not a purchase. "Find your plan" (Ladder), or given the confirmed 3-day trial, "Start your 3 days free" (Calm's "Try Calm for Free", WHOOP's "Try WHOOP for free").
   *Why:* single-CTA folds at Oura, WHOOP, Ladder, MacroFactor, Linear. Flow-framing at Ladder, Stan, Centr, Noom. Nobody in the set offers a "Learn more" escape.

6. **One reassurance line directly under it,** one line, no more.
   *Why:* verbatim precedent at Ladder, "No Credit Card To Start • Cancel anytime", set in the accent colour immediately under the pill. Calm carries "Cancel anytime" in its pricing block.

7. **The hero image**, arranged as in the imagery section.

8. **Optional: the price, in the fold.** $19.97 a month.
   *Why:* Calm prints its full price and runs actual checkout on the homepage. WHOOP, Oura, Peloton and Centr all price above or near the fold. At $19.97, the number closes objections rather than opening them, and it pre-empts the billing distrust the competitive research flagged as a category-wide failure.

### Motion
Sticky header. Scroll-triggered opacity fades on section entry, nothing more. One carousel at most, for testimonials, manually advanced with visible arrows. Zero autoplay video anywhere. Everything non-essential gated behind `prefers-reduced-motion`.

**The hero must render from server HTML and CSS alone, with no JavaScript dependency.**

*Why:* eighteen of twenty-four pages have zero video elements. Playbook's 10,956px page has zero keyframes and gates its one sticky sequence behind reduced-motion. Stan's 7,865px document has one 0.3s fade. Calm showed zero scroll reveals across 65 sampled elements. The autoplay-video exceptions are four hardware and browser brands. And on the JS point: Tonal ships five Swiper carousels with `init="false"` hydrated by Vue custom elements, and in a straightforward render its hero measured 0x0 and produced a 600px black rectangle where its H1 should be. On LATAM mobile networks that is not an edge case, it is Tuesday.

### Section order

1. **Hero**, as specified.
2. **Intent router.** Three or four self-select cards. Something in the shape of: eat the food you already cook / train with Stephanie / do all of it in Spanish or English.
   *Why:* Headspace's section two is a six-cell router, Calm's is three self-select columns, Ladder's third section is a four-up value row, Centr and Noom both open with a quiz. When proof is already in the fold, section two is a router.
3. **The differentiator, shown rather than claimed.** One large section on photographing real home cooking, including cooked versus raw. This is the section that has to carry the page.
   *Why:* MyFitnessPal's feature run leads with Meal Scan; Cal AI built an entire company page around the photo claim. This is the one thing no competitor does well for this audience, per the discovery research.
4. **Stephanie.** Who she is, how she coaches, her voice, her face at full bleed.
   *Why:* creator-led and coach-led products all give the human a dedicated section: Playbook's "You're not doing this alone", Centr's 15-coach grid, Tonal's eight named coaches, Kajabi's and Stan's named-creator walls, Ladder's entire celebrity fold.
5. **Bilingual, as its own section,** with the app shown running in Spanish, not described as available in Spanish.
   *Why:* there is no precedent for this in the set, because nobody in the set is bilingual-first. That absence is the argument for owning it. I am flagging this as extrapolation rather than observation.
6. **Proof.** Real client words with first names and cities or countries, on a dark band.
   *Why:* Calm's exact format is "first name from city" ("Brandy from Houston", "John from Chicago"). MyFitnessPal names five ("Jason L.", "Iain M."). Flo names App Store reviewers with avatars. Playbook names creators with hard numbers. Dark-band isolation is MyFitnessPal's #151824 and Centr's full-bleed black.
7. **Price, what is included, cancel anytime.**
   *Why:* Calm prints price and checkout on the marketing page; Ladder dedicates a section to "100% FREE TRIAL, NO CREDIT CARD NEEDED."
8. **Care and trust column.** Three columns: who reviews the coaching content, what happens to your data, and the promise about how the app talks to you. This is where the disordered-eating screen belongs, framed as care rather than warning.
   *Why:* Flo's section three is exactly three trust columns ("Predictions you can plan around", "Personal data that stays private to you", "Powered by doctors, trusted by millions"), each with an arrow link out to depth, plus a References section resolving its footnoted headline. No page in the set surfaces an eating-disorder screen, so the specific content is unprecedented; the container is not.
9. **FAQ.** Present on Calm (five categories), Headspace, Flo, Kajabi, Stan, Ladder, Raycast.
10. **Closing CTA repeating the hero CTA verbatim.** Near-universal: Fitbod, Ladder, Playbook, Duolingo, Kajabi, Linear, Raycast, Stan, Centr.

---

## 6. WHAT WOULD BE A MISTAKE TO COPY

**1. Linear, Raycast, MacroFactor and WHOOP's restraint.**
Linear's transparent text-link CTA, Raycast's 390px of empty space before the headline, MacroFactor's total absence of an h1 or a single sentence of marketing copy, WHOOP's zero star ratings on an 11,013px page. Every one of those is a confidence flex that presupposes the visitor already wants the product. A stranger clicking through from a story does not. Copying this reads as unfinished, not as premium.

**2. Duolingo's zero proof.**
Duolingo's 7,803px homepage has no rating, no count, no testimonial, no press logo, no award. Duolingo can do that. A pre-launch product at $19.97 with 256 clients cannot. The corollary: use the proof you actually have, and do not invent app-store ratings you have not earned. Flo's superscripts-and-References model is the honest structure for claims you can substantiate.

**3. Cal AI's influencer wall, and this one is the most tempting.**
Cal AI's entire second section is six creator cards linking straight out to instagram.com/reel/ URLs. It looks like the obvious play for a creator-led product. It is wrong here for two reasons. First, it rents other people's authority; Stephanie *is* the authority, and borrowing six other faces dilutes the one asset the product has. Playbook's model is the right one: the creator plus receipts, with the numbers attached to the creator's own name. Second, every one of those links sends a visitor who is already in your funnel back to Instagram. Do not build an exit door in section two for traffic that just came through the front.

**4. Peloton, Headspace and Tonal's discount-first fold.**
Peloton's H1 is a coupon with an asterisk. Headspace has no h1 at all and its 64px hero line is "Feel your best for our best price: 40% off", with all three above-fold CTAs resolving to the same voucher URL. Tonal sells its fold to a Klaviyo modal reading "SAVE $495 ... GET THE CODE". For a coach whose audience arrives on trust and personal relationship, opening with a discount reframes the relationship as a transaction and trains the audience to wait for the next sale. It is also a mobile disaster: a modal covering the fold on a 390px screen kills a warm Instagram click stone dead.

**5. Noom's fork-in-the-fold.**
Noom's hero splits immediately into two products with two logos and two different CTAs ("See if you qualify" / "Start your trial"). The fold becomes a choice rather than a pitch. With one product at one price, there is no reason to introduce a decision before the visitor knows what the thing is.

**6. Any JavaScript-dependent hero.**
Tonal's five `init="false"` Swiper carousels hydrated by Vue produced a black rectangle where the headline should be. Skool's page has zero heading tags and zero img tags because it is entirely client-rendered. Duolingo's raw HTTP response is an 11KB shell whose entire body text is the word "Duolingo". For an audience on Latin American mobile networks this is a conversion cliff, and it is also invisible to every crawler and answer engine you want indexing this page.

**7. WHOOP and Oura's display sizes.**
A 120px headline at weight 400 with -3.6px tracking, or a 110px serif at weight 300, is beautiful on a desktop monitor and unusable at 390px. Related warning: Strava's desktop document is 968px tall because its entire marketing narrative is `display: none` above the mobile breakpoint, so desktop and mobile visitors get structurally different products from one URL. Do not build two pages by accident. Build the mobile page and let desktop inherit it.

**8. Kajabi's email gate on the demo.**
Kajabi's "See exactly how it works" section is a second email-capture form whose submit button reads "Watch Demo →". The demo is gated behind an email. For a product whose entire pitch is "the nutrition tracking is finally not painful", the demonstration of that claim has to be free and visible on the page. Gate nothing before the value is shown.

**9. Any transformation, body-comparison or shrinking framing.**
Zero of twenty-four pages show a before-and-after. Noom, a weight-loss company, wrote a headline that concedes weight loss entirely to drugs. This constraint is not a compromise the founder is imposing on the page. It is where the entire category already stands, and the page should not be the one place that walks it back. It also matters more here than anywhere else in the set, because this is the only product in the comparison set that ships a disordered-eating screen. A landing page that sells on shrinking and then screens for disordered eating in onboarding is not a brand inconsistency, it is a clinical and legal one.

**10. HSA/FSA badges, and the whole US-healthcare trust vocabulary.**
Six of twenty-four pages carry them (WHOOP, Oura, Fitbod, Tonal, Noom, MyFitnessPal). It is a real 2026 convention and it is meaningless to a woman in Mexico City or Bogotá. It is a reminder that this set is US-shaped, and that Thick & Fit's second market has none of the same trust anchors. Where these pages reach for HSA eligibility and Apple Editor's Choice laurels, the LATAM half of this audience needs different proof: the coach's own name, real client words in Spanish from real places, and a visible, honest price in a currency they recognise.

---

### One-line summary
The current page is running the equipment-brand playbook (condensed all-caps, monochrome, phone clusters) for a consumer women's wellness product, and the evidence says that cohort is light-ground, sentence-case, single-accent, proof-above-the-headline, one-CTA, and almost motionless. Keep the cream. Change everything set in type.