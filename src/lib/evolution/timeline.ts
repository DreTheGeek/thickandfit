// Evolution timeline, data layer. Assembles a member's transformation story from rows she actually
// created (positioning brief: the highest-retention surface in the product).
//
// HONESTY RULE (non-negotiable): every entry here is derived from a real row. Nothing fires on a
// schedule, no number is invented, no milestone is granted for showing up. If a query fails we log
// and return whatever we could honestly assemble; we never fabricate to fill the gap. If she has no
// anchor row at all, `startedOn` comes back null and the whole surface stays hidden.
//
// ---------------------------------------------------------------------------------------------
// LOCALIZATION CONTRACT (read this before rendering anything)
// ---------------------------------------------------------------------------------------------
// `title` is ALWAYS a next-intl translation KEY, never an English sentence. The UI resolves it with
// its own translator so EN and ES both read naturally. Numbers never appear inside the key: they
// travel separately in `delta` (signed, already in HER display units), `unit` ('lb' | 'in') and
// `detail` (a raw stringified value, e.g. '182.4' or '100'), so the UI can format them for her
// locale (decimal comma in ES, decimal point in EN) and pluralize correctly.
//
// Keys emitted by this module:
//   evolution.startedTitle          no values
//   evolution.photoTitle            photoUrl set
//   evolution.weightFirstTitle      detail = starting weight, unit
//   evolution.weightMilestoneTitle  delta = cumulative change, unit
//   evolution.waistFirstTitle       detail = starting waist, unit
//   evolution.waistMilestoneTitle   delta = cumulative change, unit
//   evolution.consistencyTitle      detail = threshold crossed (e.g. '250')
//
// ---------------------------------------------------------------------------------------------
// UNITS
// ---------------------------------------------------------------------------------------------
// `profiles` carries no unit-preference column today (checked: comp_access_until, company_id,
// content_locale, created_at, email, full_name, health_ack_at, id, is_legacy_client, legacy_source,
// lenus_profile_id, reminder_hour, role, timezone, ui_locale, updated_at). Storage is metric
// (weight_kg, waist_cm); display is imperial, matching the rest of the member-facing surfaces.
// When a preference column lands, swap the two constants below and the thresholds follow.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { getProfileTimezone } from '@/lib/datetime/profile-timezone';
import { localDay } from '@/lib/datetime/local-day';
import type {
  EvolutionBookends,
  EvolutionEntry,
  EvolutionKind,
  EvolutionSummary,
} from '@/lib/evolution/types';

const PHOTO_BUCKET = 'progress-photos';
const SIGNED_TTL_SECONDS = 3600;

/** Display units. See the UNITS note above. */
const WEIGHT_UNIT = 'lb' as const;
const LENGTH_UNIT = 'in' as const;

const KG_TO_LB = 2.2046226218;
const CM_TO_IN = 0.3937007874;

/** A weight milestone is a new whole 5 lb (2 kg) line crossed, up or down. */
const WEIGHT_STEP: number = WEIGHT_UNIT === 'lb' ? 5 : 2;
/** A waist milestone is a new whole 2 in (5 cm) line crossed, up or down. */
const LENGTH_STEP: number = LENGTH_UNIT === 'in' ? 2 : 5;

/** Logging milestones. Real crossings only: the DATE comes from the Nth food_log row. */
const CONSISTENCY_THRESHOLDS = [50, 100, 250, 500, 1000] as const;
const MAX_CONSISTENCY = CONSISTENCY_THRESHOLDS[CONSISTENCY_THRESHOLDS.length - 1];

/** Hard caps: a five-year member must not render a thousand rows or mint a thousand signed URLs. */
const MAX_ENTRIES = 40;
const MAX_PHOTO_ROWS = 3000;
const MAX_BODY_ROWS = 2000;

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------------------------
// Row shapes. PostgREST serializes `numeric` as a STRING, so every numeric arrives as string|number
// and must go through Number(). Typing that honestly here keeps the coercion from being forgotten.
// ---------------------------------------------------------------------------------------------
type Numericish = number | string | null;

type WeightRow = { recorded_on: string; weight_kg: Numericish };
type MeasurementRow = { recorded_on: string; waist_cm: Numericish };
type PhotoRow = { id: string; storage_path: string; taken_on: string; created_at: string };
type FoodRow = { log_date: string };

