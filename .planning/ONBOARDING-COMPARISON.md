# Onboarding: engineering plan

Sources read in full: the six competitor sets (222 + 99 = 321 catalogued questions), `.planning/INTAKE-FORM-TEMPLATE.md`, and our live source: `src/components/onboarding/onboarding-flow.tsx`, `src/lib/onboarding/prediction.ts`, `src/lib/onboarding/goals.ts`, `src/lib/onboarding/goal-pace.ts`, `src/app/api/onboarding/submit/route.ts`, `src/messages/en.json`, `src/messages/es.json`.

**The calorie bug is real and I reproduced it numerically. It is section 5 and it is the single most urgent item in this document.** A 5'2" 200 lb sedentary member is currently told she will lose 0.31 lb per week with no completion date, and a 5'0" 260 lb member is prescribed **0 g of carbohydrate per day**. Both ship today.

---

## 1. Comparison table

"Sets" = the six research sets: Cal AI, MacroFactor, Fitia, Ladder+Caliber, Noom, Women's apps (Flo/Clue/Sweat/Alo). A set counts if any app in it asks.

| Question | Do we ask it | Sets | Verdict |
|---|---|---|---|
| Sex (biological, for BMR) | Yes, `female`/`male`, label "Sex", no opt-out | 6/6 | **Keep, rewrite.** Noom splits sex-at-birth from gender and justifies it inline ("Hormones impact how our bodies metabolize food"). Sweat, a women's app, still ships four options. Ours is bare. |
| Age | Yes, exact, **pre-filled "30"** | 6/6 | **Keep exact** (Mifflin needs it, Caliber takes exact because a coach programs off it), **drop the default.** |
| Height | Yes | 5/6 | Keep. |
| Current weight | Yes, starts empty (correct) | 6/6 | **Keep, add a reciprocity beat.** Noom answers it with "Thank you for sharing!" and asks nothing else on that screen. |
| Goal weight | Yes, **required, blocks Continue** | 4/6 | **Make conditional.** Ladder, Caliber, Sweat, Flo and Clue never ask it. A member who picks only "Feel better" derives to `maintain` and the field does nothing but gate her. |
| Body fat % | Yes, optional, **zero readers** | 1/6 | **Delete or wire it.** Confirmed: `grep bodyFatPct` returns 3 hits, all write-path. MacroFactor's version is a visual picker they publicly describe as having "a small effect" on protein only. |
| Activity level | Yes, five bare adjectives, default `moderate` | 6/6 | **Keep, anchor the options.** Fitia: "Ejercicio 4 a 5 días por semana". MacroFactor anchors to step counts. Adjectives invite ego-inflation. |
| Days per week she can train | **No** | 5/6 | **ADD. P0.** We generate a training program and have never asked how many days to write. |
| Session length | **No** | 2/6 | **ADD. P0.** Ladder 15, Caliber 35. A session she cannot finish is the fastest cancel. |
| Equipment inventory | **No** (only home/gym/both) | 3/6 | **ADD. P0.** Caliber asks the literal list because a human writes against it. "Home" is a bedroom with one band or a garage rack. |
| Where you train | Yes | 3/6 | Keep. |
| Training experience | Yes | 3/6 | Keep. |
| Injuries | Yes, 6 chips | 2/6 | Keep. **Add the free-text follow-up** (template Q7): "what movements hurt, when it started, has anyone treated it". The chips say where, not what to change. |
| Medical conditions | Yes, 8 chips | 3/6 | Keep. |
| PAR-Q safety screen | Yes, 5 chips | 1/6 | **Keep, fix the default** (see §2.7). Only Caliber has anything comparable, and it is one screen of checkboxes. |
| Pregnancy status | Yes, one chip row, **silently defaults to "No"** | 2/6 | **Keep, expand and fix the default.** |
| Postpartum: C-section, pelvic floor, clearance | **No** | 1/6 | **ADD. P0.** Only Sweat has it (`caesareanBirthId`, `weakPelvicFloorId`, medical clearance), and only as a program gate. |
| Diastasis recti | **No** | **0/6** | **ADD.** Nobody in the category asks it. Uncontested. |
| Cycle regularity / does it change training | **No** (we log at `/you/cycle`, never ask) | 1/6 | **ADD.** |
| Perimenopause/menopause as a first-class question | Buried as 1 of 8 condition chips | **0/6 at onboarding** | **ADD.** Flo's only nod is a 45+ age band. Clue makes it a paid mode switch. Real whitespace. |
| Food allergies | Post-paywall only | 2/6 | **MOVE pre-paywall.** An allergy is safety, not preference, and the coach seeds an intro message before she reaches `/you/health`. |
| Diet style / restrictions | Post-paywall chips | 4/6 | Fine post-paywall. |
| What she actually eats, who cooks | **No** | 2/6 | **ADD. LATAM-critical.** Fitia's 89-food picker is their deliberate sunk-cost step and it is Peruvian Spanish (Palta, Choclo, Camote, Betarraga). |
| Foods she will not give up | **No** | **0/6** | **ADD.** Cheapest trust purchase in the whole flow. |
| What she tried before and why she stopped | **No** | 4/6 | **ADD. P0.** Caliber's highest-value field; Noom's whole absolution mechanic is built on it. |
| Emotional/identity goal | Partially (`feel_better` chip) | 4/6 | Upgrade. |
| Pace choice (slow / recommended / fast) | **No** | 4/6 | **ADD. P1.** Cal AI's most-screenshotted screen. Fitia argues *against* the fast option with honest downside bullets and buys credibility doing it. |
| Target date | Yes, optional | 2/6 | **Wire it or cut it.** Exactly one reader in the repo: `supabase/functions/ops-bot/signup.ts:184`, a Telegram line. |
| Relationship with food / ED screen | Post-paywall | 2/6 | **MOVE pre-paywall.** Noom asks it pre-paywall and will refuse the sale. We already have `scoffPositive` wired to it and it currently arrives too late to shape the first plan or the first coach message. |
| GLP-1 / weight-loss medication | Post-paywall checkbox, no dose, no start date | **0/6** | **ADD pre-paywall.** It invalidates the TDEE model and it is the #1 reason a flat week is misread as her failing. |
| UI language | Yes, step 1 | **0/6 ask it** (all locale-detect) | Keep. This is our edge. |
| Food-database language, separate from UI | **No** | 1/6 | **ADD. Bilingual-critical.** Fitia's single sharpest move: run the app in English, search "pollo". |
| Country / region | **No** | 1/6 (geo-detect) | **ADD.** |
| Phone | Yes, pre-paywall | 1/6 | Keep, but see §2.4. |
| Last name | Yes, **twice** (signup + step 2), both required | **0/6** | **Cut one.** Clue asks "Your first name". Fitia's is "Nombre (Opcional)". Caliber asks first name *after* the price. |
| Attribution ("where did you hear about us") | **No** | 3/6 | Add post-paywall, sampled. |
| Referral / promo code | Not in-app | 2/6 | Add at checkout. |
| Explicit health-data consent | No (implicit on submit) | 2/6 | **ADD.** Flo: "Yes, fine by me" / "No, thanks". Clue splits ToS and Privacy into two toggles. |
| How to talk to her when she falls off | **No** | **0/6** | **ADD.** Pure retention, four taps. |
| Progress-photo consent | **No** | **0/6** | **ADD.** She cannot legally post a transformation without it. |

