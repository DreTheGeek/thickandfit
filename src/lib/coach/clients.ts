// Clients CRM server data layer. One read of the client contacts, then filter / sort / paginate /
// facet-count in memory (256 rows). company_id is pinned by the caller from requireCoach ctx,
// never from searchParams. Transaction totals come from denormalized lifetime_paid_cents, never an
// unscoped txn select. Pure types + constants live in clients-types.ts (client-safe); re-exported.
import 'server-only';
import { getTranslations } from 'next-intl/server';
import { createServiceClient } from '@/lib/supabase/service';
import { deriveStanding } from '@/lib/coach/standing';
import { mapIntakeToHealthProfile } from '@/lib/health-profile/data';
import { scoffPositive } from '@/lib/health-profile/screening';
import {
  CLIENT_ROWS_CAP,
  LEDGER_TXN_CAP,
  NONE_KEY,
  clampPage,
  type ClientDetail,
  type ClientFacets,
  type ClientFilters,
  type ClientRow,
  type ClientsPage,
  type Bucket,
  type LedgerEntry,
  type SavedSegment,
  type SortDir,
  type SortField,
  type TagLite,
  type TagStat,
} from '@/lib/coach/clients-types';

export * from '@/lib/coach/clients-types';

type ContactRowRaw = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  language: string | null;
  owner: string | null;
  is_legacy: boolean | null;
  was_lead: boolean | null;
  product_type: string | null;
  payment_type: string | null;
  created_at: string;
  profile_id: string | null;
  client_subscriptions: SubRaw | SubRaw[] | null;
  contact_tags: TagJoinRaw[] | null;
};
type SubRaw = {
  status: string | null;
  billing_health: string | null;
  product_type: string | null;
  grandfathered_price_cents: number | null;
  currency: string | null;
  next_billing_date: string | null;
  lifetime_paid_cents: number | null;
  started_at: string | null;
};
type TagJoinRaw = { tag: TagLite | TagLite[] | null };

// Native in-app Stripe subscription shape, keyed by profile_id (webhook-driven, table 0025).
// Used to synthesize a SubRaw when the CRM contact was created by app signup and has no
// client_subscriptions row (which is only populated by the ghl-sync cron from Lenus).
type NativeSubRaw = {
  profile_id: string;
  status: string | null;
  price_cents: number | string | null;
  currency: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  canceled_at: string | null;
  created_at: string | null;
};

/** Native Stripe subscription -> SubRaw shim, so an app subscriber appears in the CRM as healthy
 *  instead of churned. billing_health/product_type/lifetime_paid_cents don't exist on native (they'd
 *  need the payments-table aggregation) — set null; the rest maps cleanly. */
function nativeToSubRaw(n: NativeSubRaw): SubRaw {
  const price = n.price_cents == null ? null : Number(n.price_cents);
  return {
    status: n.status,
    billing_health: null,
    product_type: null,
    grandfathered_price_cents: Number.isFinite(price as number) ? (price as number) : null,
    currency: n.currency,
    next_billing_date: n.cancel_at_period_end || !n.current_period_end ? null : n.current_period_end.slice(0, 10),
    lifetime_paid_cents: null,
    started_at: n.created_at,
  };
}

function one<T>(v: T | T[] | null): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function initialsOf(first: string | null, last: string | null, fallback: string): string {
  const a = (first ?? '').trim();
  const b = (last ?? '').trim();
  const i = (a[0] ?? '') + (b[0] ?? '');
  return (i || fallback[0] || '?').toUpperCase();
}

