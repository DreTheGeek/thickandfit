# WP13: Mux Import + ES Exercise Names + 256-Client Invite/History - Research

**Researched:** 2026-06-28
**Domain:** Content migration (video transcode), bilingual data fill, legacy-user onboarding + history import
**Confidence:** HIGH on the codebase/data model (everything cited from real files + live SQL); MEDIUM on the external Mux/Resend/Supabase-invite mechanics (verified against current official docs, not yet exercised against the real accounts)

---

## Summary

WP13 is three loosely-coupled migrations that share one spine: the already-built `lenus` schema -> `public` CRM bridge (`.qa-visual/import-lenus.sql`, migration `0020`, `migration_log` table with 6 batch rows already recorded). The CRM half (contacts, subscriptions, snapshots, transactions, tags) is DONE. WP13 adds the **consumer-facing** half: turning a legacy `contacts` row into a logged-in subscriber, importing the slice of their history that actually exists, getting Stephanie's demo videos into Mux, and filling Spanish exercise names.

The single biggest reality check from the data: **the `lenus` schema holds aggregates, not granular history.** `lenus.client_profiles` has counts (`workouts_completed`, `measurements_logged`, `checkins`) but no per-date weight rows and no per-set workout logs. The only granular, importable per-client artifacts are the **2,151 progress photos** (232 of 256 clients) sitting at public R2 URLs, already mirrored into `public.contact_files` (coach side). So "import their Lenus history" means: progress photos -> subscriber gallery, plus a read-only "legacy snapshot" card. It does NOT mean reconstructing a weight chart or workout log that never came across.

The 873 `exercises` rows are the open **free-exercise-db** dataset (the 7 categories `strength/stretching/plyometrics/powerlifting/olympic weightlifting/strongman/cardio` and the `muscle_group`/`equipment` vocabulary are its signature). All 873 have `cues_en` (good ES-translation source) but `name_es` is NULL for all 873 and `video_mux_id` is NULL for 871. Stephanie's ~369 filmed demos are NOT in the `lenus` schema as a clean set; `lenus.media` is client chat/progress media, not an exercise library. The demos arrive as her own files and must be matched to `exercises` rows by name during upload.

**Primary recommendation:** Build three idempotent, service-client/edge migrations that extend the proven `import-lenus.sql` pattern (transactional, re-runnable, `migration_log`-stamped, legacy-firewall-gated). (1) A Mux import job that POSTs each source URL to `https://api.mux.com/video/v1/assets` and writes the returned **playback ID** to `exercises.video_mux_id` (the player already consumes a playback ID). (2) An ES-name fill (LLM-assisted batch via the existing OpenRouter client, human-reviewed) updating `name_es`/`cues_es`. (3) An invite/claim flow using `supabase.auth.admin.generateLink({ type: 'invite' })` to mint a link, sent through the existing Resend `fetch` path, that lands on a set-password screen; on first login a claim step links `auth.users.id` -> the legacy `contacts` row (`contacts.profile_id`, `profiles.lenus_profile_id`, `is_legacy_client`) and imports that client's photos.

---

## Standard Stack

### Core (all already in the repo, no new libraries needed)
| Library | Version | Purpose | Why standard here |
|---------|---------|---------|-------------------|
| `@mux/mux-player-react` | installed (`package.json` deps) | Plays `video_mux_id` (a **playback ID**) in `src/components/workout/workout-player.tsx:288` | Already the player; import just needs to produce playback IDs |
| `@supabase/supabase-js` | installed | `createServiceClient()` (`src/lib/supabase/service.ts`) exposes `auth.admin.*` (already used for `deleteUser` in `src/lib/account/actions.ts:23`) | `auth.admin.generateLink` / `inviteUserByEmail` live here |
| Resend (raw `fetch`) | n/a (no SDK) | Transactional email via `POST https://api.resend.com/emails` (`src/lib/email/resend.ts:16`) | Project convention is the lazy-fetch pattern, no SDK |
| OpenRouter client | installed (PRD-31/WP3) | Batch-translate `name_en`/`cues_en` -> ES | Already the AI router; reuse for the ES fill |
| Supabase Management API | n/a | Run the one-shot migration SQL as one transaction (`node .qa-visual/sql.cjs`) | How `import-lenus.sql` already ran |