/** Ordering within a single calendar day, so the story reads top-down in a sensible sequence. */
const KIND_RANK: Record<EvolutionKind, number> = {
  started: 0,
  weight: 1,
  measurement: 2,
  streak: 3,
  consistency: 4,
  photo: 5,
};

// ---------------------------------------------------------------------------------------------
// Pure date helpers. Every value we bucket on is already a calendar DATE column (recorded_on,
// taken_on, log_date), so there is no instant to convert. The two timestamp fallbacks
// (onboarding_responses.completed_at, profiles.created_at) go through localDay(tz) instead of
// toISOString(), because a 9pm-Pacific signup is not tomorrow.
// ---------------------------------------------------------------------------------------------

/** Parse a yyyy-mm-dd calendar date at UTC noon, which is DST-proof for whole-day arithmetic. */
function parseIsoDate(iso: string): number {
  const [y, m, d] = iso.split('-').map((part) => Number(part));
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12);
}

/** Whole days from `from` to `to`, both yyyy-mm-dd. Negative when `to` precedes `from`. */
function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDate(to) - parseIsoDate(from)) / DAY_MS);
}

/** 1-based week index: the week she started is week 1. Clamped so stray earlier dates stay at 1. */
function weekIndex(startedOn: string, on: string): number {
  return Math.max(1, Math.floor(daysBetween(startedOn, on) / 7) + 1);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Number() coercion that refuses NaN, empty strings, nulls and non-finite junk. */
function toNumber(value: Numericish): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toDisplayWeight(kg: number): number {
  return WEIGHT_UNIT === 'lb' ? kg * KG_TO_LB : kg;
}

function toDisplayLength(cm: number): number {
  return LENGTH_UNIT === 'in' ? cm * CM_TO_IN : cm;
}

/** The earliest of a set of maybe-dates. */
function earliest(candidates: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const candidate of candidates) {
    if (!isIsoDate(candidate)) continue;
    if (best === null || candidate < best) best = candidate;
  }
  return best;
}

/** An empty-but-valid summary: "she has no anchor yet", which hides the surface entirely. */
function emptySummary(): EvolutionSummary {
  return {
    startedOn: null,
    weeksIn: null,
    weightDelta: null,
    weightUnit: null,
    waistDelta: null,
    lengthUnit: null,
    photoCount: 0,
    mealsLogged: 0,
    bookends: { first: null, latest: null, weeksBetween: null },
    entries: [],
  };
}

// ---------------------------------------------------------------------------------------------
// Milestone derivation. Both series use the same rule: the FIRST reading is a milestone (it is the
// baseline the whole story is measured against), and after that only a cumulative delta that lands
// on a whole step line she has never reached before. The step is signed, so gaining is treated the
// same as losing, and a Set of already-emitted lines means bouncing across the same threshold does
// not spam the timeline. This is what keeps weight off the timeline once per weigh-in.
// ---------------------------------------------------------------------------------------------
type Reading = { on: string; value: number };

type Milestone = { on: string; step: number | null; delta: number; value: number };

function deriveMilestones(readings: Reading[], step: number): Milestone[] {
  if (readings.length === 0) return [];
  const baseline = readings[0];
  const out: Milestone[] = [{ on: baseline.on, step: null, delta: 0, value: baseline.value }];
  const seen = new Set<number>();
  for (let i = 1; i < readings.length; i += 1) {
    const delta = readings[i].value - baseline.value;
    // Math.trunc keeps the sign: -7.3 lb is line -1 (she crossed -5), +6.1 lb is line +1.
    const line = Math.trunc(delta / step);
    if (line === 0 || seen.has(line)) continue;
    seen.add(line);
    out.push({ on: readings[i].on, step: line, delta: round1(delta), value: readings[i].value });
  }
  return out;
}

/** The photo id embedded in an entry id of the form `photo:${on}:${photoId}`. */
function photoIdFromEntryId(entryId: string): string {
  return entryId.split(':').slice(2).join(':');
}

// ---------------------------------------------------------------------------------------------
// getEvolution: one round of queries, everything else derived in memory. No N+1, no per-row fetch,
// no per-row signing.
// ---------------------------------------------------------------------------------------------

