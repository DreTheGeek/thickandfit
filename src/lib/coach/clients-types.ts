import type { ClientHabits } from '@/lib/coach/client-habits';
// Pure, client-safe types + constants + filter parsing for the Clients CRM. No server imports,
// so client components can import these without dragging in the service client. The server data
// layer (clients.ts) re-exports everything from here.
import type { Standing } from '@/lib/coach/standing';
// TYPE-ONLY, and it has to stay that way. health-profile/data.ts is `import "server-only"`, which
// throws if it is ever pulled into a client bundle. `import type` is erased at compile time so no
// runtime import exists. Do not convert this to a value import to grab the schema or a constant:
// take those from health-profile/labels.ts, which is genuinely client-safe.
import type { HealthProfileInput } from '@/lib/health-profile/data';

export type SortField = 'name' | 'mrr' | 'started' | 'lifetime';
export type SortDir = 'asc' | 'desc';

export type ClientFilters = {
  q: string;
  standing: string[];
  status: string[];
  health: string[];
  product: string[];
  lang: string[];
  owner: string[];
  tags: string[];
  cohort: string[];
  legacy: boolean | null;
  sort: SortField;
  dir: SortDir;
  page: number;
  pageSize: number;
  segment: string | null;
};

export type TagLite = { slug: string; label: string; category: string; color: string };

export type ClientRow = {
  id: string;
  name: string;
  initials: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  billingHealth: string | null;
  standing: Standing;
  productType: string | null;
  priceCents: number | null;
  lifetimeCents: number | null;
  currency: string;
  language: string | null;
  owner: string | null;
  tags: TagLite[];
  tagSlugs: string[];
  nextBillingDate: string | null;
  startedAt: string | null;
  cohortYear: string;
  createdAt: string;
  isLegacy: boolean;
  wasLead: boolean;
  /**
   * Monthly vs paid in full, which Stephanie asked for directly.
   *
   * Derived from real Lenus charge history (migration 0111), NOT from client_subscriptions, which
   * has no billing data at all for 189 of her 256 clients. Null means she was not in the payment
   * export, which is a different statement from "she never paid".
   */
  paymentType: string | null;
};

export type Bucket = { key: string; count: number };
export type TagStat = TagLite & { count: number };
export type ClientFacets = {
  standing: Bucket[];
  status: Bucket[];
  health: Bucket[];
  product: Bucket[];
  lang: Bucket[];
  owner: Bucket[];
  cohort: Bucket[];
  tags: TagStat[];
  legacyCount: number;
};

export type ClientsPage = {
  rows: ClientRow[];
  total: number;
  page: number;
  pageSize: number;
  facets: ClientFacets;
  totalAll: number;
  // True when the underlying read hit the in-memory cap, so totalAll/facets are a partial view.
  listTruncated: boolean;
};

export const CLIENT_ROWS_CAP = 2000;

export type SavedSegment = {
  id: string;
  name: string;
  slug: string;
  color: string;
  definition: Partial<ClientFilters>;
};

export type LedgerEntry = {
  date: string | null;
  category: string | null;
  grossCents: number;
  coachCents: number;
  currency: string;
  runningCents: number;
};