### Supporting
| Tool | Purpose | When to use |
|------|---------|-------------|
| Supabase Storage `progress-photos` bucket (private, exists from `0032`) | Destination for imported legacy photos | Photo import step |
| `migration_log` table (exists) | One row per dataset/batch | Every migration step stamps it |
| Mux webhooks (`video.asset.ready`) | Async: assets are not playable instantly | Required - see Pitfall 1 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `generateLink({type:'invite'})` + Resend | `inviteUserByEmail()` (sends via Supabase SMTP) | `inviteUserByEmail` is simpler but emails through Supabase's configured SMTP (Resend is wired into Supabase Auth per MEMORY `email-resend-blocker`), giving less control over the bilingual template. `generateLink` returns the URL so we send our own branded EN/ES email through the existing Resend `fetch` path. **Recommend `generateLink` for template control.** |
| Mux create-from-URL | Direct upload (`/video/v1/uploads`) | Direct upload is for browser file pickers. Stephanie's demos, once staged at a URL (R2/Supabase Storage/Drive-with-public-link), are best done as create-from-URL batch. |
| LLM ES translation | Hand-translation | 873 names is too many to hand-translate; LLM draft + Stephanie/Shakira review is the realistic path. Fitness terms need a human pass (Pitfall 4). |

**No `npm install` needed** - every dependency is already present.

---

## Architecture Patterns

### Recommended structure (mirrors existing layout)
```
supabase/migrations/0039_legacy_claim.sql   # claim linkage: contacts.profile_id wiring, RLS, claim RPC
.qa-visual/import-lenus-photos.sql           # (or edge fn) progress_photos import, idempotent, run via Mgmt API
src/lib/legacy/
  claim.ts            # server action: link auth.uid() -> legacy contact, import photos, set is_legacy_client
  invite.ts           # admin: generateLink(invite) per legacy contact + Resend send + email_send_log
src/lib/content/
  mux-import.ts        # POST source URLs to Mux, persist playback_id -> exercises.video_mux_id, migration_log
  es-fill.ts           # OpenRouter batch translate name_en/cues_en -> name_es/cues_es, review queue
supabase/functions/mux-webhook/index.ts      # video.asset.ready -> flip exercise to playable (copy craneop edge shape)
src/app/(app)/claim/page.tsx                 # post-invite landing: set password -> claim -> /dashboard
```

### Pattern 1: Idempotent, transactional, firewall-gated migration
**What:** Every import runs as ONE transaction via the Management API, uses `where not exists`/`on conflict do nothing`, stamps `migration_log`, and ends with a gate that aborts the whole transaction on a data-integrity violation.
**When:** All three WP13 imports.
**Source:** `.qa-visual/import-lenus.sql:1-205` (the legacy firewall gate at `:197-205` is the template - re-use the same shape for "every imported photo has a profile_id" and "every demo URL resolved to a playback_id").

### Pattern 2: Mux create-asset-from-URL -> playback ID
**What:** POST the source video URL; Mux downloads + transcodes async; the **playback ID** (not the asset ID) is what the player needs.
**Source:** Mux API reference (verified 2026) + `workout-player.tsx:288` (`playbackId={ex.video_mux_id}`).
```ts
// src/lib/content/mux-import.ts (sketch)
// Auth is HTTP Basic: MUX_TOKEN_ID:MUX_TOKEN_SECRET
const res = await fetch('https://api.mux.com/video/v1/assets', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Basic ' + Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64'),
  },
  body: JSON.stringify({
    inputs: [{ url: sourceUrl }],   // remote URL Mux will fetch
    playback_policies: ['public'],  // matches accentColor player usage; private=signed if we gate later
    video_quality: 'basic',
  }),
});
const { data } = await res.json();
// data.id = ASSET id (store for webhook correlation); data.playback_ids[0].id = PLAYBACK id
// IMPORTANT: at create time status='preparing'. Do NOT write video_mux_id until video.asset.ready.
```
The playback ID may be present at create time, but the asset is NOT playable until `video.asset.ready`. Persist the asset->exercise mapping immediately; write `exercises.video_mux_id = playback_id` only on the ready webhook (Pitfall 1).