/**
 * Build the Evolution summary for one member.
 *
 * @param profileId the member. Every query is scoped to her, no exceptions.
 * @param companyId tenant scope, applied to every table that carries company_id. Null skips it.
 */
export async function getEvolution(
  profileId: string,
  companyId: string | null,
): Promise<EvolutionSummary> {
  const sb = createServiceClient();

  // Her history may be keyed to EITHER id. Rows she created in the app carry profile_id; everything
  // migrated from Lenus carries contact_id and a NULL profile_id (in prod that is 2,286 of 2,289
  // progress photos and 758 of 769 weigh-ins). Querying profile_id alone would show a migrated
  // client an empty timeline on top of years of her own history, which is the exact opposite of
  // what this surface is for. So resolve her linked contact and match on either key.
  // ALL of her contacts, not just one: a member can end up with more than a single CRM row (a
  // legacy Lenus contact plus one created by the app signup bridge, for example), and picking one
  // arbitrarily would silently hide whichever history hung off the other.
  let contactIds: string[] = [];
  {
    let contactQuery = sb.from('contacts').select('id').eq('profile_id', profileId).limit(20);
    if (companyId) contactQuery = contactQuery.eq('company_id', companyId);
    const { data, error } = await contactQuery;
    if (error) console.error('getEvolution contact lookup:', error.message);
    contactIds = ((data ?? []) as { id: string }[]).map((r) => r.id);
  }
  // Applied to every history query below. With a linked contact it matches EITHER owner column,
  // otherwise it is a plain profile match.
  const ownerFilter =
    contactIds.length > 0
      ? `profile_id.eq.${profileId},contact_id.in.(${contactIds.join(',')})`
      : null;

  // Tenant scope is applied with a plain `if` rather than a generic wrapper: the PostgREST builder
  // types are deep enough that a generic passthrough trips TS2589.
  let weightQuery = sb
    .from('weight_entries')
    .select('recorded_on, weight_kg')
    .order('recorded_on', { ascending: true })
    .limit(MAX_BODY_ROWS);
  if (companyId) weightQuery = weightQuery.eq('company_id', companyId);
  weightQuery = ownerFilter ? weightQuery.or(ownerFilter) : weightQuery.eq('profile_id', profileId);

  let bodyQuery = sb
    .from('body_measurements')
    .select('recorded_on, waist_cm')
    .order('recorded_on', { ascending: true })
    .limit(MAX_BODY_ROWS);
  if (companyId) bodyQuery = bodyQuery.eq('company_id', companyId);
  bodyQuery = ownerFilter ? bodyQuery.or(ownerFilter) : bodyQuery.eq('profile_id', profileId);

  let photoQuery = sb
    .from('progress_photos')
    .select('id, storage_path, taken_on, created_at')
    .order('taken_on', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(MAX_PHOTO_ROWS);
  if (companyId) photoQuery = photoQuery.eq('company_id', companyId);
  photoQuery = ownerFilter ? photoQuery.or(ownerFilter) : photoQuery.eq('profile_id', profileId);

  // Only the first MAX_CONSISTENCY dates are needed: no threshold sits above that, and the exact
  // total comes from the head-count below rather than from these rows.
  let foodQuery = sb
    .from('food_log')
    .select('log_date')
    .order('log_date', { ascending: true })
    .limit(MAX_CONSISTENCY);
  if (companyId) foodQuery = foodQuery.eq('company_id', companyId);
  foodQuery = ownerFilter ? foodQuery.or(ownerFilter) : foodQuery.eq('profile_id', profileId);

  let photoCountQuery = sb
    .from('progress_photos')
    .select('id', { count: 'exact', head: true });
  if (companyId) photoCountQuery = photoCountQuery.eq('company_id', companyId);
  photoCountQuery = ownerFilter ? photoCountQuery.or(ownerFilter) : photoCountQuery.eq('profile_id', profileId);

  let mealCountQuery = sb
    .from('food_log')
    .select('id', { count: 'exact', head: true });
  if (companyId) mealCountQuery = mealCountQuery.eq('company_id', companyId);
  mealCountQuery = ownerFilter ? mealCountQuery.or(ownerFilter) : mealCountQuery.eq('profile_id', profileId);

  const [timezone, weightRes, bodyRes, photoRes, foodRes, photoCountRes, mealCountRes] =
    await Promise.all([
      getProfileTimezone(profileId).catch((): string | null => null),
      weightQuery,
      bodyQuery,
      photoQuery,
      foodQuery,
      photoCountQuery,
      mealCountQuery,
    ]);

  // Degrade, never throw: a dead table costs us its entries, not the whole story.
  if (weightRes.error) console.error('getEvolution weight_entries:', weightRes.error.message);
  if (bodyRes.error) console.error('getEvolution body_measurements:', bodyRes.error.message);
  if (photoRes.error) console.error('getEvolution progress_photos:', photoRes.error.message);
  if (foodRes.error) console.error('getEvolution food_log:', foodRes.error.message);
  if (photoCountRes.error) console.error('getEvolution photo count:', photoCountRes.error.message);
  if (mealCountRes.error) console.error('getEvolution meal count:', mealCountRes.error.message);

  const weightRows = (weightRes.data ?? []) as WeightRow[];
  const bodyRows = (bodyRes.data ?? []) as MeasurementRow[];
  const photoRows = ((photoRes.data ?? []) as PhotoRow[]).filter((row) => isIsoDate(row.taken_on));
  const foodRows = (foodRes.data ?? []) as FoodRow[];

  const photoCount = photoCountRes.count ?? photoRows.length;
  const mealsLogged = mealCountRes.count ?? foodRows.length;

  // Readings: coerced, date-validated, chronological. These are the only numbers in the summary.
  const weights: Reading[] = weightRows
    .filter((row) => isIsoDate(row.recorded_on))
    .map((row) => ({ on: row.recorded_on, value: toNumber(row.weight_kg) }))
    .filter((row): row is Reading => row.value !== null && row.value > 0);

  const waists: Reading[] = bodyRows
    .filter((row) => isIsoDate(row.recorded_on))
    .map((row) => ({ on: row.recorded_on, value: toNumber(row.waist_cm) }))
    .filter((row): row is Reading => row.value !== null && row.value > 0);

  // -------------------------------------------------------------------------------------------
  // startedOn: the earliest day she left ANY trace. Data first, onboarding second, account third.
  // -------------------------------------------------------------------------------------------
  let startedOn = earliest([
    weights[0]?.on,
    waists[0]?.on,
    photoRows[0]?.taken_on,
    foodRows[0]?.log_date,
  ]);
  if (startedOn === null) startedOn = await resolveFallbackStart(profileId, companyId, timezone);
  if (startedOn === null) return emptySummary();

  const weeksIn = weekIndex(startedOn, localDay(timezone));

  // -------------------------------------------------------------------------------------------
  // Headline deltas: latest minus first, in her display units. One reading is a starting point,
  // not a change, so it yields null rather than a flattering zero.
  // -------------------------------------------------------------------------------------------
  const weightDelta =
    weights.length >= 2
      ? round1(toDisplayWeight(weights[weights.length - 1].value - weights[0].value))
      : null;
  const waistDelta =
    waists.length >= 2
      ? round1(toDisplayLength(waists[waists.length - 1].value - waists[0].value))
      : null;

  // -------------------------------------------------------------------------------------------
  // Entries.
  // -------------------------------------------------------------------------------------------
  const entries: EvolutionEntry[] = [];

  entries.push({
    id: `started:${startedOn}:0`,
    kind: 'started',
    on: startedOn,
    week: 1,
    title: 'evolution.startedTitle',
  });

  // Photos: at most ONE per calendar week, the most recent shot in that week. 200 selfies must not
  // become 200 rows. Rows arrive ordered by (taken_on, created_at), so the last write per bucket
  // is the most recent one naturally.
  const photoByWeek = new Map<number, PhotoRow>();
  for (const row of photoRows) {
    photoByWeek.set(weekIndex(startedOn, row.taken_on), row);
  }
  for (const [week, row] of photoByWeek) {
    entries.push({
      id: `photo:${row.taken_on}:${row.id}`,
      kind: 'photo',
      on: row.taken_on,
      week,
      title: 'evolution.photoTitle',
    });
  }

  // Weight: the baseline weigh-in, then each new 5 lb line. Never one row per weigh-in.
  const weightMilestones = deriveMilestones(
    weights.map((reading) => ({ on: reading.on, value: toDisplayWeight(reading.value) })),
    WEIGHT_STEP,
  );
  for (const milestone of weightMilestones) {
    entries.push(
      milestone.step === null
        ? {
            id: `weight:${milestone.on}:first`,
            kind: 'weight',
            on: milestone.on,
            week: weekIndex(startedOn, milestone.on),
            title: 'evolution.weightFirstTitle',
            detail: String(round1(milestone.value)),
            unit: WEIGHT_UNIT,
          }
        : {
            id: `weight:${milestone.on}:${milestone.step}`,
            kind: 'weight',
            on: milestone.on,
            week: weekIndex(startedOn, milestone.on),
            title: 'evolution.weightMilestoneTitle',
            delta: milestone.delta,
            unit: WEIGHT_UNIT,
          },
    );
  }

  // Waist: identical rule, 2 in lines.
  const waistMilestones = deriveMilestones(
    waists.map((reading) => ({ on: reading.on, value: toDisplayLength(reading.value) })),
    LENGTH_STEP,
  );
  for (const milestone of waistMilestones) {
    entries.push(
      milestone.step === null
        ? {
            id: `measurement:${milestone.on}:waist-first`,
            kind: 'measurement',
            on: milestone.on,
            week: weekIndex(startedOn, milestone.on),
            title: 'evolution.waistFirstTitle',
            detail: String(round1(milestone.value)),
            unit: LENGTH_UNIT,
          }
        : {
            id: `measurement:${milestone.on}:waist:${milestone.step}`,
            kind: 'measurement',
            on: milestone.on,
            week: weekIndex(startedOn, milestone.on),
            title: 'evolution.waistMilestoneTitle',
            delta: milestone.delta,
            unit: LENGTH_UNIT,
          },
    );
  }

  // Consistency: the Nth log row's own date is the day she crossed N. Not today, not the day a
  // cron happened to notice.
  for (const threshold of CONSISTENCY_THRESHOLDS) {
    if (mealsLogged < threshold) break;
    const crossing = foodRows[threshold - 1];
    if (!crossing || !isIsoDate(crossing.log_date)) continue;
    entries.push({
      id: `consistency:${crossing.log_date}:${threshold}`,
      kind: 'consistency',
      on: crossing.log_date,
      week: weekIndex(startedOn, crossing.log_date),
      title: 'evolution.consistencyTitle',
      detail: String(threshold),
    });
  }

  // Chronological ascending (newest last), stable within a day.
  entries.sort((a, b) => {
    if (a.on !== b.on) return a.on < b.on ? -1 : 1;
    if (KIND_RANK[a.kind] !== KIND_RANK[b.kind]) return KIND_RANK[a.kind] - KIND_RANK[b.kind];
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  // Cap at MAX_ENTRIES, keeping the most recent window. 'started' is always kept: it is the anchor
  // the "Week N" rail is measured from, and dropping it would break the story's opening.
  let capped = entries;
  if (entries.length > MAX_ENTRIES) {
    const started = entries.find((entry) => entry.kind === 'started');
    const rest = entries.filter((entry) => entry.kind !== 'started');
    capped = started ? [started, ...rest.slice(-(MAX_ENTRIES - 1))] : rest.slice(-MAX_ENTRIES);
  }

  // -------------------------------------------------------------------------------------------
  // Signing. ONE batch call covering exactly the photos we will render plus the two bookends, so
  // the signed-URL count matches the row count and nothing is minted speculatively.
  // -------------------------------------------------------------------------------------------
  const firstPhoto = photoRows[0] ?? null;
  const latestPhoto = photoRows.length > 0 ? photoRows[photoRows.length - 1] : null;

  const photosById = new Map<string, PhotoRow>();
  for (const row of photoByWeek.values()) photosById.set(row.id, row);

  const pathsToSign = new Set<string>();
  for (const entry of capped) {
    if (entry.kind !== 'photo') continue;
    const row = photosById.get(photoIdFromEntryId(entry.id));
    if (row) pathsToSign.add(row.storage_path);
  }
  if (firstPhoto) pathsToSign.add(firstPhoto.storage_path);
  if (latestPhoto) pathsToSign.add(latestPhoto.storage_path);

  const signed = await signPaths(sb, [...pathsToSign]);

  const withUrls: EvolutionEntry[] = capped.map((entry) => {
    if (entry.kind !== 'photo') return entry;
    const row = photosById.get(photoIdFromEntryId(entry.id));
    const url = row ? signed.get(row.storage_path) : undefined;
    return url ? { ...entry, photoUrl: url } : entry;
  });

  return {
    startedOn,
    weeksIn,
    weightDelta,
    weightUnit: weightDelta === null ? null : WEIGHT_UNIT,
    waistDelta,
    lengthUnit: waistDelta === null ? null : LENGTH_UNIT,
    photoCount,
    mealsLogged,
    bookends: buildBookends(firstPhoto, latestPhoto, signed),
    entries: withUrls,
  };
}

// ---------------------------------------------------------------------------------------------
// Helpers that need the client. Split out so getEvolution stays readable.
// ---------------------------------------------------------------------------------------------

/**
 * Mint short-lived signed URLs for private-bucket paths. One batch call, never a loop. Signing
 * failure degrades to "no photo" rather than throwing: the rest of the story still stands.
 */
async function signPaths(
  sb: ReturnType<typeof createServiceClient>,
  paths: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  try {
    const { data, error } = await sb.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(paths, SIGNED_TTL_SECONDS);
    if (error) {
      console.error('getEvolution signPaths:', error.message);
      return out;
    }
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) out.set(item.path, item.signedUrl);
    }
  } catch (err) {
    console.error('getEvolution signPaths threw:', err instanceof Error ? err.message : err);
  }
  return out;
}

/**
 * First and latest shot for the side-by-side that does the emotional work. With exactly one photo,
 * `latest` IS that photo and `weeksBetween` stays null: there is no elapsed span to claim.
 */
function buildBookends(
  first: PhotoRow | null,
  latest: PhotoRow | null,
  signed: Map<string, string>,
): EvolutionBookends {
  if (!first) return { first: null, latest: null, weeksBetween: null };

  const firstUrl = signed.get(first.storage_path);
  const firstSide = firstUrl ? { url: firstUrl, on: first.taken_on } : null;

  if (!latest || latest.id === first.id) {
    return { first: firstSide, latest: firstSide, weeksBetween: null };
  }

  const latestUrl = signed.get(latest.storage_path);
  return {
    first: firstSide,
    latest: latestUrl ? { url: latestUrl, on: latest.taken_on } : null,
    weeksBetween: Math.floor(daysBetween(first.taken_on, latest.taken_on) / 7),
  };
}

/**
 * Only reached when she has zero body, photo and food rows: fall back to the day she finished
 * onboarding, then to the day the account was created. Both are timestamps, so they go through
 * localDay(tz) rather than toISOString(). Returns null when even those are missing.
 */
async function resolveFallbackStart(
  profileId: string,
  companyId: string | null,
  timezone: string | null,
): Promise<string | null> {
  const sb = createServiceClient();
  try {
    let onboardingQuery = sb
      .from('onboarding_responses')
      .select('completed_at')
      .eq('profile_id', profileId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: true })
      .limit(1);
    if (companyId) onboardingQuery = onboardingQuery.eq('company_id', companyId);

    const { data: onboarding, error: onboardingError } = await onboardingQuery.maybeSingle();
    if (onboardingError) {
      console.error('getEvolution onboarding_responses:', onboardingError.message);
    }
    const completedAt = (onboarding as { completed_at: string | null } | null)?.completed_at;
    if (completedAt) return localDay(timezone, new Date(completedAt));

    let profileQuery = sb.from('profiles').select('created_at').eq('id', profileId).limit(1);
    if (companyId) profileQuery = profileQuery.eq('company_id', companyId);

    const { data: profile, error: profileError } = await profileQuery.maybeSingle();
    if (profileError) console.error('getEvolution profiles:', profileError.message);
    const createdAt = (profile as { created_at: string | null } | null)?.created_at;
    if (createdAt) return localDay(timezone, new Date(createdAt));
  } catch (err) {
    console.error('getEvolution resolveFallbackStart:', err instanceof Error ? err.message : err);
  }
  return null;
}