function mapRow(c: ContactRowRaw, noName: string): ClientRow {
  const sub = one(c.client_subscriptions);
  const tags: TagLite[] = (c.contact_tags ?? []).map((t) => one(t.tag)).filter((t): t is TagLite => t != null);
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || noName;
  // App-signup members have no Lenus subscription row; their join date is the contact creation.
  // Legacy contacts keep null (an unknown Lenus start must not masquerade as the import date).
  const startedAt = sub?.started_at ?? (c.is_legacy ? null : c.created_at);
  return {
    id: c.id,
    name,
    initials: initialsOf(c.first_name, c.last_name, name),
    email: c.email,
    phone: c.phone,
    status: sub?.status ?? null,
    billingHealth: sub?.billing_health ?? null,
    standing: deriveStanding(sub?.status ?? null, sub?.billing_health ?? null),
    productType: sub?.product_type ?? c.product_type ?? null,
    priceCents: sub?.grandfathered_price_cents ?? null,
    lifetimeCents: sub?.lifetime_paid_cents ?? null,
    currency: sub?.currency ?? 'USD',
    language: c.language,
    owner: c.owner,
    tags,
    tagSlugs: tags.map((t) => t.slug),
    nextBillingDate: sub?.next_billing_date ?? null,
    startedAt,
    cohortYear: startedAt ? startedAt.slice(0, 4) : NONE_KEY,
    createdAt: c.created_at,
    isLegacy: c.is_legacy ?? false,
    wasLead: c.was_lead ?? false,
    paymentType: c.payment_type,
  };
}

async function loadClientRows(companyId: string): Promise<{ rows: ClientRow[]; truncated: boolean }> {
  const sb = createServiceClient();
  // Fetch contacts + their imported CRM subscriptions in parallel with the native in-app Stripe
  // subscriptions table. Before this union, an app subscriber (whose contact has no
  // client_subscriptions row because that table is only populated by the ghl-sync cron) rendered
  // as "churned" here. Same pattern the Coach Billing & Renewals page already uses.
  const [{ data, error }, { data: nativeData, error: nativeErr }] = await Promise.all([
    sb
      .from('contacts')
      .select(
        'id, first_name, last_name, email, phone, language, owner, is_legacy, was_lead, product_type, payment_type, created_at, profile_id, ' +
          'client_subscriptions(status, billing_health, product_type, grandfathered_price_cents, currency, next_billing_date, lifetime_paid_cents, started_at), ' +
          'contact_tags(tag:tags(slug, label, category, color))',
      )
      .eq('company_id', companyId)
      .eq('type', 'client')
      .limit(CLIENT_ROWS_CAP),
    sb
      .from('subscriptions')
      .select('profile_id, status, price_cents, currency, current_period_end, cancel_at_period_end, canceled_at, created_at')
      .eq('company_id', companyId)
      .limit(CLIENT_ROWS_CAP),
  ]);
  if (error) throw new Error(`loadClientRows: ${error.message}`);
  if (nativeErr) throw new Error(`loadClientRows.native: ${nativeErr.message}`);
  const t = await getTranslations('app.coach');
  const noName = t('noName');
  const raw = (data ?? []) as unknown as ContactRowRaw[];
  // Newest-first per profile so a member who resubscribed sees the current sub, not a stale one.
  const nativeByProfile = new Map<string, NativeSubRaw>();
  const sortedNative = ((nativeData ?? []) as unknown as NativeSubRaw[])
    .slice()
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
  for (const n of sortedNative) {
    if (n.profile_id && !nativeByProfile.has(n.profile_id)) nativeByProfile.set(n.profile_id, n);
  }
  // Synthesize a SubRaw shim only when the CRM row is missing one — never overwrite an imported sub.
  const merged = raw.map((c) => {
    if (!c.client_subscriptions && c.profile_id) {
      const n = nativeByProfile.get(c.profile_id);
      if (n) return { ...c, client_subscriptions: nativeToSubRaw(n) };
    }
    return c;
  });
  // If we read exactly the cap, the list is windowed: totals/facets are a partial view, so flag it.
  return { rows: merged.map((c) => mapRow(c, noName)), truncated: raw.length >= CLIENT_ROWS_CAP };
}

