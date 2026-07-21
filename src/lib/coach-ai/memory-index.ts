// Member-memory ingestion (phase 2). SERVER-ONLY.
// Reconciles every per-member data source into member_memory: builds a natural-language summary of
// each record and indexes it (embed + upsert). Idempotent and cap-bounded: it loads what is already
// indexed for the member and only embeds what is new, so running it repeatedly (nightly cron, or a
// wide backfill sweep) is safe and cheap. Key-gated end to end via indexMemory.
//
// Covers: food_day (daily meal totals, flags photo scans), meal_plan, checkin (form responses),
// weight (rolling fact), intake (health-profile fact), coach_note, physique analysis, measurement
// (rolling fact). Each source degrades independently; one failing source never blocks the others.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { indexMemory, type MemorySource } from '@/lib/coach-ai/memory-store';

type Svc = ReturnType<typeof createServiceClient>;

export type IndexTarget = {
  companyId: string;
  profileId: string | null;
  contactId: string | null;
};

export type IndexResult = { indexed: number; bySource: Record<string, number> };

const KG_TO_LB = 2.20462;
const DEFAULT_SINCE_DAYS = 45; // reconcile window for the recurring job; backfill passes a big number.
const PER_SOURCE_CAP = 60; // rows embedded per source per member per run (cost + latency guard).

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

// The member's stable memory key prefix, preferring profile then contact, for rolling/aggregate rows.
function memberKey(t: IndexTarget): string {
  return t.profileId ?? t.contactId ?? 'unknown';
}

// One filter helper: a source row belongs to this member by profile OR contact.
function memberOr(t: IndexTarget): string {
  const parts: string[] = [];
  if (t.profileId) parts.push(`profile_id.eq.${t.profileId}`);
  if (t.contactId) parts.push(`contact_id.eq.${t.contactId}`);
  return parts.join(',');
}

// Load the set of "source:source_id" already indexed for this member, so we never re-embed.
async function loadIndexed(svc: Svc, t: IndexTarget): Promise<Set<string>> {
  const or = memberOr(t);
  if (!or) return new Set();
  const { data } = await svc
    .from('member_memory')
    .select('source, source_id')
    .eq('company_id', t.companyId)
    .or(or)
    .limit(5000);
  const set = new Set<string>();
  for (const r of (data ?? []) as { source: string; source_id: string }[]) set.add(`${r.source}:${r.source_id}`);
  return set;
}

type Candidate = { source: MemorySource; sourceId: string; content: string; occurredAt: string; kind?: 'episodic' | 'fact' | 'summary' };

// --- Per-source candidate builders (each returns rows to index; empty on no data / no key) --------

async function foodDays(svc: Svc, t: IndexTarget, since: string): Promise<Candidate[]> {
  const or = memberOr(t);
  if (!or) return [];
  const { data } = await svc
    .from('food_log')
    .select('log_date, kcal, protein_g, carb_g, fat_g, source, name')
    .eq('company_id', t.companyId)
    .or(or)
    .gte('log_date', since)
    .limit(4000);
  const rows = (data ?? []) as { log_date: string; kcal: number; protein_g: number; carb_g: number; fat_g: number; source: string | null; name: string | null }[];
  const byDay = new Map<string, { kcal: number; p: number; c: number; f: number; n: number; photo: boolean; foods: string[] }>();
  for (const r of rows) {
    const cur = byDay.get(r.log_date) ?? { kcal: 0, p: 0, c: 0, f: 0, n: 0, photo: false, foods: [] };
    cur.kcal += num(r.kcal); cur.p += num(r.protein_g); cur.c += num(r.carb_g); cur.f += num(r.fat_g); cur.n += 1;
    if (r.source === 'photo') cur.photo = true;
    if (r.name && cur.foods.length < 8) cur.foods.push(r.name);
    byDay.set(r.log_date, cur);
  }
  const key = memberKey(t);
  return [...byDay.entries()].map(([date, d]) => ({
    source: 'food_day' as const,
    sourceId: `${key}:${date}`,
    occurredAt: `${date}T12:00:00Z`,
    content: `On ${date} she logged ${d.n} item(s)${d.photo ? ' (some from a food photo)' : ''}: ${Math.round(d.kcal)} kcal, ${Math.round(d.p)}g protein, ${Math.round(d.c)}g carbs, ${Math.round(d.f)}g fat. Foods: ${d.foods.join(', ') || 'n/a'}.`,
  }));
}

async function mealPlans(svc: Svc, t: IndexTarget): Promise<Candidate[]> {
  if (!t.contactId) return [];
  const { data } = await svc
    .from('meal_plans')
    .select('id, name, calorie_goal, protein_g, carb_g, fat_g, updated_at')
    .eq('company_id', t.companyId)
    .eq('contact_id', t.contactId)
    .eq('is_template', false)
    .limit(20);
  return ((data ?? []) as { id: string; name: string | null; calorie_goal: number | null; protein_g: number | null; carb_g: number | null; fat_g: number | null; updated_at: string }[]).map((p) => ({
    source: 'meal_plan' as const,
    sourceId: p.id,
    occurredAt: p.updated_at,
    kind: 'fact' as const,
    content: `Her meal plan "${p.name ?? 'plan'}": ${num(p.calorie_goal)} kcal target, ${num(p.protein_g)}g protein, ${num(p.carb_g)}g carbs, ${num(p.fat_g)}g fat.`,
  }));
}