---

## 2. What we ask that we should not

First, a correction to the framing, because it changes every decision below. **Our "pre-paywall" fields are not pre-signup fields.** The account already exists when the wizard starts (`/auth/sign-up` → `/onboarding`), the profile row is written, and `ensureCrmContact` + `upsertGhlContact` fire at step 5. So a field on step 2 does not cost a signup. It costs a *wizard completion*, and an abandoned wizard is a lead we still hold an email address for. That is the opposite of Cal AI, where dropping out at screen 20 means the person is gone forever.

That does not make extra fields free. It makes them cheaper than the brief assumes, and it means the cuts below are about *shame and time*, not about lost signups.

**2.1 Body fat %, pre-paywall. Delete it.**
`onboarding-flow.tsx:159, 247`; `prediction.ts:20`. Three hits across `src/` and `supabase/`, all write-path. The file admits it in its own comment: "the calorie math below never reads it". Nothing in the coach prompt, the You screen, the coach subscriber page's `OnbAnswers` type, or the ops-bot recap reads it. The `body_fat_pct` that *is* read is a different column on `body_measurements`, written only at `/progress`, and onboarding never seeds it.

It is also the single most body-shaming field in the wizard, asked of women who have started over every Monday for years, and **Sweat, the largest women's fitness app in the world, has no body-composition question anywhere in its program selector.** That absence is their design decision, not an oversight.

Two ways out, pick one:
- **Delete** the input, keep the zod field optional for backward compatibility with older clients.
- **Wire it**, which §5 shows how to do in four lines: it becomes the lean-mass anchor for protein and it stops the 0-carb plan. If you wire it, keep it and relabel the hint.

Do not leave it as-is. A field that costs shame and returns nothing is the worst trade in the wizard.

**2.2 Last name, asked twice, required both times.**
`/auth/sign-up` collects it (max 60, required), then `onboarding-flow.tsx:229` requires it again: `firstName.trim() !== '' && lastName.trim() !== ''`. The comment in `submit/route.ts:31` says "the business requires the client's full legal name". Stripe Checkout collects the legal name at payment. Nobody in six sets requires a surname before the plan.

Fix: keep it on signup, make it optional in the wizard (prefilled, editable), drop it from `step1Valid`.

**2.3 Goal weight, required for everyone.**
`onboarding-flow.tsx:222` gates Continue on `weightKg >= 30 && weightKg <= 300` and the goal field shares that path. A member who selects only "Get stronger" or "Fix my nutrition" derives to `maintain` (`goals.ts:49`), her calories are `Math.round(tdee)`, `weeklyKg` is 0, the curve is flat, and the goal weight she was forced to type changes nothing. Make it required only when `deriveGoalDirection() !== 'maintain'`.

**2.4 Phone, pre-paywall, hinted as an account-recovery field.**
Copy: *"So we can reach you if something goes wrong with your account. No spam, ever."* That reason does not survive contact with reality: the actual reason is Twilio launch-week support and the founding-window texts. Keep the field, tell the truth ("So Steph's team can reach you on launch week"), and add the 10DLC-required consent language, because a phone captured under an account-recovery pretext is not a marketing opt-in.

**2.5 The target date.**
Asked at step 3, stored to `onboarding_responses.goal_target_date` and `answers.targetDateIso`. Read by one thing in the repo, a Telegram alert. `assessGoalPace` runs client-side only and its verdict is never persisted. So a member commits to a date, is given an honest pace verdict, and the app never mentions it again. Either wire it (projection tile, check-in copy, the plateau logic) or stop asking. Asking for a commitment and then ignoring it is the exact failure Lenus is being replaced for.

**2.6 The waitlist quiz, asked and then asked again.**
`waitlist_quiz_responses` stores goal, home_or_gym, days_per_week, how_they_eat, preferred_language. The only SELECT anywhere is `src/lib/admin/waitlist-metrics.ts:121`, which reads `tier_candidate` and nothing else. `goals.ts:11` and `labels.ts:61` both say the vocabulary matches "so a lead is never re-asked in different words". The vocabulary matches. **She is re-asked anyway.** And `days_per_week` is sitting in that table right now, which is the field §3.1 says we are missing.

Fix in `src/app/(app)/onboarding/page.tsx`: join `waitlist_leads` on the authed user's email, load `waitlist_quiz_responses`, prefill `primaryGoals`, `trainingLocation`, `language`, and the new days-per-week field. Show the lead her own answers reflected back ("You told me 4 days a week at the gym, still right?"). That is Ladder's coach-fork logic applied to a warm audience.

**2.7 The "None of these" chip is pre-selected before she touches anything. This is a liability defect, not a UX nit.**

`onboarding-flow.tsx:914`:
```tsx
<Chip label={noneLabel} active={selected.length === 0} onClick={onNone} />
```
Nothing selected renders "None of these" as visually active. On the PAR-Q that means **we cannot distinguish "I read the heart-condition question and none apply" from "I scrolled past it"**, and our record says she affirmatively answered No. Same defect on injuries and conditions.

Worse, pregnancy at line 165: `useState<string>('none')` rendered as `selected={[pregnancy]}` means "No" is pre-selected with zero taps. We are recording "not pregnant" for a member who never looked at the question.

Fix, and treat it as a launch blocker:
```tsx
// A safety question with nothing selected is UNANSWERED, not "no". Rendering the
// escape hatch as active before she taps it records an affirmative negative she
// never gave, on the four questions where a false negative can get her hurt.
<Chip label={noneLabel} active={noneChosen} onClick={onNone} />
```
Carry an explicit `noneChosen` boolean per question, initialise pregnancy to `null` not `'none'`, and block Continue on the health step until all four are answered (a tap on "None of these" counts).

**2.8 Client and server bounds disagree, so a valid-looking wizard 500s at the end.**
Client (`onboarding-flow.tsx:219-222`): height 100 to 250 cm, weight 30 to 300 kg.
Server (`prediction.ts:9-10`): height 120 to 230 cm, weight 35 to 300 kg.
A member 4'0" or 66 lb passes every client check, sits through six steps, taps "Show me my plan", and gets `saveError`. Rare, but the failure mode is maximally cruel. Export the bounds from `prediction.ts` and import them into the component.

