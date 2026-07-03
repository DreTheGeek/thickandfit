// Seed the operator QA checklist (idempotent: skips if items already exist for the company).
// Usage: node .qa-visual/seed-qa-checklist.cjs   (repo root; reads .env.local)
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) { let v = m[2].trim(); if ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// [category, title, detail]
const ITEMS = [
  // ---- 1. Brand & Design ----
  ['1. Brand & Design', 'Logo matches brand everywhere', 'Check header/auth pages/PWA install icon/emails. Wordmark = brand black/white vector, never stretched or blurry.'],
  ['1. Brand & Design', 'Brand colors consistent', 'Light monochrome system per the 7.1 handoff: ink black on warm paper, no stray olive/green accents from the old rebrand. Compare 5 random screens.'],
  ['1. Brand & Design', 'Display font consistency', 'Headings use the display face consistently (coach + member sides). No default-font flashes on slow loads.'],
  ['1. Brand & Design', 'No user-facing "AI" anywhere', 'Sweep visible copy in EN and ES (chat empty states, hints, cards). The word AI/IA must never appear; it is Stephanie\'s method, her voice.'],
  ['1. Brand & Design', 'No em dashes in copy', 'Spot-check long copy blocks (billing terms, hints). House rule: no em dash character anywhere.'],
  ['1. Brand & Design', 'PWA install icon crisp', 'Install to a real iPhone + Android home screen. Icon = sharp wordmark on black, correctly masked (no white box, no blur).'],
  ['1. Brand & Design', 'Empty states styled, never blank', 'Fresh account: dashboard, diary, community, progress, inbox all show designed empty states with a next action, not white voids.'],
  // ---- 2. Auth & Onboarding ----
  ['2. Auth & Onboarding', 'Signup requires email verification', 'Create account with a real inbox -> "check your email" -> link verifies -> sign-in works. Unverified sign-in is refused.'],
  ['2. Auth & Onboarding', 'Onboarding 5 steps complete + validate', 'Step 2 must refuse to continue with empty name/age/height/weight. Imperial AND metric units both compute targets.'],
  ['2. Auth & Onboarding', 'Language choice sticks', 'Pick Espanol at step 1 -> whole app renders Spanish after onboarding, and persists across sign-out/in.'],
  ['2. Auth & Onboarding', 'Macro targets computed + shown', 'After onboarding, dashboard shows kcal + P/C/F targets matching the intake (sanity-check the math for one profile).'],
  ['2. Auth & Onboarding', 'NEW CLIENT APPEARS IN COACH PORTAL', 'While tester A finishes onboarding, tester B (coach) refreshes /coach/subscribers: the new member appears with correct name/goal. This is the onboarding->portal trigger.'],
  ['2. Auth & Onboarding', 'Timezone auto-captured', 'Sign in from a device set to a non-US zone (or change OS tz) -> profiles.timezone updates; diary "today" boundary follows local midnight.'],
  ['2. Auth & Onboarding', 'Disclaimer gate blocks training content', 'Fresh member: first visit to dashboard/workouts routes to the health disclaimer; accepting once never re-prompts.'],
  ['2. Auth & Onboarding', 'Forgot password round-trip', 'Request reset -> email arrives -> new password works; old one refused.'],
  ['2. Auth & Onboarding', 'Legacy claim flow', 'Open an invite link for a seeded legacy contact -> set password -> lands in app with journey snapshot + imported progress photos visible.'],
  // ---- 3. Paywall & Billing ----
  ['3. Paywall & Billing', 'Pre-Stripe: new members enter the app', 'While Stripe keys are NOT set: fresh signup -> onboarding -> dashboard loads (no /checkout dead-end).'],
  ['3. Paywall & Billing', 'Post-Stripe: paywall arms itself', 'THE DAY keys land: un-subscribed member is walled to /checkout on every training surface; checkout completes with test card 4242...; webhook flips them entitled without re-login.'],
  ['3. Paywall & Billing', 'Checkout writes consent rows', 'After starting checkout, consent_captures has BOTH billing consent + auto-renewal disclosure rows with IP/UA (compliance evidence).'],
  ['3. Paywall & Billing', 'Cancel + reactivate honest flow', '/account/billing: cancel = one confirm + optional reason; shows "ends on" date; reactivate restores. No dark patterns.'],
  ['3. Paywall & Billing', 'Auto-renew terms always visible', 'Billing page permanently shows next charge amount/date + cancel + refund policy (ROSCA).'],
  ['3. Paywall & Billing', 'Coach Billing shows in-app subscribers', 'After a test-mode subscription: the member appears in /coach/billing with price + renew date, and MRR includes them.'],
  ['3. Paywall & Billing', 'Comp access grant/revoke', 'Coach grants 30 days on a subscriber profile -> member enters without paying; revoke -> walled again (once Stripe live). Audit_log records both.'],
  ['3. Paywall & Billing', 'Checkout spam limited', '11 rapid checkout attempts in an hour -> rate-limit error message, not 11 Stripe sessions.'],
  // ---- 4. Photo / Text / Barcode Scan ----
  ['4. Scan (the moat)', 'Photo meal scan end-to-end', 'Snap a real multi-item plate -> items identified with grams + confidence -> log all -> diary rings update. Target: correct foods, portions within ~20%.'],
  ['4. Scan (the moat)', 'Portion EDIT before logging', 'Change one item\'s grams >5% then log: macros rescale live in the review card, and the logged entry uses the edited grams.'],
  ['4. Scan (the moat)', 'Correction reaches the learning loop', 'After the gram-edit log: ai_inferences row for that scan has correction.items with predicted vs corrected grams (ops can verify via SQL or Intelligence dashboard corrections count).'],
  ['4. Scan (the moat)', 'Confidence tiers behave', 'High-confidence item logs in one tap; low-confidence (<70%) item ARMS on first tap (asks to confirm portion) and logs on second.'],
  ['4. Scan (the moat)', 'Nutrition-label photo transcribes', 'Photograph a packaged product\'s Nutrition Facts -> exact printed values captured, serving converts correctly, logs as a product.'],
  ['4. Scan (the moat)', 'Barcode scan', 'Scan a real barcode -> product + per-100g macros from the packaged DB; quantity/unit picker computes grams (cup/oz/g).'],
  ['4. Scan (the moat)', 'Text describe ("2 eggs and toast")', 'Type a meal in EN and in ES -> items resolve with sane grams -> log works. Both languages.'],
  ['4. Scan (the moat)', 'Cooked vs raw handled', 'Log "grilled chicken breast 200g" via photo: macros reflect cooked-vs-raw conversion (compare kcal against a known table).'],
  ['4. Scan (the moat)', 'Scan speed acceptable', 'Warm scan (second scan in a session) completes in ~10s or less; first-of-day may be slower (cold start). Time 3 scans.'],
  ['4. Scan (the moat)', 'Scan failure recovers', 'Photograph a non-food object -> friendly "no food" state with retry; airplane-mode submit -> error state, never stuck loading.'],
  ['4. Scan (the moat)', 'Same label twice = same food row', 'Scan the same product label twice -> the second scan reuses the food (no duplicate rows accumulating - ops verify foods count unchanged).'],
  // ---- 5. Diary & Nutrition ----
  ['5. Diary & Nutrition', 'Manual search + log + delete', 'Search a food, pick a portion, log; delete it; rings/totals update both times.'],
  ['5. Diary & Nutrition', 'Day navigation + local midnight', 'Log at 11:55pm local -> lands on TODAY not tomorrow; prev/next day arrows show correct days.'],
  ['5. Diary & Nutrition', 'Favorites star + reuse', 'Star a food -> appears in favorites for one-tap re-log.'],
  ['5. Diary & Nutrition', 'Meal plan renders for member', 'Assign a structured plan to the test member (coach side) -> member sees slots/recipes/ingredients/steps correctly in their language.'],
  ['5. Diary & Nutrition', 'Food photo check-in gallery', 'Member photo logs appear in the coach\'s client profile photo grid with meal slot + date.'],
  // ---- 6. Workouts ----
  ['6. Workouts', 'Assigned program appears', 'Coach assigns a program -> member dashboard + /workouts show it same-day.'],
  ['6. Workouts', 'Player: timer, wake lock, logging', 'Run a session: rest timer beeps at zero, screen stays awake, per-set reps/weight log, completion saves to history.'],
  ['6. Workouts', 'Progressive overload hint', 'After 2+ logged sessions of an exercise, next session shows a sensible next-weight/reps hint with the coach-voice rationale.'],
  ['6. Workouts', 'History + e1RM trend', '/history shows past sessions; per-exercise view shows an e1RM trend that matches the logs.'],
  ['6. Workouts', 'Exercise names in Spanish', 'Switch to ES: exercise list shows Spanish names (machine-v1; note any nonsense ones for Stephanie\'s pass).'],
  ['6. Workouts', 'Demo videos play (once Mux lands)', 'BLOCKED until Mux env + manifest: then exercise detail plays the demo without buffering stalls.'],
  // ---- 7. Gamification ----
  ['7. Gamification', 'Streak increments once per active day', 'Log food today -> streak +1 (once, not per log). Tomorrow another activity -> +1 again.'],
  ['7. Gamification', 'Week strip paints local days', 'Dashboard week strip: the day you worked out is green in YOUR timezone (test evening workout).'],
  ['7. Gamification', 'Workout check = real workout', 'Dashboard "today\'s workout" check turns green ONLY after completing a workout today - not after just logging food.'],
  ['7. Gamification', 'Badges award + celebrate', 'Cross a badge threshold (e.g. first workout, 7-day streak) -> badge appears on /you with celebration; never awards twice.'],
  ['7. Gamification', 'Nightly recompute heals streaks', 'Ops: after the nightly job, user_streaks matches reality for all 3 sample accounts (spot-check SQL).'],
  // ---- 8. Community & Challenges ----
  ['8. Community & Challenges', 'Post + media + comment + react', 'Post text and a photo; comment from second account; reactions toggle and COUNTS SURVIVE a refresh (server truth).'],
  ['8. Community & Challenges', 'Broadcast pinned', 'Coach broadcast renders pinned/highlighted for members.'],
  ['8. Community & Challenges', 'Create challenge (real metrics only)', 'Coach creates a challenge: only Workouts / Days logged offered; dates validate (end after start); appears on community.'],
  ['8. Community & Challenges', 'Progress moves from REAL activity', 'Member joins, completes a workout -> leaderboard progress ticks within a minute (live hook). Diary-day challenges count days, not rows.'],
  ['8. Community & Challenges', 'Challenge finalize crowns a winner', 'When a challenge passes its end date (or ops triggers close-challenges): leader gets Champion badge + all participants notified, exactly once.'],
  // ---- 9. Coach Portal (Stephanie's view) ----
  ['9. Coach Portal', 'Clients CRM filters + segments', '/coach/clients: filter by status/tag, save a segment, reload -> segment persists and re-applies.'],
  ['9. Coach Portal', 'Subscriber profile tabs all load', 'Open a member: Overview/Info/Progress/Nutrition/Check-ins/Workouts tabs render with real data, no blank panes.'],
  ['9. Coach Portal', 'Assign habit from profile', 'Type a habit + Assign -> appears in the card AND on the member\'s Today screen; member toggles it; coach sees completion.'],
  ['9. Coach Portal', 'Meal-plan builder round-trip', 'Build a plan (slots/recipes/ingredients/steps), save, reload -> EVERYTHING persisted. Also: a recipe left untitled must NOT vanish (auto-names Recipe N).'],
  ['9. Coach Portal', 'Plan generator grounded in her method', 'Generate a plan for a PCOS profile -> structure matches Stephanie\'s method (5 slots, 3-5 ingredients, raw grams, free-veggie note) and respects the intake.'],
  ['9. Coach Portal', 'Knowledge base ingest + reflect', 'Add a distinctive method note in /coach knowledge -> ask coach chat about it as a member -> answer reflects it (retrieval live).'],
  ['9. Coach Portal', 'Interview answers train the system', 'Answer 2-3 interview questions -> knowledge entries created; chat reflects the new answers.'],
  ['9. Coach Portal', 'Form builder: check-in type + assign', 'Build a form marked "check-in", publish, assign to the test member from the forms index; empty field labels are blocked with a clear message.'],
  ['9. Coach Portal', 'Mid-ticket approval gate', 'Assistant drafts a plan -> CANNOT publish; Stephanie/operator approves -> publishes. Assistant can never approve their own work.'],
  ['9. Coach Portal', 'Nav honesty', 'Every coach nav item opens a real, data-bound screen. No dead ends, no coming-soon surprises.'],
  // ---- 10. Messaging & Inbox ----
  ['10. Messaging', 'Realtime both directions', 'Member sends from /messages; coach sees it in /coach/inbox WITHOUT refresh; reply lands back live.'],
  ['10. Messaging', 'Unread counts correct', 'Unread badge increments on new message, clears after reading.'],
  ['10. Messaging', 'Thread in Spanish', 'ES member sees the thread UI (empty state, placeholder, Send) in Spanish.'],
  // ---- 11. Check-ins ----
  ['11. Check-ins', 'Member submit with photos', 'Assigned check-in appears at /checkin; fill ratings/text/photos; submit succeeds; re-submit rules sane.'],
  ['11. Check-ins', 'Coach review surface', 'Submission appears in the client profile Check-ins tab with responses + photos.'],
  ['11. Check-ins', 'Check-in due nudge', 'Ops: notify-checkins cron (or manual trigger) creates the due notification for members with pending check-ins.'],
  // ---- 12. Agentic / Learning loop ----
  ['12. Learning Loop (agentic)', 'Coach chat: her voice, grounded, bilingual', 'Ask nutrition questions in EN + ES: answers stream, sound like Stephanie, cite her method, refuse medical-diagnosis territory.'],
  ['12. Learning Loop (agentic)', 'Chat remembers the member', 'Tell the chat a preference (e.g. hates oatmeal); ask related question days later -> reflects it (member memory).'],
  ['12. Learning Loop (agentic)', 'KB change flows to chat SAME DAY', 'Change a knowledge entry -> chat answer changes accordingly (no stale cache).'],
  ['12. Learning Loop (agentic)', 'Nightly insights carry scan quality', 'Ops: after nightly job, user_insights payload has scan_quality (scans/corrections/rate) for active members.'],
  ['12. Learning Loop (agentic)', 'Corrections change coaching context', 'For a member with 5+ scans and 30%+ correction rate: coach chat context includes their scan-accuracy line (ops verify via chat behavior or SQL).'],
  ['12. Learning Loop (agentic)', 'Intelligence dashboard populated', '/coach/intelligence: scans/day, accuracy, portion error, calibration + trends render with real data (not all zeros) once members scan.'],
  ['12. Learning Loop (agentic)', 'Eval harness runs + compares', 'Ops: pnpm eval:scan completes, prints per-case results + run-over-run comparison vs baseline (92%/F1 .92 band).'],
  ['12. Learning Loop (agentic)', 'Scan images persist for the gold set', 'Ops: after a photo scan, storage has ai-scans/<inference_id>.jpg (fuels future eval cases automatically).'],
  ['12. Learning Loop (agentic)', 'Food corpus grows itself', 'Scan an unusual food not in the DB -> USDA-grounds + caches; SECOND scan of the same food resolves locally (faster, no new row).'],
  // ---- 13. Notifications & Crons ----
  ['13. Notifications & Crons', 'Push opt-in + delivery', 'Enable push on a real phone -> trigger a notification (message or nudge) -> arrives on the lock screen.'],
  ['13. Notifications & Crons', 'Reminder hour respected', 'Set reminder to the next hour in account prefs -> the daily nudge arrives at that LOCAL hour.'],
  ['13. Notifications & Crons', 'All 5 pg_cron jobs firing', 'Ops SQL: cron_job_log shows fresh success rows for reminders(hourly)/renewals/checkins/insights/close-challenges within their schedule.'],
  ['13. Notifications & Crons', 'Renewal + comp-expiry nudges', 'Ops: member with renewal or comp expiring inside the window receives the reminder notification.'],
  // ---- 14. i18n EN/ES ----
  ['14. Bilingual (ES)', 'Full member journey in Spanish', 'Complete signup->onboarding->scan->log->workout->community entirely in ES. ZERO English strings or raw key paths (app.xxx.yyy).'],
  ['14. Bilingual (ES)', 'Coach console Spanish', 'Coach account in ES: challenges, inbox, billing, forms all translated (recent fixes - verify).'],
  ['14. Bilingual (ES)', 'Legal + emails in Spanish', 'Terms/privacy pages render ES; auth emails (confirm/reset) arrive in a usable form for ES users.'],
  ['14. Bilingual (ES)', 'Latin-American tone', 'Native speaker sanity pass: copy reads natural LATAM Spanish, tu-form, no Spain-isms, no machine-translation howlers on key screens.'],
  // ---- 15. Legal & Account ----
  ['15. Legal & Account', 'Consent evidence complete', 'Ops SQL: consent_captures has terms+privacy rows from signup, health-ack timestamp, billing+auto-renew rows from checkout, each with IP/UA + version.'],
  ['15. Legal & Account', 'Data export downloads', '/account export -> JSON contains the member\'s data; excludes security/audit internals.'],
  ['15. Legal & Account', 'Account deletion cascades', 'Delete a THROWAWAY account: two-step confirm -> sign-out -> re-login impossible -> ops verify rows gone (RLS test account still isolated).'],
  ['15. Legal & Account', 'Change email + password', 'Both flows round-trip (email change requires confirm on the new address).'],
  ['15. Legal & Account', 'Terms/Privacy real copy (BLOCKED)', 'BLOCKED on legal deliverable: placeholder must be replaced before public launch; verify pages render the final text EN+ES when it lands.'],
  // ---- 16. PWA & Performance ----
  ['16. PWA & Performance', 'Install prompts (iOS + Android)', 'iOS Safari shows the install banner flow; Android shows the install button; installed app opens standalone with correct icon + splash.'],
  ['16. PWA & Performance', 'Authed pages never cached stale', 'After sign-out, back button must NOT show cached personal data.'],
  ['16. PWA & Performance', 'Mobile layout integrity', 'iPhone SE width: no horizontal scroll, no clipped buttons on scan modal, workout player, coach tables.'],
  ['16. PWA & Performance', 'Cold start acceptable', 'First page-load of the day and first scan: note times. If painful, escalate the Vercel Pro decision.'],
  ['16. PWA & Performance', 'Offline behavior graceful', 'Airplane mode: app shell communicates offline state; no white-screen crashes; recovery on reconnect.'],
  // ---- 17. Security & Ops ----
  ['17. Security & Ops', 'RLS isolation green', 'Ops: node .qa-visual/rls-isolation-test.cjs -> ALL checks pass (member sees only own rows, 0 rows on privileged tables).'],
  ['17. Security & Ops', 'Member cannot open coach/admin', 'As subscriber: /coach and /admin redirect away. As coach: /admin redirects to /coach (operator-only).'],
  ['17. Security & Ops', 'Internal routes locked', 'curl any /api/internal/* without the bearer -> 401. With wrong bearer -> 401.'],
  ['17. Security & Ops', 'AI spend rate-limited', 'Hammer photo scan past 40/hr on one account -> friendly rate-limit message, not silent spend.'],
  ['17. Security & Ops', 'Sentry captures (once keyed)', 'BLOCKED on DSN: after keys land, force a test error -> appears in Sentry within a minute.'],
  ['17. Security & Ops', 'Stripe webhook replay safe', 'Ops (test mode): resend a webhook event from Stripe dashboard -> no duplicate subscription/payment rows (idempotency).'],
];

(async () => {
  const { data: company } = await sb.from('companies').select('id').eq('slug', 'thick-and-fit').single();
  if (!company) { console.error('no company'); process.exit(1); }
  const { count } = await sb.from('qa_checklist').select('id', { count: 'exact', head: true }).eq('company_id', company.id);
  if ((count ?? 0) > 0) { console.log(`already seeded (${count} items); delete rows to re-seed`); return; }
  const rows = ITEMS.map(([category, title, detail], i) => ({ company_id: company.id, category, title, detail, sort: i }));
  const { error } = await sb.from('qa_checklist').insert(rows);
  if (error) { console.error('seed failed:', error.message); process.exit(1); }
  console.log(`seeded ${rows.length} checklist items across ${new Set(ITEMS.map((x) => x[0])).size} categories`);
})();