async function checkins(svc: Svc, t: IndexTarget, since: string): Promise<Candidate[]> {
  if (!t.profileId) return [];
  const { data } = await svc
    .from('form_responses')
    .select('id, answers, submitted_at')
    .eq('company_id', t.companyId)
    .eq('profile_id', t.profileId)
    .gte('submitted_at', `${since}T00:00:00Z`)
    .limit(PER_SOURCE_CAP);
  return ((data ?? []) as { id: string; answers: Record<string, unknown> | null; submitted_at: string }[]).map((r) => {
    const pairs = Object.entries(r.answers ?? {})
      .filter(([, v]) => v != null && v !== '')
      .slice(0, 12)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('/') : String(v)}`)
      .join('; ');
    return {
      source: 'checkin' as const,
      sourceId: r.id,
      occurredAt: r.submitted_at,
      content: `Check-in on ${(r.submitted_at ?? '').slice(0, 10)} - ${pairs || 'submitted'}.`,
    };
  });
}

async function coachNotes(svc: Svc, t: IndexTarget): Promise<Candidate[]> {
  const ids: string[] = [];
  if (t.profileId) ids.push(t.profileId);
  if (t.contactId) ids.push(t.contactId);
  if (!ids.length) return [];
  const { data } = await svc
    .from('coach_notes')
    .select('id, body, created_at')
    .eq('company_id', t.companyId)
    .in('subject_id', ids)
    .is('deleted_at', null)
    .limit(PER_SOURCE_CAP);
  return ((data ?? []) as { id: string; body: string | null; created_at: string }[])
    .filter((n) => (n.body ?? '').trim())
    .map((n) => ({ source: 'coach_note' as const, sourceId: n.id, occurredAt: n.created_at, content: `Coach note: ${n.body}` }));
}

async function physiques(svc: Svc, t: IndexTarget): Promise<Candidate[]> {
  if (!t.profileId) return [];
  const { data } = await svc
    .from('physique_analyses')
    .select('id, bf_low, bf_high, weight_lb, narrative, created_at')
    .eq('company_id', t.companyId)
    .eq('profile_id', t.profileId)
    .is('deleted_at', null)
    .limit(PER_SOURCE_CAP);
  return ((data ?? []) as { id: string; bf_low: number | null; bf_high: number | null; weight_lb: number | null; narrative: string | null; created_at: string }[]).map((a) => ({
    source: 'physique' as const,
    sourceId: a.id,
    occurredAt: a.created_at,
    content: `Progress photo analysis (${(a.created_at ?? '').slice(0, 10)}): body fat ~${num(a.bf_low)}-${num(a.bf_high)}%, ${num(a.weight_lb)} lb. ${a.narrative ?? ''}`.trim(),
  }));
}

async function weightFact(svc: Svc, t: IndexTarget): Promise<Candidate[]> {
  if (!t.profileId) return [];
  const { data } = await svc
    .from('weight_entries')
    .select('recorded_on, weight_kg')
    .eq('company_id', t.companyId)
    .eq('profile_id', t.profileId)
    .order('recorded_on', { ascending: false })
    .limit(30);
  const rows = (data ?? []) as { recorded_on: string; weight_kg: number }[];
  if (!rows.length) return [];
  const latest = rows[0];
  const oldest = rows[rows.length - 1];
  const lb = Math.round(num(latest.weight_kg) * KG_TO_LB * 10) / 10;
  const trend = rows.length > 1 ? Math.round((num(latest.weight_kg) - num(oldest.weight_kg)) * KG_TO_LB * 10) / 10 : 0;
  // Rolling fact: one row per member, updated in place (occurred_at moves forward), so recall always
  // sees her current weight instead of a pile of daily rows.
  return [{
    source: 'weight' as const,
    sourceId: `${memberKey(t)}:weight-latest`,
    occurredAt: `${latest.recorded_on}T12:00:00Z`,
    kind: 'fact' as const,
    content: `Latest weight ${lb} lb on ${latest.recorded_on}${rows.length > 1 ? `, ${trend >= 0 ? '+' : ''}${trend} lb over the last ${rows.length} weigh-ins` : ''}.`,
  }];
}

async function measurementFact(svc: Svc, t: IndexTarget): Promise<Candidate[]> {
  if (!t.profileId) return [];
  const { data } = await svc
    .from('body_measurements')
    .select('recorded_on, waist_cm, hips_cm, chest_cm, arms_cm, thighs_cm, body_fat_pct')
    .eq('company_id', t.companyId)
    .eq('profile_id', t.profileId)
    .order('recorded_on', { ascending: false })
    .limit(1)
    .maybeSingle();
  const m = data as { recorded_on: string; waist_cm: number | null; hips_cm: number | null; chest_cm: number | null; arms_cm: number | null; thighs_cm: number | null; body_fat_pct: number | null } | null;
  if (!m) return [];
  const parts = [
    m.waist_cm != null ? `waist ${num(m.waist_cm)}cm` : '',
    m.hips_cm != null ? `hips ${num(m.hips_cm)}cm` : '',
    m.chest_cm != null ? `chest ${num(m.chest_cm)}cm` : '',
    m.arms_cm != null ? `arms ${num(m.arms_cm)}cm` : '',
    m.thighs_cm != null ? `thighs ${num(m.thighs_cm)}cm` : '',
    m.body_fat_pct != null ? `body fat ${num(m.body_fat_pct)}%` : '',
  ].filter(Boolean).join(', ');
  if (!parts) return [];
  return [{
    source: 'measurement' as const,
    sourceId: `${memberKey(t)}:measure-latest`,
    occurredAt: `${m.recorded_on}T12:00:00Z`,
    kind: 'fact' as const,
    content: `Latest measurements (${m.recorded_on}): ${parts}.`,
  }];
}

// Reconcile one member's sources into member_memory. Returns how many rows were newly embedded.
export async function indexMemberSources(t: IndexTarget, sinceDays = DEFAULT_SINCE_DAYS): Promise<IndexResult> {
  const svc = createServiceClient();
  const since = isoDaysAgo(sinceDays);
  const already = await loadIndexed(svc, t);

  const builders: (() => Promise<Candidate[]>)[] = [
    () => foodDays(svc, t, since),
    () => mealPlans(svc, t),
    () => checkins(svc, t, since),
    () => coachNotes(svc, t),
    () => physiques(svc, t),
    () => weightFact(svc, t),
    () => measurementFact(svc, t),
  ];

  const bySource: Record<string, number> = {};
  let indexed = 0;
  for (const build of builders) {
    let candidates: Candidate[] = [];
    try {
      candidates = await build();
    } catch (e) {
      console.error('indexMemberSources build:', e instanceof Error ? e.message : e);
      continue;
    }
    let done = 0;
    for (const c of candidates) {
      if (done >= PER_SOURCE_CAP) break;
      // Rolling facts (weight/measurement) always re-index so they stay current; episodic rows skip
      // if already embedded.
      const isRolling = c.kind === 'fact' && c.sourceId.includes(':');
      if (!isRolling && already.has(`${c.source}:${c.sourceId}`)) continue;
      const ok = await indexMemory({
        companyId: t.companyId,
        profileId: t.profileId,
        contactId: t.contactId,
        source: c.source,
        sourceId: c.sourceId,
        content: c.content,
        kind: c.kind,
        occurredAt: c.occurredAt,
      });
      if (ok) { indexed += 1; done += 1; bySource[c.source] = (bySource[c.source] ?? 0) + 1; }
    }
  }
  return { indexed, bySource };
}

export type BatchResult = { ok: boolean; members: number; indexed: number };

// Run the indexer across members. scope 'active' = app subscribers (the recurring cron); scope 'all'
// = every profile PLUS unclaimed migrated contacts (the historical backfill). Each profile target is
// paired with its linked CRM contact so claimed clients reach BOTH their app data (profile-keyed) and
// their Lenus history (contact-keyed). Cheap + idempotent, so re-runs only embed genuinely new rows.
export async function runMemoryIndex(opts: {
  scope: 'active' | 'all';
  sinceDays?: number;
  maxMembers?: number;
}): Promise<BatchResult> {
  const svc = createServiceClient();
  const cap = opts.maxMembers ?? 5000;

  let pq = svc.from('profiles').select('id, company_id, role');
  if (opts.scope === 'active') pq = pq.eq('role', 'subscriber');
  const { data: profs } = await pq.limit(cap);
  const profiles = (profs ?? []) as { id: string; company_id: string }[];

  // Resolve each profile's linked contact in one batched read.
  const profileIds = profiles.map((p) => p.id);
  const profileToContact = new Map<string, string>();
  if (profileIds.length) {
    const { data: linked } = await svc.from('contacts').select('id, profile_id').in('profile_id', profileIds);
    for (const c of (linked ?? []) as { id: string; profile_id: string }[]) profileToContact.set(c.profile_id, c.id);
  }

  const targets: IndexTarget[] = profiles.map((p) => ({
    companyId: p.company_id,
    profileId: p.id,
    contactId: profileToContact.get(p.id) ?? null,
  }));

  // Backfill also sweeps unclaimed migrated contacts (their data is contact-keyed, no profile yet).
  if (opts.scope === 'all') {
    const { data: contacts } = await svc
      .from('contacts')
      .select('id, company_id')
      .is('profile_id', null)
      .eq('is_legacy', true)
      .limit(cap);
    for (const c of (contacts ?? []) as { id: string; company_id: string }[]) {
      targets.push({ companyId: c.company_id, profileId: null, contactId: c.id });
    }
  }

  let indexed = 0;
  for (const t of targets) {
    try {
      const r = await indexMemberSources(t, opts.sinceDays);
      indexed += r.indexed;
    } catch (e) {
      console.error('runMemoryIndex member:', e instanceof Error ? e.message : e);
    }
  }
  return { ok: true, members: targets.length, indexed };
}