### Pattern 3: Invite -> claim -> link legacy contact
**What:** Admin mints an invite link; user sets a password; on first authenticated load, a claim step links the new `auth.users.id` to the pre-existing legacy `contacts` row instead of leaving the blank subscriber profile that `handle_new_user()` created.
**Source:** `supabase/migrations/0004_auth_rbac.sql:7-22` (the `handle_new_user` trigger that auto-creates a `subscriber` profile), `contacts` columns `profile_id`/`lenus_id`/`is_legacy` (live schema), `profiles` columns `is_legacy_client`/`legacy_source`/`lenus_profile_id` (live schema), `src/lib/account/actions.ts:22-23` (`createServiceClient().auth.admin` pattern).
```ts
// src/lib/legacy/invite.ts (admin, service client) - sketch
const svc = createServiceClient();
const { data, error } = await svc.auth.admin.generateLink({
  type: 'invite',
  email: contact.email,
  options: { redirectTo: `${origin}/auth/callback?next=/claim` },
});
// data.properties.action_link = the URL to email. Send via existing Resend fetch path,
// bilingual by contact.language ('en'|'es'), then insert email_send_log row.
```
```sql
-- 0039 claim RPC (security definer): called once after first login, links the rows.
create or replace function public.claim_legacy_contact()
returns void language plpgsql security definer set search_path = public as $$
declare v_email text; v_contact public.contacts;
begin
  select email into v_email from auth.users where id = auth.uid();
  select * into v_contact from public.contacts
    where company_id = public.current_company_id()
      and type = 'client' and is_legacy = true
      and lower(email) = lower(v_email) and profile_id is null
    limit 1;
  if v_contact.id is null then return; end if;            -- nothing to claim, no-op
  update public.contacts set profile_id = auth.uid(), updated_at = now() where id = v_contact.id;
  update public.profiles
    set is_legacy_client = true, legacy_source = 'lenus', lenus_profile_id = v_contact.lenus_id
    where id = auth.uid();
end $$;
```

### Anti-Patterns to Avoid
- **Writing `video_mux_id` at asset-create time.** The asset is `preparing`; the player will 404. Gate on `video.asset.ready`.
- **Letting `handle_new_user` create a fresh blank profile and ignoring it.** It WILL fire (the trigger is unconditional). The claim step must reconcile, not duplicate. Match by email; the legacy firewall already guarantees every legacy contact has `is_legacy=true` and an email.
- **Importing photos by trusting `lenus.media` dates.** There is no date column; `taken_on` would be fabricated. Import with `taken_on = created_at::date` of the lenus row (or NULL-default to today) and label them clearly as legacy. Do not present a fake timeline.
- **Bulk Mux POST with no rate pacing / no idempotency key.** Re-running would create duplicate assets and burn transcode minutes. Key each import on the exercise id; skip if `video_mux_id` already set.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Video transcode/HLS/thumbnails | Custom ffmpeg pipeline | Mux create-from-URL | Mux is already the player; transcode + adaptive streaming + posters are its job |
| Invite token + email link | Custom signed-token table | `auth.admin.generateLink({type:'invite'})` | Supabase mints a single-use, expiring, audited link tied to `auth.users` |
| Password set on claim | Custom set-password endpoint | Supabase recovery/invite session -> `auth.updateUser({password})` (mirror `updatePasswordAction`, `src/lib/auth/actions.ts:117-142`) | Reuses the audited, rate-limited path that already exists |
| Idempotent import bookkeeping | New status table | `migration_log` (exists) + `where not exists` | The proven pattern from `import-lenus.sql` |
| Photo serving | Public URLs in DB | Copy bytes into the private `progress-photos` bucket, serve via signed URL | `0032` already established private bucket + signed-URL reads + owner/coach RLS |

**Key insight:** WP13 has almost no net-new infrastructure. The CRM import, the private photo bucket, the Mux player, the service-client admin path, the Resend send path, and the `migration_log` table all exist. WP13 is wiring + content, not platform.

---

## Common Pitfalls