export type ClientDetail = {
  id: string;
  name: string;
  initials: string;
  email: string | null;
  phone: string | null;
  language: string | null;
  owner: string | null;
  source: string | null;
  legacySource: string | null;
  lenusId: string | null;
  isLegacy: boolean;
  wasLead: boolean;
  status: string | null;
  billingHealth: string | null;
  standing: Standing;
  productType: string | null;
  priceCents: number | null;
  nextAmountCents: number | null;
  lifetimeCents: number | null;
  currency: string;
  isAutoRenew: boolean | null;
  startedAt: string | null;
  endedAt: string | null;
  nextBillingDate: string | null;
  lastChargeDate: string | null;
  numCharges: number | null;
  daysSinceLastCharge: number | null;
  mealPlanSentAt: string | null;
  workoutPlanSentAt: string | null;
  tenureDays: number | null;
  createdAt: string;
  tags: TagLite[];
  mealPlan: {
    id: string;
    name: string;
    calorieGoal: number | null;
    proteinG: number | null;
    carbG: number | null;
    fatG: number | null;
    macroTiming: string | null;
  } | null;
  snapshot: {
    mealPlans: number | null;
    measurements: number | null;
    checkins: number | null;
    workouts: number | null;
    messages: number | null;
    healthAssessment: number | null;
    weightGoal: string | null;
    goalIntensity: string | null;
  } | null;
  ledger: LedgerEntry[];
  // True when the txn read hit its cap: the ledger is windowed, so the running-balance column is
  // not anchored to a true zero start and must be hidden rather than shown with wrong values.
  ledgerTruncated: boolean;
  files: ClientFile[];
  // Migrated-from-Lenus health profile + progress history (null / empty for non-migrated clients).
  intake: ClientIntake | null;
  progress: {
    weights: { on: string; kg: number }[]; // chronological (oldest->newest of the loaded window)
    weightCount: number; // true total weigh-ins
    weightStartKg: number | null; // the very first weigh-in (accurate net-change baseline)
    measures: { on: string; waist: number | null; hips: number | null; chest: number | null; arms: number | null; thighs: number | null }[];
    measureCount: number;
    /** Newest first, with the oldest 20 merged in so a before/after can reach the real baseline. */
    photos: { url: string; on: string; pose: string | null; weightKg: number | null }[];
    photoCount: number; // true total photos
    foodDays: number;
    workoutCount: number; // migrated Lenus workout sessions
    recentWorkouts: { on: string; name: string | null; plan: string | null; pct: number | null }[];
  };
  // Migrated coach<->client conversation history (most recent first). totalMessages is the full count.
  messages: ClientMessage[];
  totalMessages: number;
  hasAccount: boolean; // client has claimed an app profile (messages go in-app vs by email)
  /** The claimed app profile, when there is one. Habits, check-ins and notes are keyed by it. */
  profileId: string | null;
  /** Eight weeks of habit completion. Null when the client has no app account. */
  habits: ClientHabits | null;
};

export type ClientMessage = {
  id: string;
  isFromCoach: boolean;
  senderName: string | null;
  body: string | null;
  type: string | null;
  sentAt: string;
  attachments: { url: string; name: string | null; kind: string | null }[];
  attachmentCount: number; // total attachments on the message (incl. any not yet downloadable)
};

export type ClientIntake = {
  sex: string | null;
  birthDate: string | null;
  heightCm: number | null;
  startingWeightKg: number | null;
  goalType: string | null;
  goalIntensity: string | null;
  targetWeightKg: number | null;
  bmr: number | null;
  /** bmr * pal. Null for migrated clients, who never answered an activity question we can score. */
  tdee: number | null;
  /** Physical activity multiplier, e.g. 1.54. */
  pal: number | null;
  calorieGoalKcal: number | null;
  /**
   * FREE TEXT, not a slug, despite the name. On the live database this is prose carried over from
   * the Lenus intake ("I've been a weight lifter since 1995..."), 188 of 267 rows null. Render it,
   * never parse it. The scoreable slug is on onboarding_responses.answers.activity.
   */
  activityLevel: string | null;
  injuries: string[] | null;
  injuriesDescription: string | null;
  medicalConditions: string | null;
  dietaryExclusions: string[] | null;
  allergies: string | null;
  trainingExperience: string | null;
  badHabits: string | null;
  clientWhy: string | null;
  sessionsPerWeek: number | null;
  equipment: string[] | null;
  /** 'potential' | 'none' | null. The verdict, not the per-question SCOFF booleans. */
  edsRisk: string | null;
  intakeNotes: string | null;
  needsCoachReview: boolean;
  questionnaireFilledAt: string | null;
  /**
   * Conditions, medications, pregnancy, PAR-Q safety flags, sleep, stress, food relationship and
   * training location. Derived by the SAME mapper the member's own health form uses
   * (lib/health-profile/data.ts), so the two readings cannot drift.
   */
  healthProfile: HealthProfileInput;
};