**2.9 The one thing on this list that earns its screen: the tier selector.**
`$19.97/mo` next to `From $200/mo` next to `$3,000 / 3 mo` is Cal AI's decoy in reverse, and it is anchored on her real pricing history: 230 people paid her $200 to $299 a month. It makes $19.97 read as a tenth of the real thing, which it is. Keep it. Just make sure the answer goes somewhere better than `contacts.product_type`.

---

## 3. What we do not ask that we should, ranked

`[C]` = matters because we are a coaching app, not a tracker. `[LATAM]` = matters specifically for the bilingual audience.

---

### 1. Days per week she can train, and how long a session can be `[C]`

**Why.** We write training programs and have never asked how many days to write. Ladder asks both (Q5, Q15). Caliber asks *capacity* ("How frequently would you **be able to** work out?", Q33) plus session length (Q35). Sweat asks it in the program selector. This is not a nice-to-have, it is the input the product's core deliverable is missing. The intake template calls it out: "program one day under what she says. A woman who hits 3 out of 3 stays. A woman who misses 2 out of 5 quits."

**Enables.** Correct program length selection, and a `days_per_week` field that the waitlist quiz already collected for 656 leads.

> **EN:** "Honestly, how many days a week can you train?"
> Options: 2 / 3 / 4 / 5 / 6 or more
> Hint: "Give me the honest number, not the ambitious one. I would rather build three days you actually hit."
>
> **ES:** "Con honestidad, ¿cuántos días a la semana puedes entrenar?"
> Opciones: 2 / 3 / 4 / 5 / 6 o más
> Nota: "Dime el número honesto, no el ambicioso. Prefiero armarte tres días que sí cumplas."

> **EN:** "And how long can a workout actually be?"
> Options: 20 to 30 min / 30 to 45 / 45 to 60 / An hour or more
>
> **ES:** "¿Y cuánto tiempo puede durar un entrenamiento, de verdad?"
> Opciones: de 20 a 30 min / de 30 a 45 / de 45 a 60 / una hora o más

---

### 2. Equipment: what is actually in the room `[C]` `[LATAM]`

**Why.** We ask home / gym / both. Caliber asks the literal inventory, uncapped, with a free-text Other, *because a human writes the program against it*. Ladder caps at 3 and phrases it as "want to train with" because it is only a matching signal. The research is explicit: **copy whichever matches who is writing the program.** Ours is Caliber's situation. "Home" currently means anything from a garage rack to a yoga mat, and a glute program is either possible or it is not.

`[LATAM]` matters because home-gym equipment penetration and what "gym" means differ across her audience.

> **EN:** "What do you actually have to train with?"
> Options: A full gym / Dumbbells / Resistance bands / A bench / A barbell / Machines / Kettlebells / Just my body
> Hint: "Pick everything you can get to. If it is just you and the floor, that is enough and I will build for it."
>
> **ES:** "¿Con qué cuentas de verdad para entrenar?"
> Opciones: Un gym completo / Mancuernas / Bandas de resistencia / Una banca / Una barra / Máquinas / Pesas rusas / Solo mi cuerpo
> Nota: "Marca todo a lo que puedas llegar. Si son solo tú y el piso, con eso basta y así te lo armo."

---

### 3. Postpartum, pelvic floor, diastasis recti and clearance `[C]`

**Why.** We ask pregnancy status as one chip that silently defaults to No. Sweat runs a server-side survey at `/api/v1/surveys/post_pregnancy_caesarean` carrying `caesareanBirthId` and `weakPelvicFloorId`, plus a medical-clearance confirmation, and routes a yes into four extra foundational weeks and gates advanced content until Week 13. **Nobody in any of the six asks about diastasis recti** (Sweat only names it in program copy). Her audience is women with children. This is the largest single whitespace in the category and it is directly in her lane.

**Enables.** Blocking crunches, sit-ups and full planks for the women who should not be doing them; a real postpartum track; a defensible liability record.

Show only when pregnancy status is `postpartum` or the free-text notes mention birth.

> **EN, screen header:** "Since you gave birth, have you noticed any of these?"
> Sub: "If you have, you are not alone. These are common, and they change what we do first, not whether we do it."
> Options: A bulge or a ridge down the middle of my belly when I sit up / Leaking when I jump, cough or sneeze / Heaviness or pressure down low / Back or hip pain / None of these
>
> **ES:** "Desde que diste a luz, ¿has notado alguna de estas?"
> Sub: "Si sí, no eres la única. Son comunes, y cambian qué hacemos primero, no si lo hacemos."
> Opciones: Un bulto o una línea que salta en medio del abdomen cuando me siento / Se me sale un poco de orina al saltar, toser o estornudar / Sensación de peso o presión abajo / Dolor de espalda o cadera / Ninguna de estas

> **EN:** "How long has it been?" Options: Less than 6 weeks / 6 weeks to 3 months / 3 to 12 months / More than a year
> **ES:** "¿Cuánto tiempo ha pasado?" Opciones: Menos de 6 semanas / De 6 semanas a 3 meses / De 3 a 12 meses / Más de un año

> **EN:** "Has your doctor cleared you to exercise?" Options: Yes / Not yet
> **ES:** "¿Tu doctor ya te dio permiso para hacer ejercicio?" Opciones: Sí / Todavía no

