// Clients CRM server data layer. One read of the client contacts, then filter / sort / paginate /
// facet-count in memory (256 rows). company_id is pinned by the caller from requireCoach ctx,
// never from searchParams. Transaction totals come from denormalized lifetime_paid_cents, never an
// unscoped txn select. Pure types + constants live in clients-types.ts (client-safe); re-exported.
import 'server-only';
import { getTranslations } from 'next-intl/server';
import { createServiceClient } from '@/lib/supabase/service';
import { deriveStanding } from '@/lib/coach/standing';
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
  created_at: string;
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
  const startedAt = sub?.started_at ?? null;
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
  };
}

async function loadClientRows(companyId: string): Promise<{ rows: ClientRow[]; truncated: boolean }> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('contacts')
    .select(
      'id, first_name, last_name, email, phone, language, owner, is_legacy, was_lead, product_type, created_at, ' +
        'client_subscriptions(status, billing_health, product_type, grandfathered_price_cents, currency, next_billing_date, lifetime_paid_cents, started_at), ' +
        'contact_tags(tag:tags(slug, label, category, color))',
    )
    .eq('company_id', companyId)
    .eq('type', 'client')
    .limit(CLIENT_ROWS_CAP);
  if (error) throw new Error(`loadClientRows: ${error.message}`);
  const t = await getTranslations('app.coach');
  const noName = t('noName');
  const raw = (data ?? []) as unknown as ContactRowRaw[];
  // If we read exactly the cap, the list is windowed: totals/facets are a partial view, so flag it.
  return { rows: raw.map((c) => mapRow(c, noName)), truncated: raw.length >= CLIENT_ROWS_CAP };
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
    client_subscriptions: FullSub | FullSub[] | null;
    legacy_client_snapshot: Snap | Snap[] | null;
    contact_tags: TagJoinRaw[] | null;
  };
  const raw = c as unknown as DetailRaw;
  const sub = one(raw.client_subscriptions);
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

  // Migrated-from-Lenus intake/health profile + progress history (keyed to this contact only).
  const { data: intakeRow } = await sb
    .from('client_intake')
    .select('sex, birth_date, height_cm, starting_weight_kg, goal_type, target_weight_kg, bmr, calorie_goal_kcal, injuries, injuries_description, medical_conditions, dietary_exclusions, training_experience, bad_habits, questionnaire_filled_at')
    .eq('company_id', companyId)
    .eq('contact_id', contactId)
    .maybeSingle();
  type IntakeRaw = {
    sex: string | null; birth_date: string | null; height_cm: number | null; starting_weight_kg: number | null;
    goal_type: string | null; target_weight_kg: number | null; bmr: number | null; calorie_goal_kcal: number | null;
    injuries: string[] | null; injuries_description: string | null; medical_conditions: string | null;
    dietary_exclusions: string[] | null; training_experience: string | null; bad_habits: string | null; questionnaire_filled_at: string | null;
  };
  const ir = intakeRow as IntakeRaw | null;
  const intake = ir
    ? {
        sex: ir.sex, birthDate: ir.birth_date, heightCm: ir.height_cm, startingWeightKg: ir.starting_weight_kg,
        goalType: ir.goal_type, targetWeightKg: ir.target_weight_kg, bmr: ir.bmr, calorieGoalKcal: ir.calorie_goal_kcal,
        injuries: ir.injuries, injuriesDescription: ir.injuries_description, medicalConditions: ir.medical_conditions,
        dietaryExclusions: ir.dietary_exclusions, trainingExperience: ir.training_experience, badHabits: ir.bad_habits,
        questionnaireFilledAt: ir.questionnaire_filled_at,
      }
    : null;

  const [{ data: wRows }, { data: mRows }, { data: pRows }, { count: foodDays }] = await Promise.all([
    sb.from('weight_entries').select('recorded_on, weight_kg').eq('contact_id', contactId).order('recorded_on', { ascending: true }).limit(120),
    sb.from('body_measurements').select('recorded_on, waist_cm, hips_cm, chest_cm, arms_cm, thighs_cm').eq('contact_id', contactId).order('recorded_on', { ascending: true }).limit(120),
    sb.from('progress_photos').select('storage_path, taken_on, pose_source').eq('contact_id', contactId).order('taken_on', { ascending: false }).limit(24),
    sb.from('food_log').select('log_date', { count: 'exact', head: true }).eq('contact_id', contactId),
  ]);
  const weights = ((wRows ?? []) as { recorded_on: string; weight_kg: number }[]).map((w) => ({ on: w.recorded_on, kg: Number(w.weight_kg) }));
  const measures = ((mRows ?? []) as { recorded_on: string; waist_cm: number | null; hips_cm: number | null; chest_cm: number | null; arms_cm: number | null; thighs_cm: number | null }[]).map((m) => ({
    on: m.recorded_on, waist: m.waist_cm, hips: m.hips_cm, chest: m.chest_cm, arms: m.arms_cm, thighs: m.thighs_cm,
  }));
  // Sign each migrated photo (private bucket) for a short-lived coach view.
  const photoRaw = (pRows ?? []) as { storage_path: string; taken_on: string; pose_source: string | null }[];
  const signed = await Promise.all(
    photoRaw.map(async (p) => {
      const { data: s } = await sb.storage.from('progress-photos').createSignedUrl(p.storage_path, 3600);
      return s?.signedUrl ? { url: s.signedUrl, on: p.taken_on, pose: p.pose_source } : null;
    }),
  );
  const photos = signed.filter((p): p is { url: string; on: string; pose: string | null } => p != null);
  const progress = { weights, measures, photos, foodDays: foodDays ?? 0 };

  const t = await getTranslations('app.coach');
  const name = [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim() || raw.email || t('noName');
  const startedAt = sub?.started_at ?? null;
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
  };
}