type FacetKey = 'q' | 'standing' | 'status' | 'health' | 'product' | 'lang' | 'owner' | 'tags' | 'cohort' | 'legacy';

function matches(r: ClientRow, f: ClientFilters, exclude: FacetKey | null): boolean {
  if (exclude !== 'q' && f.q) {
    const q = f.q.toLowerCase();
    const hay = `${r.name} ${r.email ?? ''} ${r.phone ?? ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (exclude !== 'standing' && f.standing.length && !f.standing.includes(r.standing)) return false;
  if (exclude !== 'status' && f.status.length && !f.status.includes(r.status ?? NONE_KEY)) return false;
  if (exclude !== 'health' && f.health.length && !f.health.includes(r.billingHealth ?? NONE_KEY)) return false;
  if (exclude !== 'product' && f.product.length && !f.product.includes(r.productType ?? NONE_KEY)) return false;
  if (exclude !== 'lang' && f.lang.length && !f.lang.includes(r.language ?? NONE_KEY)) return false;
  if (exclude !== 'owner' && f.owner.length && !f.owner.includes(r.owner ?? NONE_KEY)) return false;
  if (exclude !== 'cohort' && f.cohort.length && !f.cohort.includes(r.cohortYear)) return false;
  if (exclude !== 'legacy' && f.legacy != null && r.isLegacy !== f.legacy) return false;
  if (exclude !== 'tags' && f.tags.length && !f.tags.some((t) => r.tagSlugs.includes(t))) return false;
  return true;
}

function tally(rows: ClientRow[], keyOf: (r: ClientRow) => string | null): Bucket[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    if (k == null || k === '') continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

function tagTally(rows: ClientRow[]): TagStat[] {
  const m = new Map<string, TagStat>();
  for (const r of rows) {
    for (const t of r.tags) {
      const cur = m.get(t.slug);
      if (cur) cur.count += 1;
      else m.set(t.slug, { ...t, count: 1 });
    }
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

function sortRows(rows: ClientRow[], sort: SortField, dir: SortDir): ClientRow[] {
  const mul = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (sort) {
      case 'mrr':
        return ((a.priceCents ?? -1) - (b.priceCents ?? -1)) * mul;
      case 'lifetime':
        return ((a.lifetimeCents ?? -1) - (b.lifetimeCents ?? -1)) * mul;
      case 'started':
        return (a.startedAt ?? '').localeCompare(b.startedAt ?? '') * mul;
      default:
        return a.name.localeCompare(b.name) * mul;
    }
  });
}

function computeFacets(rows: ClientRow[], f: ClientFilters): ClientFacets {
  return {
    standing: tally(rows.filter((r) => matches(r, f, 'standing')), (r) => r.standing),
    status: tally(rows.filter((r) => matches(r, f, 'status')), (r) => r.status ?? NONE_KEY),
    health: tally(rows.filter((r) => matches(r, f, 'health')), (r) => r.billingHealth ?? NONE_KEY),
    product: tally(rows.filter((r) => matches(r, f, 'product')), (r) => r.productType ?? NONE_KEY),
    lang: tally(rows.filter((r) => matches(r, f, 'lang')), (r) => r.language ?? NONE_KEY),
    owner: tally(rows.filter((r) => matches(r, f, 'owner')), (r) => r.owner ?? NONE_KEY),
    cohort: tally(rows.filter((r) => matches(r, f, 'cohort')), (r) => r.cohortYear),
    tags: tagTally(rows.filter((r) => matches(r, f, 'tags'))),
    legacyCount: rows.filter((r) => matches(r, f, 'legacy') && r.isLegacy).length,
  };
}

export async function getClientsPage(companyId: string, filters: ClientFilters): Promise<ClientsPage> {
  const { rows: all, truncated } = await loadClientRows(companyId);
  const filtered = all.filter((r) => matches(r, filters, null));
  const sorted = sortRows(filtered, filters.sort, filters.dir);
  const page = clampPage(filters.page, filtered.length, filters.pageSize);
  const start = (page - 1) * filters.pageSize;
  return {
    rows: sorted.slice(start, start + filters.pageSize),
    total: filtered.length,
    page,
    pageSize: filters.pageSize,
    facets: computeFacets(all, filters),
    totalAll: all.length,
    listTruncated: truncated,
  };
}

export async function getSavedSegments(companyId: string): Promise<SavedSegment[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('saved_segments')
    .select('id, name, slug, color, definition')
    .eq('company_id', companyId)
    .eq('scope', 'client')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return ((data ?? []) as { id: string; name: string; slug: string; color: string; definition: unknown }[]).map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    color: s.color,
    definition: s.definition && typeof s.definition === 'object' ? (s.definition as Partial<ClientFilters>) : {},
  }));
}

export async function getClientDetail(companyId: string, contactId: string): Promise<ClientDetail | null> {
  const sb = createServiceClient();
  const { data: c } = await sb
    .from('contacts')
    .select('*, client_subscriptions(*), legacy_client_snapshot(*), contact_tags(tag:tags(slug, label, category, color))')
    .eq('company_id', companyId)
    .eq('id', contactId)
    .eq('type', 'client')
    .maybeSingle();
  if (!c) return null;

  type FullSub = SubRaw & {
    next_amount_cents: number | null;
    is_auto_renew: boolean | null;
    ended_at: string | null;
    last_charge_date: string | null;
    num_charges: number | null;
    days_since_last_charge: number | null;
    meal_plan_sent_at: string | null;
    workout_plan_sent_at: string | null;
  };

  // Native Stripe sub -> FullSub shim (same idea as loadClientRows, richer shape). Fields the native
  // subscriptions table doesn't have (lifetime charges, next amount preview, plan-sent stamps) stay
  // null; they'd need the payments-table aggregation or a Stripe API call and are non-blocking.
  const nativeToFullSub = (n: NativeSubRaw): FullSub => {
    const price = n.price_cents == null ? null : Number(n.price_cents);
    return {
      status: n.status,
      billing_health: null,
      product_type: null,
      grandfathered_price_cents: Number.isFinite(price as number) ? (price as number) : null,
      currency: n.currency,
      next_billing_date: n.cancel_at_period_end || !n.current_period_end ? null : n.current_period_end.slice(0, 10),
      lifetime_paid_cents: null,
      started_at: n.created_at,
      next_amount_cents: null,
      is_auto_renew: n.cancel_at_period_end == null ? null : !n.cancel_at_period_end,
      ended_at: n.canceled_at,
      last_charge_date: null,
      num_charges: null,
      days_since_last_charge: null,
      meal_plan_sent_at: null,
      workout_plan_sent_at: null,
    };
  };
  type Snap = {
    meal_plans: number | null;
    measurements_logged: number | null;
    checkins: number | null;
    workouts_completed: number | null;
    messages_in_window: number | null;
    health_assessment: number | null;
    weight_goal: string | null;
    goal_intensity: string | null;
  };
  type DetailRaw = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    language: string | null;
    owner: string | null;
    is_legacy: boolean | null;
    was_lead: boolean | null;
    product_type: string | null;
    created_at: string;
    source: string | null;
    legacy_source: string | null;
    lenus_id: string | null;
    profile_id: string | null;
    client_subscriptions: FullSub | FullSub[] | null;
    legacy_client_snapshot: Snap | Snap[] | null;
    contact_tags: TagJoinRaw[] | null;
  };
  const raw = c as unknown as DetailRaw;
  let sub: FullSub | null = one(raw.client_subscriptions);
  // If the imported CRM sub is missing but this contact links to an auth profile, look up the
  // native in-app Stripe subscription and use it. Newest first so a resubscribe wins over a canceled row.
  if (!sub && raw.profile_id) {
    const { data: nrows } = await sb
      .from('subscriptions')
      .select('profile_id, status, price_cents, currency, current_period_end, cancel_at_period_end, canceled_at, created_at')
      .eq('company_id', companyId)
      .eq('profile_id', raw.profile_id)
      .order('created_at', { ascending: false })
      .limit(1);
    const n = ((nrows ?? []) as unknown as NativeSubRaw[])[0];
    if (n) sub = nativeToFullSub(n);
  }
  const snap = one(raw.legacy_client_snapshot);
  const tags: TagLite[] = (raw.contact_tags ?? []).map((t) => one(t.tag)).filter((t): t is TagLite => t != null);

  const { data: txnData } = await sb
    .from('contact_transactions')
    .select('occurred_at, category, gross_cents, coach_cents, currency')
    .eq('company_id', companyId)
    .eq('contact_id', contactId)
    .order('occurred_at', { ascending: false })
    .limit(LEDGER_TXN_CAP);
  const txns = (txnData ?? []) as { occurred_at: string | null; category: string | null; gross_cents: number | null; coach_cents: number | null; currency: string | null }[];
  // If we hit the cap the ledger is windowed, so it cannot back a money total and the running
  // balance is not anchored to a true zero start. Flag it; the UI hides the running-balance column.
  const ledgerTruncated = txns.length >= LEDGER_TXN_CAP;
  let running = txns.reduce((acc, t) => acc + Number(t.gross_cents ?? 0), 0);
  const ledgerTotalCents = running;
  const ledger: LedgerEntry[] = txns.map((t) => {
    const entry: LedgerEntry = {
      date: t.occurred_at,
      category: t.category,
      grossCents: Number(t.gross_cents ?? 0),
      coachCents: Number(t.coach_cents ?? 0),
      currency: t.currency ?? 'USD',
      // When truncated the cumulative figure is wrong (missing older rows), so zero it out; the
      // UI suppresses the column entirely rather than render a misleading value.
      runningCents: ledgerTruncated ? 0 : running,
    };
    running -= Number(t.gross_cents ?? 0);
    return entry;
  });

  // The client's most recent assigned meal plan (Lenus import linked plans by contact).
  const { data: mpData } = await sb
    .from('meal_plans')
    .select('id, name, calorie_goal, protein_g, carb_g, fat_g, macro_timing_name')
    .eq('company_id', companyId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const mp = mpData as {
    id: string;
    name: string;
    calorie_goal: number | null;
    protein_g: number | null;
    carb_g: number | null;
    fat_g: number | null;
    macro_timing_name: string | null;
  } | null;
  const mealPlan = mp
    ? { id: mp.id, name: mp.name, calorieGoal: mp.calorie_goal, proteinG: mp.protein_g, carbG: mp.carb_g, fatG: mp.fat_g, macroTiming: mp.macro_timing_name }
    : null;

  // Client files + progress photos (imported from Lenus media, re-hosted on R2).
  const { data: fileData } = await sb
    .from('contact_files')
    .select('category, url, bytes')
    .eq('company_id', companyId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(300);
  const files = ((fileData ?? []) as { category: string | null; url: string; bytes: number | null }[]).map((f) => ({
    category: f.category,
    url: f.url,
    bytes: f.bytes,
  }));

  // Intake / health profile.
  //
  // This select used to name 15 of the ~25 columns, and the omissions were the clinically loaded
  // ones: allergies, medications, PCOS, sleep, stress, food relationship, pregnancy, PAR-Q flags,
  // eating-disorder screening. All of it is written by health-profile/data.ts and all of it was
  // already being read by coach-ai/context.ts to ground the chat, so the model knew a member's
  // medications while the coach looking at her record did not. Now the coach sees what the model
  // sees. `healthProfile` below is the SAME derivation the member's own form uses.
  const { data: intakeRow } = await sb
    .from('client_intake')
    .select(
      'sex, birth_date, height_cm, starting_weight_kg, goal_type, goal_intensity, target_weight_kg, bmr, tdee, pal, ' +
        'calorie_goal_kcal, activity_level, injuries, injuries_description, medical_conditions, dietary_exclusions, ' +
        'allergies, training_experience, bad_habits, client_why, sessions_per_week, equipment, ' +
        'eating_disorder_screening, sleep_assessment, custom_fields, intake_notes, needs_coach_review, questionnaire_filled_at',
    )
    .eq('company_id', companyId)
    .eq('contact_id', contactId)
    .maybeSingle();
  type IntakeRaw = {
    sex: string | null; birth_date: string | null; height_cm: number | null; starting_weight_kg: number | null;
    goal_type: string | null; goal_intensity: string | null; target_weight_kg: number | null;
    bmr: number | null; tdee: number | null; pal: number | null; calorie_goal_kcal: number | null;
    activity_level: string | null;
    injuries: string[] | null; injuries_description: string | null; medical_conditions: string | null;
    dietary_exclusions: string[] | null; allergies: string | null; training_experience: string | null;
    bad_habits: string | null; client_why: string | null; sessions_per_week: number | null; equipment: string[] | null;
    eating_disorder_screening: Record<string, unknown> | null;
    intake_notes: string | null; needs_coach_review: boolean | null; questionnaire_filled_at: string | null;
  };
  const ir = intakeRow as IntakeRaw | null;
  // Postgres numeric arrives as a string via PostgREST; coerce every numeric or .toFixed() crashes.
  const nn = (v: number | string | null): number | null => (v == null ? null : Number(v));
  // Structured hormonal/medical answers live in custom_fields.healthProfile and in two jsonb columns.
  // Read them through the same mapper the member's form uses so the two never diverge.
  const healthProfile = mapIntakeToHealthProfile(
    (intakeRow as Parameters<typeof mapIntakeToHealthProfile>[0]) ?? null,
  );
  // The screen stores per-question booleans; the coach needs the verdict, not the instrument.
  //
  // Scored by the SAME scoffPositive() the coach persona and the member's own screens already use.
  // A first pass here counted every true value in the payload, which is wrong twice over: the blob
  // carries eight keys and only five are SCOFF items, so `prefersLightTracking` alone would have
  // pushed a member to two and flagged her. 242 of 267 clients have this payload, so a scoring bug
  // here is a wrong badge on most of her book, on the most sensitive thing we hold.
  const eds = (ir?.eating_disorder_screening ?? null) as Record<string, unknown> | null;
  const edsRisk = eds == null ? null : scoffPositive(eds) ? 'potential' : 'none';
  const intake = ir
    ? {
        sex: ir.sex, birthDate: ir.birth_date, heightCm: nn(ir.height_cm), startingWeightKg: nn(ir.starting_weight_kg),
        goalType: ir.goal_type, goalIntensity: ir.goal_intensity, targetWeightKg: nn(ir.target_weight_kg),
        bmr: nn(ir.bmr), tdee: nn(ir.tdee), pal: nn(ir.pal), calorieGoalKcal: nn(ir.calorie_goal_kcal),
        activityLevel: ir.activity_level,
        injuries: ir.injuries, injuriesDescription: ir.injuries_description, medicalConditions: ir.medical_conditions,
        dietaryExclusions: ir.dietary_exclusions, allergies: ir.allergies,
        trainingExperience: ir.training_experience, badHabits: ir.bad_habits,
        clientWhy: ir.client_why, sessionsPerWeek: ir.sessions_per_week, equipment: ir.equipment,
        edsRisk, intakeNotes: ir.intake_notes, needsCoachReview: ir.needs_coach_review === true,
        questionnaireFilledAt: ir.questionnaire_filled_at,
        healthProfile,
      }
    : null;

  // Load the MOST RECENT window (desc + reverse to chronological) so "latest" is truly latest, plus the
  // exact totals and the true first weigh-in, so the coach never sees a stale value labeled current.
  const [{ data: wRows, count: weightCount }, { data: mRows, count: measureCount }, { data: pRows, count: photoCount }, { data: wFirst }, { count: foodDays }] = await Promise.all([
    sb.from('weight_entries').select('recorded_on, weight_kg', { count: 'exact' }).eq('contact_id', contactId).order('recorded_on', { ascending: false }).limit(120),
    sb.from('body_measurements').select('recorded_on, waist_cm, hips_cm, chest_cm, arms_cm, thighs_cm', { count: 'exact' }).eq('contact_id', contactId).order('recorded_on', { ascending: false }).limit(120),
    sb.from('progress_photos').select('storage_path, taken_on, pose_source', { count: 'exact' }).eq('contact_id', contactId).order('taken_on', { ascending: false }).limit(60),
    sb.from('weight_entries').select('weight_kg').eq('contact_id', contactId).order('recorded_on', { ascending: true }).limit(1),
    sb.from('food_log').select('log_date', { count: 'exact', head: true }).eq('contact_id', contactId),
  ]);
  const weights = (((wRows ?? []) as { recorded_on: string; weight_kg: number }[]).map((w) => ({ on: w.recorded_on, kg: Number(w.weight_kg) }))).reverse();
  const nnn = (v: number | string | null): number | null => (v == null ? null : Number(v));
  const measures = (((mRows ?? []) as { recorded_on: string; waist_cm: number | null; hips_cm: number | null; chest_cm: number | null; arms_cm: number | null; thighs_cm: number | null }[]).map((m) => ({
    on: m.recorded_on, waist: nnn(m.waist_cm), hips: nnn(m.hips_cm), chest: nnn(m.chest_cm), arms: nnn(m.arms_cm), thighs: nnn(m.thighs_cm),
  }))).reverse();
  const weightStartKg = nnn((((wFirst ?? []) as { weight_kg: number }[])[0]?.weight_kg) ?? null);
  // Sign each migrated photo (private bucket) for a short-lived coach view.
  const photoRaw = (pRows ?? []) as { storage_path: string; taken_on: string; pose_source: string | null }[];
  const signed = await Promise.all(
    photoRaw.map(async (p) => {
      const { data: s } = await sb.storage.from('progress-photos').createSignedUrl(p.storage_path, 3600);
      return s?.signedUrl ? { url: s.signedUrl, on: p.taken_on, pose: p.pose_source } : null;
    }),
  );
  const photos = signed.filter((p): p is { url: string; on: string; pose: string | null } => p != null);

  // Migrated Lenus workout history (session summaries): total + the most recent handful.
  const [{ count: workoutCount }, { data: woRows }] = await Promise.all([
    sb.from('client_workout_history').select('id', { count: 'exact', head: true }).eq('contact_id', contactId),
    sb.from('client_workout_history').select('performed_at, session_name, plan_name, completion_pct').eq('contact_id', contactId).order('performed_at', { ascending: false }).limit(8),
  ]);
  const recentWorkouts = ((woRows ?? []) as { performed_at: string; session_name: string | null; plan_name: string | null; completion_pct: number | null }[]).map((w) => ({
    on: w.performed_at, name: w.session_name, plan: w.plan_name, pct: w.completion_pct,
  }));

  const progress = {
    weights, weightCount: weightCount ?? weights.length, weightStartKg,
    measures, measureCount: measureCount ?? measures.length,
    photos, photoCount: photoCount ?? photos.length,
    foodDays: foodDays ?? 0,
    workoutCount: workoutCount ?? recentWorkouts.length,
    recentWorkouts,
  };

  // Migrated conversation history: most recent 200 messages + full count.
  const { count: totalMessages } = await sb
    .from('client_messages')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', contactId);
  const { data: msgRows } = await sb
    .from('client_messages')
    .select('id, is_from_coach, sender_name, body, msg_type, sent_at, attachments')
    .eq('contact_id', contactId)
    .order('sent_at', { ascending: false })
    .limit(200);
  type MsgRaw = { id: string; is_from_coach: boolean; sender_name: string | null; body: string | null; msg_type: string | null; sent_at: string; attachments: { name: string | null; kind: string | null; storage_path: string | null }[] | null };
  const messages = await Promise.all(
    ((msgRows ?? []) as MsgRaw[]).map(async (m) => {
      const atts = await Promise.all(
        (m.attachments ?? []).filter((a) => a.storage_path).map(async (a) => {
          const { data: s } = await sb.storage.from('chat-attachments').createSignedUrl(a.storage_path as string, 3600);
          return s?.signedUrl ? { url: s.signedUrl, name: a.name, kind: a.kind } : null;
        }),
      );
      return {
        id: m.id,
        isFromCoach: m.is_from_coach,
        senderName: m.sender_name,
        body: m.body,
        type: m.msg_type,
        sentAt: m.sent_at,
        attachments: atts.filter((a): a is { url: string; name: string | null; kind: string | null } => a != null),
        attachmentCount: (m.attachments ?? []).length,
      };
    }),
  );

  const t = await getTranslations('app.coach');
  const name = [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim() || raw.email || t('noName');
  // Same join-date fallback as the list: app members date from contact creation, legacy stays null.
  const startedAt = sub?.started_at ?? (raw.is_legacy ? null : raw.created_at);
  const tenureDays = startedAt
    ? Math.max(0, Math.round((Date.parse(sub?.ended_at ?? new Date().toISOString()) - Date.parse(startedAt)) / 86400000))
    : null;

  return {
    id: raw.id,
    name,
    initials: initialsOf(raw.first_name, raw.last_name, name),
    email: raw.email,
    phone: raw.phone,
    language: raw.language,
    owner: raw.owner,
    source: raw.source,
    legacySource: raw.legacy_source,
    lenusId: raw.lenus_id,
    isLegacy: raw.is_legacy ?? false,
    wasLead: raw.was_lead ?? false,
    status: sub?.status ?? null,
    billingHealth: sub?.billing_health ?? null,
    standing: deriveStanding(sub?.status ?? null, sub?.billing_health ?? null),
    productType: sub?.product_type ?? raw.product_type ?? null,
    priceCents: sub?.grandfathered_price_cents ?? null,
    nextAmountCents: sub?.next_amount_cents ?? null,
    lifetimeCents: sub?.lifetime_paid_cents ?? (txns.length && !ledgerTruncated ? ledgerTotalCents : null),
    currency: sub?.currency ?? 'USD',
    isAutoRenew: sub?.is_auto_renew ?? null,
    startedAt,
    endedAt: sub?.ended_at ?? null,
    nextBillingDate: sub?.next_billing_date ?? null,
    lastChargeDate: sub?.last_charge_date ?? null,
    numCharges: sub?.num_charges ?? null,
    daysSinceLastCharge: sub?.days_since_last_charge ?? null,
    mealPlanSentAt: sub?.meal_plan_sent_at ?? null,
    workoutPlanSentAt: sub?.workout_plan_sent_at ?? null,
    tenureDays,
    createdAt: raw.created_at,
    tags,
    mealPlan,
    snapshot: snap
      ? {
          mealPlans: snap.meal_plans,
          measurements: snap.measurements_logged,
          checkins: snap.checkins,
          workouts: snap.workouts_completed,
          messages: snap.messages_in_window,
          healthAssessment: snap.health_assessment,
          weightGoal: snap.weight_goal,
          goalIntensity: snap.goal_intensity,
        }
      : null,
    ledger,
    ledgerTruncated,
    files,
    intake,
    progress,
    messages,
    totalMessages: totalMessages ?? 0,
    hasAccount: raw.profile_id != null,
  };
}