export const LEDGER_TXN_CAP = 1000;

export type ClientFile = { category: string | null; url: string; bytes: number | null };

export const NONE_KEY = '__none';

const SORTS: readonly SortField[] = ['name', 'mrr', 'started', 'lifetime'];

function toArr(v: string | string[] | undefined): string[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).filter((s) => typeof s === 'string' && s.length > 0);
}

/** Parse + sanitize raw searchParams into typed filters. Strips junk, caps pageSize, defaults. */
export function parseClientFilters(raw: Record<string, string | string[] | undefined>): ClientFilters {
  const sortRaw = typeof raw.sort === 'string' ? raw.sort : '';
  // NEWEST JOINED FIRST, not alphabetical.
  //
  // 269 clients arrived from the Lenus import, so an A-Z default buries everyone who signed up in
  // the app somewhere in the middle of a list nobody scrolls. Reported 2026-08-03 as "I created
  // accounts and none of them appeared": they had all appeared, three pages down. The one question a
  // coach opens this page to answer is who just joined.
  const sort = SORTS.includes(sortRaw as SortField) ? (sortRaw as SortField) : 'started';
  const legacyRaw = typeof raw.legacy === 'string' ? raw.legacy : '';
  return {
    q: typeof raw.q === 'string' ? raw.q.trim().slice(0, 80) : '',
    standing: toArr(raw.standing),
    status: toArr(raw.status),
    health: toArr(raw.health),
    product: toArr(raw.product),
    lang: toArr(raw.lang),
    owner: toArr(raw.owner),
    tags: toArr(raw.tags),
    cohort: toArr(raw.cohort),
    legacy: legacyRaw === '1' || legacyRaw === 'true' ? true : legacyRaw === '0' || legacyRaw === 'false' ? false : null,
    sort,
    // Descending unless asked otherwise, so the default pairs with `started` to put the most recent
    // signup on the first row. An explicit ?dir=asc still wins.
    dir: raw.dir === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, Math.floor(Number(raw.page)) || 1),
    pageSize: Math.min(100, Math.max(10, Math.floor(Number(raw.pageSize)) || 50)),
    segment: typeof raw.segment === 'string' ? raw.segment : null,
  };
}

/**
 * Clamp a requested page to the valid range for a known result count. parseClientFilters only
 * floors the page to >= 1 because the total is unknown at parse time; once a data layer knows the
 * total it must clamp to min(page, max(1, totalPages)) so an out-of-range page (e.g. after filters
 * shrink the result set) shows the last real page instead of an empty slice.
 */
export function clampPage(page: number, total: number, pageSize: number): number {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  return Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
}

export type SegmentPreset = { slug: string; labelKey: string; filter: Partial<ClientFilters> };
export const SEGMENT_PRESETS: SegmentPreset[] = [
  { slug: 'all', labelKey: 'segAllClients', filter: {} },
  { slug: 'healthy', labelKey: 'segActivePayers', filter: { standing: ['healthy'] } },
  { slug: 'at-risk', labelKey: 'segAtRisk', filter: { standing: ['at_risk'] } },
  { slug: 'churned', labelKey: 'segChurnedWinback', filter: { standing: ['churned'] } },
  { slug: 'cancelling', labelKey: 'segCancelling', filter: { tags: ['cancelling'] } },
  { slug: 'personal-coaching', labelKey: 'segPersonalCoaching', filter: { product: ['personalCoaching'] } },
  { slug: 'bootcamp', labelKey: 'segBootcamp', filter: { product: ['bootcamp'] } },
  { slug: 'six-week', labelKey: 'segSixWeek', filter: { tags: ['6-week-body-recomp'] } },
  { slug: 'her-again', labelKey: 'segHerAgain', filter: { tags: ['her-again-challenge'] } },
  { slug: 'health-flags', labelKey: 'segHealthFlags', filter: { tags: ['pcos', 'glp-1'] } },
  { slug: 'spanish', labelKey: 'segSpanishSpeaking', filter: { tags: ['spanish'] } },
];