### Pitfall 1: Mux assets are async; the playback ID is not instantly playable
**What goes wrong:** You POST 369 URLs, get playback IDs, write them all to `exercises.video_mux_id`, and every demo shows a spinner/404 for minutes-to-hours.
**Why:** Mux returns `status: "preparing"`. The asset becomes playable only on `video.asset.ready` (or `errored`).
**Avoid:** Store asset->exercise mapping at create time (a staging column or `migration_log.error`/a temp table). Add a `mux-webhook` edge function (copy the craneop edge-function shape: dual client, sanitized errors, signature verify) that, on `video.asset.ready`, writes `video_mux_id`. Verify the `Mux-Signature` header.
**Warning sign:** Demos play in dev (you waited) but break in a batch import (you didn't).

### Pitfall 2: Stephanie's 369 demos are not in the database
**What goes wrong:** A plan assumes `lenus.media` or some table holds the exercise demo videos and writes SQL to read them. It doesn't - `lenus.media` is client chat_attachments/progress_photos/billing_docs (verified counts: 2151 progress, 656 chat, 610 billing, 13 media_library). The 6 videos in `media_library` are not an exercise library.
**Why:** Her demos live in her own storage (Lenus exercise library export / Drive / R2), to be staged at URLs and matched to `exercises.name_en` by hand or fuzzy match.
**Avoid:** Treat the demo source as an **external input** (a manifest of `{exercise_name, source_url}`). The import job's first job is name-matching to the 873 `exercises` rows; unmatched demos become new `exercises` rows with `is_own_demo=true`, `company_id=<thick-and-fit>`.

### Pitfall 3: Granular history does not exist - don't promise a chart
**What goes wrong:** A plan tries to populate `weight_entries` and `workout_logs` from Lenus and finds only aggregate counts (`client_profiles.measurements_logged`, `.workouts_completed`).
**Why:** The export captured snapshots, not event streams. `weight_entries`/`workout_logs`/`food_log` have no Lenus source rows.
**Avoid:** Scope "history import" to (a) the 2,151 progress photos -> `progress_photos`, and (b) a read-only "Your journey so far" card sourced from `legacy_client_snapshot` (already populated: meal_plans/measurements/checkins/workouts counts + weight_goal + goal_intensity). Be explicit in the plan that weight/workout granular history is **not available** and going-forward tracking starts fresh.

### Pitfall 4: Machine ES translation of fitness terms is unreliable
**What goes wrong:** "Good Morning (Pull Through)", "Air Bike", "Cable Crossover" translate literally and wrong; "deadlift"/"clean and jerk" have established Spanish gym vernacular that varies by region (LATAM vs Spain).
**Why:** Exercise names are idiom, not prose. Stephanie's audience is LATAM Spanish.
**Avoid:** LLM draft into a review column, then Stephanie/Shakira approve. `muscle_groups`/`equipment` already ship curated ES labels (`0007_exercises.sql:11-33`) - reuse that vocabulary as a glossary/few-shot prompt. Update `name_es` AND extend the search route to query `name_es` when `content_locale='es'` (`src/app/api/exercises/route.ts:31` only `ilike` on `name_en` today).

### Pitfall 5: Claim must not collide with the auto-create trigger or leak across tenants
**What goes wrong:** `handle_new_user()` always inserts a blank `subscriber` profile; a naive import also inserts -> duplicate. Or the claim matches a contact by email without the tenant/legacy guard -> cross-tenant linkage.
**Avoid:** Claim by email **within** `current_company_id()` + `is_legacy=true` + `profile_id is null` (see RPC sketch). The legacy firewall gate (`import-lenus.sql:197-205`) guarantees every legacy contact is flagged, so the match set is well-defined. The claim is a no-op if no legacy contact matches (a genuinely new signup just keeps the blank subscriber profile).

---

## Concrete lenus -> our-table mapping (WP13 scope)

| Source (lenus / R2) | Target (public) | Key/join | Status |
|---|---|---|---|
| `lenus.clients` (256) | `contacts` (type=client, is_legacy) | `contacts.lenus_id = clients.id` | DONE (`import-lenus.sql`) |
| `lenus.client_profiles` aggregates | `legacy_client_snapshot` | `contact_id` via `lenus_id=profile_id` | DONE - **surface as read-only card** |
| `lenus.media` progress_photos (2151, 232 clients) | `contact_files` (coach side) | `contact_id` via `media.client_id=clients.id` | DONE for coach; **WP13 = also -> `progress_photos` (subscriber side)** |
| `lenus.media` progress_photos R2 bytes | Supabase Storage `progress-photos/<profile_id>/...` + `progress_photos` row | needs claimed `profile_id` (so runs AFTER claim, per user) | **WP13 build** |
| Stephanie's demo videos (external manifest) | Mux asset -> `exercises.video_mux_id` (playback id) | name-match to `exercises.name_en` | **WP13 build** |
| `exercises.name_en`/`cues_en` (873) | `exercises.name_es`/`cues_es` | same row | **WP13 build (LLM + review)** |
| `auth.users.id` (new) | `contacts.profile_id` + `profiles.{is_legacy_client,legacy_source,lenus_profile_id}` | email match within tenant | **WP13 build (claim RPC)** |
| NOT AVAILABLE | `weight_entries`, `workout_logs`, `food_log` | - | **No source - going-forward only** |

### Invite flow steps (concrete)
1. Operator triggers batch invite (or per-client) over `contacts where type='client' and is_legacy and profile_id is null and email is not null` (906 legacy contacts, 256 are clients, all have email).
2. For each: `svc.auth.admin.generateLink({ type:'invite', email, options:{ redirectTo:`${origin}/auth/callback?next=/claim` }})`.
3. Send `data.properties.action_link` via the existing Resend `POST /emails` path, choosing EN/ES by `contacts.language` (already set: Spanish-tagged -> 'es' in `import-lenus.sql:177-183`). Insert an `email_send_log` row (`to_email`, `template='legacy_invite'`, `provider_message_id`).
4. User clicks -> `/auth/callback` exchanges the code (existing `src/app/auth/callback/route.ts`) -> `next=/claim`.
5. `/claim` page: set password (reuse `updatePasswordAction` shape), then call `claim_legacy_contact()` RPC, then kick off this user's photo import (their `lenus.media` rows by `client_id`), then redirect to `/dashboard`.
6. Idempotent throughout: re-invite skips claimed contacts; re-claim is a no-op; photo import keys on `progress_photos.storage_path` unique index (`0032:26-27`).

---

## Code Examples

### Resend send (existing pattern to copy)
```ts
// src/lib/email/resend.ts:16 - reuse this exact fetch shape for the invite email
const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from, to, subject, html /* bilingual */ }),
});
```

### Photo import (per claimed user, sketch)
```ts
// Download R2 bytes -> upload to private bucket under the owner's folder -> insert row.
// Runs with service client AFTER claim so profile_id exists.
const path = `${profileId}/legacy-${mediaRowHash}.jpg`;
const bytes = await (await fetch(media.r2_url)).arrayBuffer(); // R2 url is public (pub-*.r2.dev)
await svc.storage.from('progress-photos').upload(path, new Uint8Array(bytes), {
  contentType: 'image/jpeg', upsert: true,
});
await svc.from('progress_photos').insert({
  company_id, profile_id: profileId, storage_path: path, taken_on: null /* unknown - default today, label legacy */,
}); // unique index on storage_path makes re-runs safe
```

---

## State of the Art

| Old approach | Current approach | Impact |
|---|---|---|
| Mux `playback_policy` (singular) | `playback_policies` (array) in create body | Use the plural array form (verified current Mux API) |
| `inviteUserByEmail` only | `generateLink({type:'invite'})` returns the URL | Lets us own the bilingual email via Resend instead of Supabase's SMTP template |
| Public R2 photo URLs in DB | Private Supabase bucket + signed URLs (`0032`) | Photos must be copied into the bucket, not linked by URL |

**Deprecated/outdated:** none material for this WP.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | NONE installed (no `vitest`/`jest`/`playwright` in `devDependencies`; only `lint` + `build` scripts in `package.json`) |
| Config file | none - **Wave 0 gap** |
| Quick run command | `pnpm lint` (only automated gate today) + the blocking hooks (`typecheck`, `lint`, `check-rls-enabled`, `check-tenant-column`, `check-money-type`) |
| Full suite command | `pnpm build` (typecheck) + `node .qa-visual/rls-isolation-test.cjs` (RLS, per MEMORY) |

### Phase Requirements -> Test Map
| Behavior | Test type | Automated command | File exists? |
|----------|-----------|-------------------|--------------|
| ES fill: every exercise has `name_es` | SQL assertion | `node .qa-visual/sql.cjs "select count(*) from exercises where name_es is null"` -> 0 | partial (sql.cjs exists) |
| ES search works | SQL/manual | exercises route returns ES matches when `content_locale='es'` | manual + route test (Wave 0) |
| Mux import: every imported demo has a real playback id | SQL assertion | `... where is_own_demo and video_mux_id is null` -> 0 after webhooks | manual (Mux account needed) |
| Mux asset actually plays | manual-only | open `/workout/[planId]`, demo renders in `MuxPlayer` | manual (real Mux) |
| Claim: claimed contact links profile | SQL assertion | `... contacts where profile_id is not null and is_legacy` increments | seed-testable |
| RLS isolation after new `0039` table/policies | RLS test | `node .qa-visual/rls-isolation-test.cjs` (MEMORY: run after any new table) | exists |
| Invite email send | integration | manual against real Resend domain | needs real Resend |

### Sampling rate
- Per task commit: `pnpm lint` + blocking hooks; the relevant `sql.cjs` count assertion.
- Per wave merge: `pnpm build` (typecheck) + `node .qa-visual/rls-isolation-test.cjs`.
- Phase gate: all `sql.cjs` invariants = 0 (no null `name_es`, no null `video_mux_id` on own-demos, no unlinked claimed contacts), RLS test green.

### Wave 0 gaps
- [ ] No test runner. Either install `vitest` for the pure functions (name-matcher, ES-prompt builder, Mux body builder) or accept SQL-assertion + manual verification as the gate (consistent with how `import-lenus.sql` was validated). **Recommend lightweight `vitest` for the name-matcher only**, since fuzzy-matching 369 demos to 873 names is the one piece with real logic risk.
- [ ] `node .qa-visual/rls-isolation-test.cjs` must be re-run after `0039` adds the claim RPC / any policy change.
- [ ] No automated browser test harness; Mux playback + invite email are manual-only (need real accounts).

---

## What is verifiable NOW (seed/test data) vs needs real external data/keys

**Verifiable now (seed + Management API, no external accounts):**
- ES fill: read `name_en`/`cues_en` (all 873 present), generate `name_es`/`cues_es` via the existing OpenRouter client, update rows, assert 0 nulls. Extend the exercises route to search `name_es`. Fully testable with the three sample accounts.
- Claim linkage logic: with the 906 legacy `contacts` (all `is_legacy`, all email, `profile_id` null) and the sample accounts, exercise the `claim_legacy_contact()` RPC end to end (sign in as a test contact's email, claim, verify `contacts.profile_id` + `profiles.is_legacy_client`).
- Legacy snapshot card: `legacy_client_snapshot` is already populated (256 rows) - render the read-only "journey so far" card with real numbers.
- Photo import mechanics: the R2 URLs are **public** (`pub-502784a5700c4c3686876a1e55c14f7b.r2.dev`), so the download->bucket->`progress_photos` insert can be tested for real per-client right now (232 clients, 2151 photos). Only the per-user trigger (post-claim) needs a claimed test profile.
- Mux request/response shape: build and unit-test the request body + webhook handler with a mocked Mux response.

**Needs real external data / keys / accounts:**
- **Mux account** (`MUX_TOKEN_ID`/`MUX_TOKEN_SECRET`, webhook signing secret) + **the actual 369 demo video files** staged at URLs. Without these, no real playback IDs exist; `video_mux_id` stays null. The demo manifest (`name -> url`) is an external deliverable from Stephanie.
- **Resend sending domain verified** for `teamthickandfit.com` (MEMORY says Resend is wired into Supabase Auth; confirm transactional sends from our own `fetch` path land + DKIM/SPF/DMARC). Invite emails to real client inboxes are a production action.
- **Supabase Auth redirect URLs** must include `${origin}/auth/callback` and the invite/recovery email templates configured (or bypassed via `generateLink` + our own email).
- **Stephanie/Shakira review** of the ES names before they go live (human gate, not code).
- Real client emails for the actual 256-client invite batch (the data exists in `contacts`, but sending is a launch action gated on Resend domain + Stephanie's go-ahead, consistent with the launch gating in MEMORY `call-2026-06-25-decisions`).

---

## Open Questions

1. **Where do Stephanie's 369 demo videos physically live, and is there a name<->file manifest?**
   - Know: not in `lenus.media` (verified); the player wants a playback ID.
   - Unclear: source location + whether filenames map cleanly to `exercises.name_en`.
   - Recommendation: treat as an external input; build the import to consume a `{name, url}` manifest and report unmatched names for manual reconciliation.

2. **"369 videos" vs 873 exercises vs 871 missing video_mux_id - which exercises get her demos?**
   - Know: 873 free-exercise-db rows, 871 lack video.
   - Unclear: she likely filmed her ~369 most-used; the rest stay video-less or use the dumbbell placeholder (player already handles null `video_mux_id`, `workout-player.tsx:294-298`).
   - Recommendation: match her 369 to existing rows by name; mark `is_own_demo=true`; leave the long tail without video (player degrades gracefully).

3. **Photo dates - acceptable to default `taken_on` since Lenus carries no date?**
   - Know: `lenus.media` has no timestamp column.
   - Recommendation: import with `taken_on` NULL/today and a clear "imported from Lenus" label; do not fabricate a timeline.

4. **Invite scope - all 906 legacy contacts or only the 256 clients (or only the 80 active)?**
   - Recommendation: invite `type='client'` contacts first (256); leads (`type='lead'`, 650) are a marketing motion, not an app claim. Confirm with Stephanie.

5. **Public vs signed Mux playback policy** - `public` is simplest and matches the current player; if demos must be gated to subscribers, switch to `signed` + token minting later. Recommend `public` for v1 (low risk, her demos are her marketing).

---

## Sources

### Primary (HIGH)
- Live DB via `node .qa-visual/sql.cjs`: `lenus.*` schema (9 tables), `exercises` (873 rows, 873 null `name_es`, 871 null `video_mux_id`, 0 null `cues_en`), `contacts` (906 legacy/906 email/0 claimed), `lenus.clients` (256), `lenus.media` (3893 rows; 2151 progress_photos across 232 clients; public R2 URLs), `migration_log` (6 batch rows), `legacy_client_snapshot` (256), `contact_files` (2151 progress photos).
- `.qa-visual/import-lenus.sql` (the proven idempotent/firewall-gated CRM import)
- `src/components/workout/workout-player.tsx:25,288` (Mux player consumes playback id)
- `src/lib/supabase/service.ts`, `src/lib/account/actions.ts:22-23` (service client `auth.admin`)
- `src/lib/email/resend.ts:16` (Resend fetch pattern)
- `src/lib/auth/actions.ts:117-142` (password update/claim shape), `src/app/auth/callback/route.ts` (callback)
- `supabase/migrations/0004_auth_rbac.sql:7-22` (handle_new_user), `0007_exercises.sql:11-45` (exercise + ES vocab), `0032_progress_photos.sql` (private bucket + RLS), `0020_contacts_client_lenus_unique.sql`
- `src/app/api/exercises/route.ts:31` (search EN-only today)
- `.planning/config.json` (`nyquist_validation: true`)

### Secondary (MEDIUM - current official docs, not yet exercised against real accounts)
- Mux API reference, create asset from URL: `POST https://api.mux.com/video/v1/assets`, `inputs:[{url}]`, `playback_policies:['public']`, returns asset id + `playback_ids[].id`; `video.asset.ready` webhook (https://www.mux.com/docs/api-reference/video/assets/create-asset)
- Supabase `auth.admin.generateLink({type:'invite'})` / `inviteUserByEmail` + custom SMTP/redirect (https://supabase.com/docs/reference/javascript/auth-admin-generatelink , https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)
- Resend `POST https://api.resend.com/emails`
- `C:/Users/dre/craneop-ref/supabase/functions/migrate-active-subscriptions/index.ts` (edge migration shape: dual client, sanitized errors, idempotent, audit row, smoke steps) - copy for `mux-webhook`.

### Tertiary (LOW - inference)
- `exercises` = free-exercise-db dataset (inferred from the 7 categories + muscle/equipment vocab; not from a source comment). Confidence MEDIUM-LOW but does not affect the WP13 plan.

## Metadata
**Confidence:** Stack HIGH (all in-repo), Data model HIGH (live SQL), Mux/Resend/invite mechanics MEDIUM (current docs, unexercised), History-availability HIGH (verified the granular rows do not exist).
**Research date:** 2026-06-28
**Valid until:** ~2026-07-28 (Mux/Supabase APIs stable; the data facts are fixed until a new Lenus export lands).