Note the option is "Not yet", never a bare "No" (Flo's pattern K, used seven times in their pregnancy branch). Any of the first three symptoms shows a warm referral line and sets a flag the plan generator reads.

---

### 4. Weight-loss medication, with the dose and the start date `[C]`

**Why.** **Zero of six ask this.** We have a `glp1` checkbox at `/you/health` section 6, post-paywall, with no dose and no date. In 2026 a meaningful share of her signups are on one. Three things break without it: (a) the Mifflin TDEE is wrong because intake is suppressed, not expenditure; (b) muscle loss is the real risk and protein targets have to change; (c) **a flat or miserable week almost always lines up with a dose increase, and without the start date the coach reads it as her failing.** That is the exact moment a member quits.

> **EN:** "Are you using a weight-loss shot right now?"
> Options: No / Yes / Prefer not to say
> Then: "Which one, what dose, and when did you start?" (short text)
> Then: "What are you noticing?" Options: Barely any appetite / Nausea / Low energy / I cannot eat enough protein / I feel weaker training / None of these
>
> **ES:** "¿Estás usando alguna inyección para bajar de peso?"
> Opciones: No / Sí / Prefiero no decir
> Después: "¿Cuál es, qué dosis y cuándo empezaste?"
> Después: "¿Qué has notado?" Opciones: Casi no tengo hambre / Náuseas / Poca energía / No logro comer suficiente proteína / Me siento más débil entrenando / Ninguna de estas

---

### 5. What she tried before, and what made her stop `[C]`

**Why.** The highest-value field in Caliber's 30-question intake (their Q50: "the #1 single biggest obstacle holding you back"). Noom builds its entire absolution mechanic on it. Cal AI's "What's stopping you from reaching your goals?" is theatre by their own admission but still makes the user name an enemy so the product becomes the answer. **We ask nothing about history.** For a coach whose whole asset is that she reads it back to you in week six, this is the gap that matters most for retention.

> **EN:** "What have you tried before, and what made you stop?"
> Hint: "Say it however it comes out. This is the part that tells me what to never put you through again."
>
> **ES:** "¿Qué has intentado antes y qué hizo que lo dejaras?"
> Nota: "Dilo como te salga. Esta es la parte que me dice qué no volver a hacerte pasar."

Store to `client_intake.intake_notes` alongside the existing free text, and surface it verbatim in `seedIntroMessage` so her first message in the inbox references it. That is the entire product promise in one field.

---

### 6. Food, honestly: who cooks, and what she will not give up `[C]` `[LATAM]`

**Why.** We ask zero food questions pre-paywall and only allergen chips post-paywall. Fitia's 89-item food picker is the heaviest step in their flow and the deliberate sunk-cost trap. Caliber asks meal frequency and variety.

The LATAM angle is where this becomes an unfair advantage. **Fitia's 89 foods are Peruvian Spanish** (Palta not aguacate, Pecanas, Choclo, Camote, Vainitas, Betarraga, Granadilla), their own flow is inconsistent about it (the picker says "Palta" while a card two screens earlier says "Aguacate"), the sample recipe ships untranslated as "Avocado Chicken Sandwich", and I confirmed their `GET /api/foods?countryCode=` returns the identical 89 items for us, mx, pe, co, ar and es. **The Spanish-language category leader is serving Andean vocabulary to Mexico and Central America.** That is our opening and it costs one question.

> **EN:** "In a normal week, how much of your food do you cook yourself?"
> Options: Almost all of it / About half / Mostly takeout or restaurants / Someone else cooks for me
>
> **ES:** "En una semana normal, ¿cuánta de tu comida cocinas tú?"
> Opciones: Casi toda / Como la mitad / Casi todo es para llevar o restaurante / Alguien más cocina para mí

> **EN:** "What are you not willing to give up?"
> Hint: "Tell me now and I build around it. A plan with no room for your mom's cooking is a plan you quit."
>
> **ES:** "¿Qué comidas no estás dispuesta a dejar?"
> Nota: "Dímelo desde ahora y lo armo alrededor. Un plan sin espacio para la comida de tu mamá es un plan que dejas."

"Someone else cooks for me" is a peer option, not a footnote, because in a lot of her audience's households it is the honest answer.

---

### 7. Food-database language, separate from the interface language `[LATAM]`

**Why.** Fitia's single sharpest move: a dropdown labelled "Idioma de alimentos" (Español / Inglés) sitting on the food picker, independent of the UI locale, so a US-raised bilingual Latina runs the app in English and searches "pollo". We ask language once, at step 1, and use one answer for both. That is wrong for exactly the person this app exists for.

> **EN:** "When you search for food, which language do you think in?"
> Options: English / Español / Both, let me switch
> Hint: "Two different things. You can read the app in English and still look up 'pollo'."
>
> **ES:** "Cuando buscas comida, ¿en qué idioma piensas?"
> Opciones: Inglés / Español / Las dos, déjame cambiar
> Nota: "Son dos cosas distintas. Puedes leer la app en español y buscar 'chicken breast'."

Ship as `profiles.content_locale` decoupled from `ui_locale` (both columns already exist and are currently written to the same value in `submit/route.ts:103-104`).

---

### 8. Country or region `[LATAM]`

**Why.** Fitia geo-detects and defaults to `'us'` when unknown, then applies country only to local *brand* products. We never touch it. Two payoffs: regional food vocabulary (§6/§7), and the LATAM currency work in `CLAUDE.md` needs the country to instrument authorization rate by issuing country.

> **EN:** "Where are you?" Options: United States / México / Colombia / Perú / Ecuador / Guatemala / Otro
> **ES:** "¿Dónde estás?" same list.

Default from geo, present it as confirm-or-change. One tap for almost everyone. Ladder's lesson from their Q1 ("Do you have an iPhone or iPad?") is to put the funnel-killing segmentation on screen one; for us the equivalent is language plus country, and language is already there.

---

### 9. Cycle, and perimenopause `[C]` for women

**Why.** We built `/you/cycle` and never ask at intake, so the coach's cycle-phase line only ever fires for the members who go find the feature. Flo asks regularity, length, last start, flow, product, cramps, PMS coping and mood swings. Irregular or missing cycles are the PCOS and under-eating signal, and we already ask PCOS as a condition chip without ever asking the symptom that indicates it.

Perimenopause is separately worth a first-class question: **none of the six ask it at onboarding.** Flo has no menopause goal option and shunts it to a marketing quiz; Clue makes it a paid mode switch under More Menu.

> **EN:** "Is your period regular? Does it change what you can train?"
> Options: Regular and it barely affects me / Regular but some days are rough / Irregular / I do not have a period right now / Prefer not to say
>
> **ES:** "¿Tu periodo es regular? ¿Cambia lo que puedes entrenar?"
> Opciones: Regular y casi no me afecta / Regular pero hay días duros / Irregular / Ahora mismo no tengo periodo / Prefiero no decir

> **EN:** "Anything changing hormonally right now?"
> Options: No / Perimenopause / Menopause / I think so but I am not sure / Prefer not to say
> Hint: "Hormonal changes look different at every stage. It changes the plan, not the goal."
>
> **ES:** "¿Hay algún cambio hormonal ahora mismo?"
> Opciones: No / Perimenopausia / Menopausia / Creo que sí pero no estoy segura / Prefiero no decir
> Nota: "Los cambios hormonales se ven distintos en cada etapa. Cambia el plan, no la meta."

Note "I think so but I am not sure" as a first-class option, per Flo's pattern B ("I don't know" is separate from "No", shipped on regularity, weight change, sex drive and conditions).

---

### 10. Allergies, moved pre-paywall `[C]`

**Why.** Currently `/you/health` section 1, post-paywall, and it is rendered to the coach as a hard "ALLERGY (never suggest, can be dangerous)" line. But `seedIntroMessage` fires at onboarding submit and the first plan is generated before she ever reaches `/you/health`. So the one screen in the app that can kill someone is behind the paywall and behind the first coaching interaction. Caliber tags theirs `data-category='nutrition'` and asks it in the main survey for exactly this reason.

Move the allergen chips plus the free-text allergy box to the health step of the wizard. It is one chip row on a screen that already has four.

---

### 11. "How do you want me to talk to you when you fall off?" `[C]`

**Why.** **Zero of six ask it.** Template Q36. It is four taps, it is pure retention, and it is the difference between a woman who comes back and one who ghosts. It also directly configures the coach persona, which is the product.

> **EN:** "When you fall off, how do you want me to talk to you?"
> Options: Gently, remind me why I started / Straight up, tell me what to fix / Check on me more that week / Give me space, I will come back
>
> **ES:** "Cuando te caigas, ¿cómo quieres que te hable?"
> Opciones: Con cariño, recuérdame por qué empecé / Directo, dime qué corregir / Búscame más esa semana / Dame espacio, yo regreso

Store to `client_intake.custom_fields.coachingTone` and inject it into the coach system prompt.

---

### 12. Weight CHANGE, not level

**Why.** Flo's pattern H, and the research calls it "the single wording swap that most reduces shame". Flo takes height and weight as bare fields at 89% progress with zero commentary, no BMI, no category, no "ideal weight", and the follow-up is about change: "Has your weight changed recently? Yes / No / I don't know." Change is a symptom. Level is an identity.

> **EN:** "Has your weight changed much this past year?"
> Options: It has gone up / It has gone down / About the same / I do not know
>
> **ES:** "¿Tu peso ha cambiado mucho este último año?"
> Opciones: Ha subido / Ha bajado / Más o menos igual / No sé

---

### 13. Explicit health-data consent, and photo consent

**Why.** We collect PAR-Q answers, pregnancy status, medical conditions and injuries with no consent step beyond an implicit terms agreement at signup. Flo gates its health block behind a plain-language refusable consent ("Yes, fine by me" / "No, thanks"). Clue splits Terms of Service and Privacy Policy into two separate toggles as a deliberate brand signal. Sweat has a standalone health-data consent distinct from the ToS.

Photo consent is separate and legally load-bearing: she cannot post a transformation photo without it, and it needs a per-post yes on top.

> **EN, before the health step:** "Next I need to ask about your body and your health, so the plan is safe for you. Only Steph and her team see it, and you can change any of it later."
> Buttons: "That's fine" / "Skip these"
>
> **ES:** "Ahora te voy a preguntar de tu cuerpo y tu salud, para que el plan sea seguro para ti. Solo Steph y su equipo lo ven, y puedes cambiarlo cuando quieras."
> Botones: "Está bien" / "Sáltalas"

> **EN:** "Your progress photos: what are you okay with?"
> Options: Only my coach sees them / Steph can ask me before sharing any / Steph can share them
> **ES:** "Tus fotos de progreso: ¿con qué estás de acuerdo?"
> Opciones: Solo mi coach las ve / Steph me puede preguntar antes de compartir alguna / Steph las puede compartir

---

## 4. Order and pacing

### The premise in the brief is not what the evidence says

"Every one of these competitors invests heavily before asking for money" is false, and the split is the most useful finding in the whole research set.

| App | Where the money ask lands |
|---|---|
| **Sweat** (women's fitness, Kayla Itsines) | **Paywall is screen ONE on web.** Price, plan and trial timeline before a single question. Account is screen two. Questions after. |
| **Alo Moves** (women's) | Account, then billing, then the survey, which is behind the login and explicitly optional (SET PREFERENCES / SKIP FOR NOW). |
| **MacroFactor** | **Account is the FIRST screen**, before any question. No paywall in the flow at all; the trial is account-attached. |
| Cal AI | Paywall at ~34 of 39, after the plan reveal. Account at ~32. |
| Fitia | Paywall after 18 questions + account, reached by middleware redirect. |
| Noom | Paywall at ~33. ~40 more questions run *after* the card. |
| Caliber | Price at screen 43 of 45, before name and email. |
| Ladder | Never asks for money in-flow. Email at 26 of 27. |
| Flo | Paywall last, after ~38 steps. |
| Clue | Paywall at screen 16 of 17, dismissible with an X. |

**The two cycle apps and the two trackers earn the sale with 16 to 53 screens of free personalisation. The two women's fitness apps take the card first.** The research states the reason plainly: cycle apps have to earn trust for health data before anything else. Fitness apps do not.

And the deeper split, from Noom's own live bundle: **pre-paywall Noom asks only what produces a number and a promise (~25 questions). Post-paywall it asks the ~40 that configure the product.** Before the card it manufactures being-understood. After the card it manufactures being-invested. It moved the expensive, low-conversion-value questions behind the money.

### The case AGAINST changing our order, which is stronger than it looks

1. **Her traffic is warm.** 562K followers and 265 migrating clients. The 30-to-53-screen quiz is an instrument for converting *strangers* who arrived from a TikTok ad. Cal AI ran **123 A/B experiments, 160 paywall designs and 424 variants** to arrive at theirs, and their co-founder is on record that it was not designed, it was tested into existence. We have eight weeks and one shot. Sweat, the closest analogue to Stephanie's business, decided the brand does the convincing and put the price first.

2. **Account-first makes drop-off recoverable.** Because `/auth/sign-up` precedes the wizard, an abandoned wizard leaves us an email, a profile row, a GHL contact and a CRM contact. Cal AI's screen-20 abandoner is gone forever. Ours is a nurture segment. **This is the strongest argument in the document for leaving the structure alone, and we are currently not exploiting it at all.**

3. **We already show the plan before the price.** Step 3 is the prediction with the calorie number and the macro line; step 4 is the tier selector; checkout is after. That *is* Cal AI's shape (plan reveal → account → paywall), just with the account moved to the front. The claim that we "paywall immediately" is not accurate to the code.

4. **The liability, not the economics, sets the intake.** Caliber vs Ladder is the cleanest illustration in the research: Ladder is one coach broadcasting pre-filmed programs to thousands and asks **nothing** medical, not one question. Caliber is 1:1 and must. Stephanie sits closer to Caliber on liability (real programming, real messaging, real 1-on-1 tier) and closer to Ladder on economics. **The intake has to match the liability.** So the answer to "cut the health step to reduce friction" is no. It stays pre-paywall, and it grows.

### The case FOR changing

Only one part of the order is genuinely wrong, and it is not the paywall. **It is that the wizard has no pacing at all.** Six steps, a bare percentage bar, zero interstitials, zero reflection, zero reward for answering. Compare:

- Ladder: 27 screens, **13 questions and 13 interstitials, almost exactly 1:1.** You never answer more than two questions without being sold something.
- Caliber: 45 screens, roughly 2:1, with a **3-step bar carrying named sections** (Demographic Profile / Workouts and Nutrition / Habits and Behaviors) and every interstitial marked `hide-progress`, so **the bar does not move while you are being sold to.** Progress only advances on real questions, which makes the sell feel free.
- Fitia: two named act-break interstitials with Rive animations, so a 19-question quiz reads as three short quizzes, plus the literal string "No te preocupes, luego lo puedes cambiar" under three different questions.
- Noom: answers the current-weight field with "Thank you for sharing!" and asks nothing else on that screen.
- Clue: answers a cycle-length entry with "The cycle length you selected, 29 days, is within typical ranges" **and a peer-reviewed citation on the screen.**

Our step 2 is a single scroll containing name, name, phone, sex, units, age, height, weight, goal weight, body fat, activity, experience and location. **Thirteen inputs on one screen with no break, no reason given for any of them, and no reflection back.** That is the friction problem, not the paywall.

### One recommendation

**Do not move the paywall. Do not move the account. Break step 2 into three, add four non-question screens, and build the abandoned-onboarding recovery that account-first already makes possible.**

Concretely, the new order (times are the target, measured on a mid-range Android on LATAM mobile data):

| # | Screen | Type | Note |
|---|---|---|---|
| 0 | Language + country | question | Ladder's screen-one disqualifier logic. One tap each. |
| 1 | Primary goals (multi) | question | Unchanged. Prefilled from the waitlist quiz where we have it. |
| 2 | "Here is what we do with that" | **interstitial** | Names the three chapters. Section 1 of 3: *You*. |
| 3 | Name (first only required) + phone | question | Last name optional. Honest phone reason. |
| 4 | Sex, age, height, weight | question | Weight last on the screen, alone. Each field carries its own one-line reason. |
| 5 | **"Thank you for sharing."** | **interstitial** | Noom's move. Nothing asked. One screen. |
| 6 | Goal weight (only if direction ≠ maintain) + weight change | question | |
| 7 | Activity, days/week, session length, equipment | question | Section 2 of 3: *How you train*. |
| 8 | Experience + where you train | question | |
| 9 | Consent line before the health block | **interstitial + consent** | Flo's pattern. "That's fine" / "Skip these". |
| 10 | Injuries + free text | question | Section 3 of 3: *Anything I should know*. |
| 11 | Conditions + cycle + hormonal stage | question | |
| 12 | Pregnancy → postpartum branch | question | Branch only when it applies. Most members skip in ten seconds. |
| 13 | PAR-Q + allergies + medications | question | |
| 14 | "What have you tried before?" free text | question | |
| 15 | Building your plan | **timed loader, 6 to 8s** | Itemised: Calories, Protein, Carbs, Fat, Training days. |
| 16 | **The plan reveal** | payoff | Calories, macros, rate, ETA, 12-week projection. Unchanged content, better staging. |
| 17 | Pace choice: slow / recommended / fast | question | Cal AI's most-screenshotted screen. Each option live-updates the ETA. The fast option carries the honest downside, Fitia-style. |
| 18 | Tier | question | Unchanged. |
| 19 | Checkout | money | |

That is 15 questions plus 5 non-questions, against today's ~20 fields in 6 screens. **It does not add net time.** It adds three sell-or-breathe beats and a real payoff, and it cuts three dead fields.

Progress bar: replace `((step + 1) / TOTAL) * 100` with Caliber's named-section bar, and **do not advance it on the interstitials.**

Then build the thing account-first buys us and we are throwing away: a **48-hour abandoned-onboarding sequence** keyed on `profiles.id` with no `onboarding_responses` row, in her voice, referencing the step she stopped on. That is a lead-recovery channel none of the six can build, because none of them have her email at that point.

---

## 5. The calorie bug

Confirmed. Two defects in `src/lib/onboarding/prediction.ts`, compounding, both shipping today. I reproduced both across the realistic input range.

### Bug A: the safety floor is above the deficit for every sedentary member, so the deficit never happens

`src/lib/onboarding/prediction.ts:69`:
```ts
if (input.goal === 'lose') calories = Math.max(Math.round(tdee - 500), Math.round(bmr * 1.1));
```

The floor is expressed against **BMR**, but the deficit is expressed against **TDEE**. At `sedentary` the activity factor is 1.2, so:

```
tdee - 500 > bmr * 1.1
1.2·bmr - 500 > 1.1·bmr
0.1·bmr > 500
bmr > 5000
```

**No human has a BMR of 5000.** So for every sedentary member the floor always wins, and `calories` is always exactly `1.1 × BMR`, which yields a fixed deficit of `0.1 × BMR` (roughly 130 to 170 kcal) no matter what she asked for.

At `light` (1.375) it needs `bmr > 1818`. Almost no woman in her audience clears that, so light is floored too. Only `moderate` and above escape, and `moderate` happens to be our default, which is why nobody caught this: **the default value hides the bug.**

Measured, against `onboarding-flow.tsx` defaults and real body types:

| Member | TDEE | Calories shown | Actual deficit | Rate shown | ETA tile |
|---|---|---|---|---|---|
| 5'2" 200→160 lb, 45, **sedentary** | 1803 | 1652 | **-151** | **0.31 lb/wk** | **"Steady" (null)** |
| 5'3" 165→140 lb, 38, **light** | 1921 | 1537 | -384 | 0.77 lb/wk | 33 wk |
| 5'4" 180→150 lb, 32, **light** | 2081 | 1665 | -416 | 0.84 lb/wk | 36 wk |
| 5'4" 180→150 lb, 32, moderate | 2346 | 1846 | -500 | 0.99 lb/wk | 31 wk |
| 5'0" 260→198 lb, 50, **sedentary** | 2063 | 1891 | **-172** | **0.35 lb/wk** | **"Steady" (null)** |

The 5'2" 200 lb sedentary member needs 129 weeks at that rate, which exceeds `MAX_PROJECTION_WEEKS = 104`, so `weeksToGoal` returns `null` (line 95-98) and the tile renders `statEtaUnknown`: **"Steady" / "Your goal is a long way out. We will re-check as you go."** The member with the largest goal and the most to gain from this app gets the screen that refuses to tell her when.

### Bug B: protein and fat are anchored to total bodyweight, which crushes carbs to zero

`prediction.ts:74-76`:
```ts
const protein_g = Math.round(2.0 * input.weightKg);
const fat_g = Math.round(0.9 * input.weightKg);
const carbs_g = Math.max(0, Math.round((calories - protein_g * 4 - fat_g * 9) / 4));
```

Fixed macro cost is `2.0×4 + 0.9×9 = 16.1 kcal per kg of bodyweight`. At 118 kg that is 1900 kcal against a 1891 kcal target, so `Math.max(0, ...)` **silently clamps carbohydrate to zero**. The member is shown:

> `P236 · C0 · F106 g`

Zero grams of carbohydrate per day, prescribed to a woman who never asked for keto, in an app whose audience eats rice, beans, tortillas and plátano. The `Math.max(0, ...)` is what hides it: without the clamp it would have gone negative and someone would have noticed. Even short of the clamp, the plan is already broken: 44% of calories from protein at 200 lb, 48 g of carbs at 90.7 kg.

`bodyFatPct` is collected on the same screen and would fix this exactly. It has zero readers.

### The fix

Replace `prediction.ts:68-78`:

```ts
  // Deficit rules, in order. The old code was `Math.max(tdee - 500, bmr * 1.1)`, which compared a
  // TDEE-relative deficit against a BMR-relative floor. At activity 1.2 the floor wins unless
  // BMR > 5000, so EVERY sedentary member silently got a ~150 kcal deficit and a 0.3 lb/week
  // projection, and the heaviest members got no ETA at all because 129 weeks exceeds the horizon.
  // A safety floor has to be expressed in the same currency as the thing it is flooring.
  const MAX_DEFICIT_PCT = 0.20;                              // never more than 20% below TDEE
  const ABSOLUTE_FLOOR_KCAL = { female: 1200, male: 1500 };  // hard minimum intake

  let calories: number;
  if (input.goal === 'lose') {
    calories = Math.round(
      Math.max(tdee - 500, tdee * (1 - MAX_DEFICIT_PCT), ABSOLUTE_FLOOR_KCAL[input.sex]),
    );
  } else if (input.goal === 'gain') {
    calories = Math.round(tdee + 300);
  } else {
    calories = Math.round(tdee);
  }

  // Protein and fat anchor to LEAN mass when we know it, otherwise to goal weight, never to total
  // bodyweight. 2.0 g/kg of a 118 kg body is 236 g of protein, which leaves literally zero carbs on
  // a 1891 kcal target; 2.0 g/kg of her goal weight is 180 g and leaves a plan she can eat.
  // This is also the first and only reader of bodyFatPct, which has been collected and discarded
  // since the field shipped.
  const leanKg = input.bodyFatPct ? input.weightKg * (1 - input.bodyFatPct / 100) : null;
  const refKg = leanKg
    ? leanKg * 1.15                                                    // ~2.3 g/kg of lean mass
    : Math.min(input.weightKg, Math.max(input.goalWeightKg, input.weightKg * 0.75));

  const protein_g = Math.round(2.0 * refKg);
  const minFat_g = Math.round(0.5 * refKg);                            // hormone-health minimum
  let fat_g = Math.round(0.9 * refKg);

  // Carbs get a floor too. Below this the plan stops being something a woman who eats rice, beans
  // and tortillas can follow, and nobody asked her whether she wanted keto. Trim FAT to make room,
  // never protein; if even the fat minimum cannot buy the floor, the calorie target itself is too
  // low, so raise it rather than ship a zero-carb plan.
  const MIN_CARBS_G = 90;
  let carbs_g = Math.round((calories - protein_g * 4 - fat_g * 9) / 4);
  if (carbs_g < MIN_CARBS_G) {
    const trim = Math.min(Math.ceil(((MIN_CARBS_G - carbs_g) * 4) / 9), fat_g - minFat_g);
    fat_g -= Math.max(0, trim);
    carbs_g = Math.round((calories - protein_g * 4 - fat_g * 9) / 4);
  }
  if (carbs_g < MIN_CARBS_G) {
    calories = Math.round(protein_g * 4 + fat_g * 9 + MIN_CARBS_G * 4);
    carbs_g = MIN_CARBS_G;
  }
```

Leave `weeklyKg` and everything below it unchanged: they read `calories` and `tdee` and are correct once `calories` is.

Measured after the fix, same inputs:

| Member | Before | After |
|---|---|---|
| 5'2" 200→160, sedentary | 1652 kcal, P181 **C48** F82, 0.31 lb/wk, **no ETA** | 1442 kcal, P145 C90 F56, **0.73 lb/wk, 55 wk** |
| 5'0" 260→198, sedentary | 1891 kcal, P236 **C0** F106, 0.35 lb/wk, **no ETA** | 1650 kcal, P180 C91 F63, **0.84 lb/wk, 74 wk** |
| same, with body fat 48% entered | identical (field ignored) | 1650 kcal, **P141 C128 F64** (the field now does something) |
| 5'3" 165→140, light | 1537, P150 C84 F67, 0.77 lb/wk | 1537, P127 C129 F57, 0.77 lb/wk |
| 5'4" 180→150, moderate | 1846, P163 C134 F73, 0.99 lb/wk | 1877, P136 C196 F61, 0.95 lb/wk |
| 5'7" 140→128, very active | 2182, P127 C290 F57, 0.99 lb/wk | 2182, P116 C313 F52, 0.99 lb/wk |
| 5'6" 120→115, sedentary | 1586, P109 C118 F49, 0.29 lb/wk | 1270, P104 C108 F47, **0.64 lb/wk, 9 wk** |

Every case now has an ETA, a non-zero carb allowance, and a rate between 0.6 and 1.0 lb/week.

**Ship with a test.** `.qa-visual/` already holds `goal-pace-test.mjs` and `et-bounds-parity-test.mjs`; add `prediction-invariants-test.mjs` asserting, over a grid of sex × age 18-70 × height 145-185 × weight 45-140 × all five activity levels × all three directions:
1. `carbs_g >= 90` always.
2. `calories >= ABSOLUTE_FLOOR_KCAL[sex]` always.
3. `calories <= tdee` when goal is `lose`, and `calories >= tdee * 0.8`.
4. `protein_g * 4 + carbs_g * 4 + fat_g * 9` is within 25 kcal of `calories`.
5. When goal is `lose` and the goal weight is reachable in under 104 weeks, `weeksToGoal !== null`.

Invariant 5 is the one that would have caught this. **Do not tune `MIN_CARBS_G` and write its test in the same commit** (the same rule `CLAUDE.md` applies to the scan fat-bias threshold).

### Two smaller defects in the same file, fix in the same pass

- **`bodyFatPct` is dead.** Three hits, all writes. The fix above makes it the lean-mass anchor, which is the only honest justification for asking a woman for it. If you do not adopt the fix, delete the field.
- **Client and server bounds disagree** (§2.8): `prediction.ts` says height 120-230 cm and weight 35-300 kg; `onboarding-flow.tsx:219-222` says 100-250 and 30-300. Export `HEIGHT_CM_RANGE` and `WEIGHT_KG_RANGE` from `prediction.ts` and import them.

---

## 6. Unsafe or off-brand in our current wording

**6.1 The PAR-Q records an answer she never gave.** Covered in §2.7. `onboarding-flow.tsx:914` renders `"None of these"` as `active={selected.length === 0}`. A member who scrolls past the heart-condition, chest-pain, dizziness, joint-problem and BP-medication question produces a record that says she affirmatively answered No to all five. **Safety and liability. Launch blocker.**

**6.2 Pregnancy defaults to "No" with zero taps.** `onboarding-flow.tsx:165`, `useState<string>('none')`, rendered as selected. We record "not pregnant" for members who never looked. Flo, which asks the hardest version of this question, ships "Prefer not to answer" on it and asks it as *history* ("Thank you. Next, have you ever been pregnant?"), never as an assumed default.

**6.3 "I've struggled with disordered eating" as a chip she has to tap about herself.**
`app.health.opt.food.struggled`, EN: *"I've struggled with disordered eating"*. ES: *"He tenido problemas con la alimentación"*.

The Spanish is fine. **The English asks a woman to apply a clinical diagnosis to herself in a chip row.** Flo's nearest equivalent puts "Poor self-image" inside a list that also contains "I'm totally fine" as an equally valid answer, and never names a disorder. Noom asks the clinical version ("Do you have an active diagnosis of an eating disorder?") but stages it with "Thank you for sharing. We know this can be sensitive", a separate confirmation screen, and a hard stop.

Rewrite to match the Spanish, which is already right:
> EN: *"Food and I have had a hard history"*
> ES: *"La comida y yo hemos tenido una historia difícil"* (keep the current string as an alternative)

And the section stem, currently `app.health.sec.food.q`: *"So we support you the right way, anything to be mindful of?"* is so vague it reads as a euphemism the member has to decode. Replace with Flo's construction, which normalises before the answer:
> EN: *"How are you and food right now? There is no wrong answer here, and it changes how I talk to you, not what you get."*
> ES: *"¿Cómo van tú y la comida ahora mismo? Aquí no hay respuesta incorrecta, y cambia cómo te hablo, no lo que recibes."*

**6.4 `app.health.opt.pregnancy.none` is the bare string `"No"` / `"No"`, under the question "Anything we should know right now?"** Flo's pregnancy branch never writes a bare No: it uses "No, not yet", "It's coming up", "Not yet", "No, I'd like to know more", "No, not at the moment". Every negative is temporary or a request for help. Ours answers a question about her reproductive status with a flat "No". Change to `"None of these right now"` / `"Ninguna ahora mismo"`.

**6.5 Nothing licenses imprecision, anywhere.** Flo ships *"It's OK to give us your best guess. Even a rough estimate can help us give you more accurate insights. You can always change it later."* as a modal AND repeats it inline on the field. Clue's answer to "I don't remember" is literally **"That's okay."** as the first two words of the next screen, followed by a fuzzy picker (~1 week ago / ~2 weeks ago) instead of a calendar. Fitia ships *"No te preocupes, luego lo puedes cambiar"* under three separate questions.

We ship this under the goal weight, the current weight, the height, the age, the body fat and the target date: nothing. Add one string, reused:
> EN: *"A rough number is fine. You can change it any time."*
> ES: *"Un número aproximado está bien. Lo puedes cambiar cuando quieras."*

**6.6 `statEtaUnknownSub`: "Your goal is a long way out. We will re-check as you go."**
EN and ES both. This string is the visible symptom of the calorie bug in §5, and it currently fires for **the heaviest members with the biggest goals**, which is precisely the woman this app exists for, at the exact screen where we are asking her to trust the plan. After the §5 fix it should almost never fire. If it does fire, it should not say "a long way out". Rewrite:
> EN: *"This one is a longer road, and we do it in chunks. I will show you the next 12 weeks and we set the one after that together."*
> ES: *"Este camino es más largo, y lo hacemos por partes. Te muestro las próximas 12 semanas y la siguiente la ponemos juntas."*

**6.7 `sec.safety.note`: "Thanks for sharing. Please get your doctor's OK before starting intense exercise, and your coach will keep things gentle."**
It is warm, which is right, but it is only advisory. Sweat's postpartum guard-rails are a persistent state that re-prompts on every boundary crossing for months ("we do not recommend doing Challenges until you have reached Phase 3 (Week 13)... Are you sure you want to do this challenge?"). Ours is a one-time note on a wizard step, and nothing downstream reads `safety` to gate anything. Either wire it into the plan generator and the workout player, or the note is a promise we are not keeping.

**6.8 `notesWhy`: "I read all of it." / "Yo leo todo."**
This is in Stephanie's first person, on a 2000-character box, and it is not true: `extractIntakeNotes` runs a model over it and a human reads it only if `needs_coach_review` fires. This is the sharpest brand risk in the wizard, because the entire premise is that this is *her*, and the first thing she says in her own voice is a promise about her personal attention that the system does not keep. Either route every non-empty intake note to a human queue at launch volume (265 members, it is a day of reading), or soften to something true:
> EN: *"Nothing here gets lost. It goes straight onto your file."*
> ES: *"Nada de esto se pierde. Va directo a tu expediente."*

**6.9 Clean.** Zero em dashes in `src/messages/en.json` and `src/messages/es.json`. Zero word-boundary "AI" in EN, zero "IA" in ES. Both brand rules hold in the onboarding surface.

---

## Implementation order

**P0, before Sept 27, in this order:**
1. §5 calorie fix + `prediction-invariants-test.mjs`. One commit for the fix, a separate one for the test.
2. §2.7 / §6.1 / §6.2 the PAR-Q and pregnancy default. Liability.
3. §2.8 bounds parity.
4. §3.1 days per week + session length, §3.2 equipment. The training program has no inputs without them.
5. §3.10 allergies moved pre-paywall.
6. §6.3, §6.4, §6.8 copy fixes.

**P1, before Sept 27 if it fits:**
7. §4 the re-paced wizard (three sections, four interstitials, named progress bar).
8. §2.1 body fat: wire it (free, it is inside the §5 fix) or delete it.
9. §2.6 waitlist prefill. The data is already in the table.
10. §3.3 postpartum branch, §3.4 GLP-1, §3.5 what you tried before.
11. §3.11 coaching tone.

**P2, post-launch:**
12. §3.6 food, §3.7 food-database language, §3.8 country, §3.9 cycle and perimenopause, §3.12 weight change, §3.13 consent screens, and the abandoned-onboarding sequence from §4.

**Files touched:** `src/lib/onboarding/prediction.ts`, `src/components/onboarding/onboarding-flow.tsx`, `src/app/(app)/onboarding/page.tsx`, `src/app/api/onboarding/submit/route.ts`, `src/lib/health-profile/labels.ts`, `src/messages/en.json`, `src/messages/es.json`, plus one new `.qa-visual/prediction-invariants-test.mjs`.