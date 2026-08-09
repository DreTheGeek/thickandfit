// Learning ingestion. SERVER-ONLY. Two phases, one job, one embedding path.
//
// PHASE 1, per member -> member_memory. Reconciles every per-member data source: builds a
// natural-language summary of each record and indexes it (embed + upsert). Idempotent and
// cap-bounded: it loads what is already indexed for the member and only embeds what is new, so
// running it repeatedly (the 6h cron, or a wide backfill sweep) is safe and cheap.
//
// Covers: food_day (daily meal totals, flags photo scans), meal_plan, checkin (form responses),
// weight (rolling fact), intake (health-profile fact), coach_note, physique analysis, measurement
// (rolling fact), workout (training days), message (coaching conversation days). Each source
// degrades independently; one failing source never blocks the others.
//
// PHASE 2, per company -> coach_knowledge. Reconciles the SHARED corpus that is not about one
// member: Stephanie's per-movement coaching cues today, her protocol next. Same embed function,
// same key-gating, so there is exactly one embedding path in the system.
//
// Why both live in one module and one cron: the corpus and the member sweep answer the same
// question ("what is new since the last run"), share the reconcile-then-embed shape, and must not
// be able to drift apart in cadence. The single caller is /api/internal/index-memory, driven by
// the pg_cron job tf-index-memory-6h.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { indexMemory, type MemorySource } from '@/lib/coach-ai/memory-store';
import { embedText, toVectorLiteral } from '@/lib/coach-ai/embeddings';
import { sharedCatalogScope } from '@/lib/tenant/shared-catalog';

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

// Corpus phase budget. 365 cue documents at ~250ms an embed is ~90s serial, which does not fit
// beside the member sweep inside the route's 300s maxDuration. Bounded concurrency plus a hard cap
// keeps one run short; the reconcile is resumable, so a cold start simply converges over a few runs
// rather than timing out halfway and losing the work.
const CORPUS_EMBED_CAP = 200;
const CORPUS_CONCURRENCY = 4;

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
    .select('id, form_id, answers, submitted_at')
    .eq('company_id', t.companyId)
    .eq('profile_id', t.profileId)
    .gte('submitted_at', `${since}T00:00:00Z`)
    .limit(PER_SOURCE_CAP);
  const rows = (data ?? []) as { id: string; form_id: string; answers: Record<string, unknown> | null; submitted_at: string }[];
  if (!rows.length) return [];
  // Resolve field ids -> question labels so the memory reads by question ("How was your week?: ...")
  // instead of by raw field UUID. The answer values are already rich free text + numbers.
  const formIds = [...new Set(rows.map((r) => r.form_id).filter(Boolean))];
  const labels = new Map<string, string>();
  if (formIds.length) {
    const { data: fields } = await svc.from('form_fields').select('id, label_en').in('form_id', formIds);
    for (const f of (fields ?? []) as { id: string; label_en: string | null }[]) if (f.label_en) labels.set(f.id, f.label_en);
  }
  return rows.map((r) => {
    const pairs = Object.entries(r.answers ?? {})
      .filter(([, v]) => v != null && v !== '')
      .slice(0, 12)
      .map(([k, v]) => `${labels.get(k) ?? 'note'}: ${Array.isArray(v) ? v.join('/') : String(v)}`)
      .join('; ');
    return {
      source: 'checkin' as const,
      sourceId: r.id,
      occurredAt: r.submitted_at,
      content: `Check-in on ${(r.submitted_at ?? '').slice(0, 10)}: ${pairs || 'submitted'}.`,
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

// Her health profile as ONE rolling fact. 'intake' was already in the MemorySource union and this
// file's header claimed it was covered, but no builder existed, so 267 intake rows (goal, target
// weight, calorie target, injuries, conditions, exclusions, allergies, experience, equipment, her
// stated why) were never recallable. That is the single most load-bearing thing the coach can know
// about a member and it was the one thing missing.
//
// Rolling rather than episodic on purpose: an intake is edited in place as she updates her profile,
// so a second row would leave the coach recalling a stale goal next to the current one.
function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const then = Date.parse(`${birthDate.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(then)) return null;
  const years = Math.floor((Date.now() - then) / (365.2425 * 24 * 3600 * 1000));
  return years > 0 && years < 120 ? years : null;
}

const GOAL_LABEL: Record<string, string> = {
  deficit: 'fat loss',
  maintenance: 'maintenance',
  surplus: 'muscle gain',
};

type IntakeRow = {
  id: string;
  sex: string | null;
  birth_date: string | null;
  height_cm: number | null;
  starting_weight_kg: number | null;
  goal_type: string | null;
  target_weight_kg: number | null;
  calorie_goal_kcal: number | null;
  tdee: number | null;
  injuries: string[] | null;
  injuries_description: string | null;
  medical_conditions: string | null;
  dietary_exclusions: string[] | null;
  allergies: string | null;
  training_experience: string | null;
  activity_level: string | null;
  sessions_per_week: number | null;
  equipment: string[] | null;
  client_why: string | null;
  updated_at: string;
};

async function intakeFact(svc: Svc, t: IndexTarget): Promise<Candidate[]> {
  const or = memberOr(t);
  if (!or) return [];
  const { data } = await svc
    .from('client_intake')
    .select(
      'id, sex, birth_date, height_cm, starting_weight_kg, goal_type, target_weight_kg, calorie_goal_kcal, tdee, injuries, injuries_description, medical_conditions, dietary_exclusions, allergies, training_experience, activity_level, sessions_per_week, equipment, client_why, updated_at',
    )
    .eq('company_id', t.companyId)
    .or(or)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const r = data as IntakeRow | null;
  if (!r) return [];

  const age = ageFrom(r.birth_date);
  const list = (v: string[] | null): string => (v ?? []).map((s) => s.trim()).filter(Boolean).join(', ');
  const parts: string[] = [];
  const who = [age ? `${age} years old` : '', r.sex ?? '', r.height_cm != null ? `${num(r.height_cm)}cm tall` : '']
    .filter(Boolean)
    .join(', ');
  if (who) parts.push(who);
  if (r.starting_weight_kg != null) {
    parts.push(`started at ${Math.round(num(r.starting_weight_kg) * KG_TO_LB * 10) / 10} lb`);
  }
  if (r.goal_type) {
    const goal = GOAL_LABEL[r.goal_type] ?? r.goal_type;
    const target = r.target_weight_kg != null ? ` toward ${Math.round(num(r.target_weight_kg) * KG_TO_LB * 10) / 10} lb` : '';
    parts.push(`goal is ${goal}${target}`);
  }
  if (r.calorie_goal_kcal != null) parts.push(`${Math.round(num(r.calorie_goal_kcal))} kcal target`);
  if (r.tdee != null) parts.push(`TDEE about ${Math.round(num(r.tdee))} kcal`);
  if (r.training_experience) parts.push(`training experience ${r.training_experience}`);
  if (r.activity_level) parts.push(`activity level ${r.activity_level}`);
  if (r.sessions_per_week != null) parts.push(`trains ${r.sessions_per_week}x a week`);
  if (list(r.equipment)) parts.push(`equipment: ${list(r.equipment)}`);

  // Safety-critical fields get their own sentences so a truncating reader keeps them intact.
  const safety: string[] = [];
  const injuries = [list(r.injuries), (r.injuries_description ?? '').trim()].filter(Boolean).join('. ');
  if (injuries) safety.push(`Injuries: ${injuries}.`);
  if ((r.medical_conditions ?? '').trim()) safety.push(`Medical conditions: ${r.medical_conditions?.trim()}.`);
  if (list(r.dietary_exclusions)) safety.push(`Does not eat: ${list(r.dietary_exclusions)}.`);
  if ((r.allergies ?? '').trim()) safety.push(`Allergies: ${r.allergies?.trim()}.`);

  const why = (r.client_why ?? '').trim();
  const content = [
    parts.length ? `Health profile: ${parts.join(', ')}.` : '',
    ...safety,
    why ? `In her words, why she is doing this: ${why}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  if (!content) return [];

  return [{
    source: 'intake' as const,
    sourceId: `${memberKey(t)}:intake`,
    occurredAt: r.updated_at,
    kind: 'fact' as const,
    content,
  }];
}

// Training days from client_workout_history (4,182 rows migrated from Lenus: what she was actually
// programmed and how it landed). Aggregated per day like foodDays rather than one row per session,
// because two sessions on one day are one training day to the member and to the coach.
async function workoutDays(svc: Svc, t: IndexTarget, since: string): Promise<Candidate[]> {
  const or = memberOr(t);
  if (!or) return [];
  const { data } = await svc
    .from('client_workout_history')
    .select('session_name, plan_name, completion_pct, enjoyment, exhaustion, performed_at')
    .eq('company_id', t.companyId)
    .or(or)
    .gte('performed_at', `${since}T00:00:00Z`)
    .limit(2000);
  const rows = (data ?? []) as {
    session_name: string | null;
    plan_name: string | null;
    completion_pct: number | null;
    enjoyment: number | null;
    exhaustion: number | null;
    performed_at: string | null;
  }[];
  const byDay = new Map<string, string[]>();
  for (const r of rows) {
    const day = (r.performed_at ?? '').slice(0, 10);
    if (!day) continue;
    const bits = [
      `"${(r.session_name ?? 'session').trim()}"`,
      r.plan_name ? `from ${r.plan_name.trim()}` : '',
      r.completion_pct != null ? `${Math.round(num(r.completion_pct))}% complete` : '',
      r.enjoyment != null ? `enjoyment ${Math.round(num(r.enjoyment))}/5` : '',
      r.exhaustion != null ? `exhaustion ${Math.round(num(r.exhaustion))}/5` : '',
    ].filter(Boolean);
    const cur = byDay.get(day) ?? [];
    if (cur.length < 4) cur.push(bits.join(', '));
    byDay.set(day, cur);
  }
  const key = memberKey(t);
  return [...byDay.entries()].map(([day, sessions]) => ({
    source: 'workout' as const,
    sourceId: `${key}:workout:${day}`,
    occurredAt: `${day}T12:00:00Z`,
    content: `Trained on ${day}: ${sessions.join('; ')}.`,
  }));
}

// Coaching conversation days from client_messages (12,027 migrated Lenus messages across 141
// clients, 6,087 of them Stephanie's own replies). This is the richest per-member record in the
// system and none of it was recallable.
//
// One memory per conversation DAY, not per message: a single "ok!" embeds to nothing useful, and
// 12k rows would swamp the reranker's pool with fragments. A day of back-and-forth is the unit that
// actually carries a decision ("she asked about the cheat meal, Stephanie said swap it, not skip").
// Automated blasts are excluded so the corpus stays real conversation.
const AUTOMATED_MSG_TYPES = ['measurementReminder', 'broadcast', 'newOffer', 'lessonLink'];
const MSG_SNIPPET_CHARS = 220;
const MSG_DAY_CHARS = 1200;

async function messageDays(svc: Svc, t: IndexTarget, since: string): Promise<Candidate[]> {
  const or = memberOr(t);
  if (!or) return [];
  const { data } = await svc
    .from('client_messages')
    .select('body, is_from_coach, sender_name, sent_at, msg_type')
    .eq('company_id', t.companyId)
    .or(or)
    .gte('sent_at', `${since}T00:00:00Z`)
    .not('msg_type', 'in', `(${AUTOMATED_MSG_TYPES.join(',')})`)
    .order('sent_at', { ascending: true })
    .limit(4000);
  const rows = (data ?? []) as {
    body: string | null;
    is_from_coach: boolean | null;
    sender_name: string | null;
    sent_at: string | null;
  }[];

  const byDay = new Map<string, { lines: string[]; n: number }>();
  for (const r of rows) {
    const day = (r.sent_at ?? '').slice(0, 10);
    const body = (r.body ?? '').replace(/\s+/g, ' ').trim();
    if (!day || !body) continue;
    const cur = byDay.get(day) ?? { lines: [], n: 0 };
    cur.n += 1;
    const speaker = r.is_from_coach ? 'Stephanie' : 'She';
    const snip = body.length > MSG_SNIPPET_CHARS ? `${body.slice(0, MSG_SNIPPET_CHARS - 3)}...` : body;
    const joined = cur.lines.join(' ');
    if (joined.length + snip.length < MSG_DAY_CHARS) cur.lines.push(`${speaker}: "${snip}"`);
    byDay.set(day, cur);
  }

  const key = memberKey(t);
  return [...byDay.entries()]
    .filter(([, d]) => d.lines.length > 0)
    .map(([day, d]) => ({
      source: 'message' as const,
      sourceId: `${key}:convo:${day}`,
      occurredAt: `${day}T12:00:00Z`,
      content: `Coaching conversation on ${day} (${d.n} message(s)). ${d.lines.join(' ')}`,
    }));
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
    () => intakeFact(svc, t),
    () => workoutDays(svc, t, since),
    () => messageDays(svc, t, since),
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

// =====================================================================================
// PHASE 2: the shared corpus (coach_knowledge), not about any one member.
// =====================================================================================
//
// A corpus document is derived from a live row, so it is re-derived every run and written only when
// it is genuinely new or its text changed. source_id is the ORIGIN ROW's uuid and chunk_index is the
// language slot (0 = EN, 1 = ES), which together are the unique key added in migration 0120. That is
// what makes this resumable: interrupt it anywhere and the next run picks up exactly the documents
// that are still missing, with no duplicates and no bookkeeping table.
//
// created_by stays NULL on every row this writes. That is the marker for "system-managed": rows a
// coach pasted by hand always carry her profile id, so the two never collide and a human document is
// never overwritten by the reconciler.
type CorpusDoc = { sourceId: string; chunkIndex: number; title: string; content: string };

export type CorpusResult = {
  /** documents embedded and written this run (new or changed) */
  written: number;
  /** documents already present and unchanged */
  unchanged: number;
  /** documents left for the next run because the per-run embed cap was hit */
  deferred: number;
  byKind: Record<string, number>;
};

// --- Her exercise cues -------------------------------------------------------------------------
// 365 movements with a median ~650 characters of Stephanie's own coaching language ("push your hips
// back like you're closing a door with your glutes", "kickstand foot"). Before this, a member asking
// how to do an RDL got the model's generic textbook answer, and worse, the model invented cues and
// attributed them to her, because it had nothing real to ground on.
//
// DELIBERATE EXCLUSION: only is_coach_authored rows. 887 other library exercises also carry cues,
// but those came in with the library import and are not her writing. Feeding them to a prompt block
// headed "Coach Stephanie's documented method and voice, your source of truth" would put words in
// her mouth, which is exactly the failure this is fixing.
type ExerciseRow = {
  id: string;
  name_en: string | null;
  name_es: string | null;
  cues_en: string | null;
  cues_es: string | null;
  muscle_group: string | null;
  secondary_muscles: string[] | null;
  equipment: string | null;
  difficulty: string | null;
  category: string | null;
};

function exerciseHeader(r: ExerciseRow, es: boolean): string {
  const name = (es ? r.name_es : r.name_en) ?? r.name_en ?? 'Exercise';
  const facets = [
    r.muscle_group,
    ...(r.secondary_muscles ?? []),
    r.equipment,
    r.difficulty,
    r.category,
  ]
    .map((v) => (v ?? '').trim())
    .filter(Boolean);
  const suffix = facets.length ? ` (${[...new Set(facets)].join(', ')})` : '';
  return es ? `Ejercicio: ${name}${suffix}.` : `Exercise: ${name}${suffix}.`;
}

// TENANCY, and the trap in it. exercises is the one table here whose company_id is deliberately
// NULLABLE, and every row in prod (all 1,259) has it NULL. That is not drift: its RLS read policy is
// `company_id IS NULL OR company_id = current_company_id()`, so NULL means a shared catalog row any
// tenant may READ, while only tenant-owned rows are writable.
//
// Two ways to get this wrong, and they fail in opposite directions:
//   1. Filtering `company_id = X` (the obvious thing to write) matches ZERO rows today, so the
//      indexer would report success every run while indexing nothing.
//   2. Restating the read policy verbatim matches all 365 rows for EVERY company, which would copy
//      Stephanie's coaching voice into RLS Test Tenant B's coach_knowledge. Tenant B has a live
//      subscriber, and readable is not the same as copy-into-their-corpus. Her cues are the product.
//
// So: tenant-owned rows always index for their tenant, and the shared NULL-company catalog indexes
// only for the primary tenant, resolved as the oldest company rather than a hardcoded uuid
// ("Stephanie is tenant 1, architecture supports white-label later"). A white-label tenant that
// later authors its own library gets its own rows and none of hers.
// The rule itself now lives in lib/tenant/shared-catalog.ts, because the filming tracker needs the
// identical scoping and a security rule with two copies has one that drifts.
async function exerciseDocs(svc: Svc, companyId: string): Promise<CorpusDoc[]> {
  const scope = await sharedCatalogScope(svc, companyId);
  const { data, error } = await svc
    .from('exercises')
    .select('id, name_en, name_es, cues_en, cues_es, muscle_group, secondary_muscles, equipment, difficulty, category')
    .or(scope)
    .eq('is_coach_authored', true)
    .is('archived_at', null)
    .limit(5000);
  if (error) {
    console.error('exerciseDocs:', error.message);
    return [];
  }
  const docs: CorpusDoc[] = [];
  for (const r of (data ?? []) as ExerciseRow[]) {
    const name = (r.name_en ?? '').trim() || 'Exercise';
    const en = (r.cues_en ?? '').trim();
    const esCues = (r.cues_es ?? '').trim();
    // The header is repeated inside each chunk on purpose: retrieval returns the CHUNK, not the row,
    // so a chunk that opens with "Start with your upper back on a flat bench" and never names the
    // movement is unusable to the model that receives it.
    if (en) {
      docs.push({
        sourceId: r.id,
        chunkIndex: 0,
        title: `Exercise cues: ${name}`,
        content: `${exerciseHeader(r, false)}\nCoach Stephanie's cues for this movement:\n${en}`,
      });
    }
    if (esCues) {
      docs.push({
        sourceId: r.id,
        chunkIndex: 1,
        title: `Exercise cues: ${name}`,
        content: `${exerciseHeader(r, true)}\nIndicaciones de la coach Stephanie para este movimiento:\n${esCues}`,
      });
    }
  }
  return docs;
}

// --- Her protocol ------------------------------------------------------------------------------
// The tables (protocols / protocol_rules / protocol_meals / protocol_meal_items /
// protocol_drink_items / protocol_grocery_items) are owned by another agent, built from
// .planning/PROTOCOL-ANTI-INFLAMMATORY-RESET.md. This module only READS them, and tolerates their
// absence: PostgREST answers 42P01 for an unknown relation, which is a skip and not an error, so
// this file was safe to ship before the tables landed and needs no deploy after they do.
//
// SECTIONS, not rows. A protocol is one document in her head, and its parts only make sense
// together: rule 7 is meaningless without "these are the 12 non-negotiables of the 2-week reset".
// So each section becomes one chunk under the PROTOCOL's uuid, with chunk_index carrying both the
// section and the language. Every chunk restates the protocol name for the same reason the exercise
// chunks restate the movement name: retrieval hands the model a chunk, not a row.
//
// Unpublished protocols are skipped. Retrieval feeds member-facing replies, so a draft she has not
// released must not start coming out of the coach's mouth.
const PROTOCOL_SECTIONS = ['overview', 'rules', 'day', 'grocery'] as const;
type ProtocolSection = (typeof PROTOCOL_SECTIONS)[number];

// chunk_index = section slot * 2 + language (0 = EN, 1 = ES). Stable across runs, which is the whole
// requirement: the value must be derivable from the content, never from row order.
function protocolChunkIndex(section: ProtocolSection, es: boolean): number {
  return PROTOCOL_SECTIONS.indexOf(section) * 2 + (es ? 1 : 0);
}

type ProtocolRow = {
  id: string;
  name_en: string | null;
  name_es: string | null;
  purpose_en: string | null;
  purpose_es: string | null;
  duration_days: number | null;
  stated_kcal_text: string | null;
  stated_protein_g: number | null;
  stated_carb_g: number | null;
  stated_fat_g: number | null;
  fasted_drink_title_en: string | null;
  fasted_drink_title_es: string | null;
  fasted_drink_note_en: string | null;
  fasted_drink_note_es: string | null;
};

type Bilingual = { en: string | null; es: string | null };

function pick(v: Bilingual, es: boolean): string {
  return ((es ? v.es : v.en) ?? v.en ?? '').trim();
}

async function protocolDocs(svc: Svc, companyId: string): Promise<CorpusDoc[]> {
  const { data, error } = await svc
    .from('protocols')
    .select(
      'id, name_en, name_es, purpose_en, purpose_es, duration_days, stated_kcal_text, stated_protein_g, stated_carb_g, stated_fat_g, fasted_drink_title_en, fasted_drink_title_es, fasted_drink_note_en, fasted_drink_note_es',
    )
    .eq('company_id', companyId)
    .eq('is_published', true)
    .limit(100);
  if (error) {
    // Expected before the tables exist. Anything else is worth seeing in the logs.
    if (!/does not exist|schema cache|42P01/i.test(error.message)) {
      console.error('protocolDocs:', error.message);
    }
    return [];
  }
  const protocols = (data ?? []) as ProtocolRow[];
  if (!protocols.length) return [];
  const ids = protocols.map((p) => p.id);

  const [rulesRes, mealsRes, drinksRes, groceryRes] = await Promise.all([
    svc.from('protocol_rules').select('protocol_id, sequence, text_en, text_es').in('protocol_id', ids).order('sequence'),
    svc.from('protocol_meals').select('id, protocol_id, sequence, name_en, name_es, kcal, protein_g, carb_g, fat_g').in('protocol_id', ids).order('sequence'),
    svc.from('protocol_drink_items').select('protocol_id, sequence, item_en, item_es, amount_en, amount_es').in('protocol_id', ids).order('sequence'),
    svc.from('protocol_grocery_items').select('protocol_id, sequence, category_en, category_es, item_en, item_es, quantity_en, quantity_es').in('protocol_id', ids).order('sequence'),
  ]);
  const rules = (rulesRes.data ?? []) as { protocol_id: string; sequence: number; text_en: string | null; text_es: string | null }[];
  const meals = (mealsRes.data ?? []) as { id: string; protocol_id: string; sequence: number; name_en: string | null; name_es: string | null; kcal: number | null; protein_g: number | null; carb_g: number | null; fat_g: number | null }[];
  const drinks = (drinksRes.data ?? []) as { protocol_id: string; item_en: string | null; item_es: string | null; amount_en: string | null; amount_es: string | null }[];
  const grocery = (groceryRes.data ?? []) as { protocol_id: string; category_en: string | null; category_es: string | null; item_en: string | null; item_es: string | null; quantity_en: string | null; quantity_es: string | null }[];

  const mealIds = meals.map((m) => m.id);
  const itemsByMeal = new Map<string, { en: string | null; es: string | null }[]>();
  if (mealIds.length) {
    const { data: items } = await svc
      .from('protocol_meal_items')
      .select('meal_id, sequence, text_en, text_es')
      .in('meal_id', mealIds)
      .order('sequence');
    for (const it of (items ?? []) as { meal_id: string; text_en: string | null; text_es: string | null }[]) {
      const cur = itemsByMeal.get(it.meal_id) ?? [];
      cur.push({ en: it.text_en, es: it.text_es });
      itemsByMeal.set(it.meal_id, cur);
    }
  }

  const docs: CorpusDoc[] = [];
  for (const p of protocols) {
    for (const es of [false, true]) {
      const name = pick({ en: p.name_en, es: p.name_es }, es) || 'Protocol';
      const title = `Protocol: ${(p.name_en ?? 'Protocol').trim()}`;
      const lead = es
        ? `Protocolo de la coach Stephanie: "${name}".`
        : `Coach Stephanie's protocol: "${name}".`;
      const add = (section: ProtocolSection, lines: string[]): void => {
        const body = lines.filter(Boolean).join('\n').trim();
        if (!body) return;
        docs.push({
          sourceId: p.id,
          chunkIndex: protocolChunkIndex(section, es),
          title,
          content: `${lead}\n${body}`,
        });
      };

      const macros = [
        p.stated_kcal_text ? `${p.stated_kcal_text} kcal` : '',
        p.stated_protein_g != null ? `${num(p.stated_protein_g)}g protein` : '',
        p.stated_carb_g != null ? `${num(p.stated_carb_g)}g carbs` : '',
        p.stated_fat_g != null ? `${num(p.stated_fat_g)}g fat` : '',
      ].filter(Boolean).join(', ');
      const drinkTitle = pick({ en: p.fasted_drink_title_en, es: p.fasted_drink_title_es }, es);
      const drinkNote = pick({ en: p.fasted_drink_note_en, es: p.fasted_drink_note_es }, es);
      const drinkList = drinks
        .filter((d) => d.protocol_id === p.id)
        .map((d) => {
          const item = pick({ en: d.item_en, es: d.item_es }, es);
          const amount = pick({ en: d.amount_en, es: d.amount_es }, es);
          return item ? `- ${amount ? `${amount} ` : ''}${item}` : '';
        });
      add('overview', [
        pick({ en: p.purpose_en, es: p.purpose_es }, es),
        p.duration_days != null ? (es ? `Duracion: ${p.duration_days} dias.` : `Length: ${p.duration_days} days.`) : '',
        macros ? (es ? `Objetivo diario: ${macros}.` : `Daily target: ${macros}.`) : '',
        drinkTitle ? (es ? `Bebida digestiva en ayunas: ${drinkTitle}.` : `Fasted morning digestive drink: ${drinkTitle}.`) : '',
        ...drinkList,
        drinkNote,
      ]);

      add('rules', [
        es ? 'Reglas no negociables:' : 'Non-negotiable rules:',
        ...rules
          .filter((r) => r.protocol_id === p.id)
          .map((r) => {
            const text = pick({ en: r.text_en, es: r.text_es }, es);
            return text ? `${r.sequence}. ${text}` : '';
          }),
      ]);

      add('day', [
        es ? 'Como se ve el dia:' : 'What the day looks like:',
        ...meals
          .filter((m) => m.protocol_id === p.id)
          .flatMap((m) => {
            const mealName = pick({ en: m.name_en, es: m.name_es }, es) || `Meal ${m.sequence}`;
            const mac = [
              m.kcal != null ? `${num(m.kcal)} kcal` : '',
              m.protein_g != null ? `${num(m.protein_g)}g protein` : '',
              m.carb_g != null ? `${num(m.carb_g)}g carbs` : '',
              m.fat_g != null ? `${num(m.fat_g)}g fat` : '',
            ].filter(Boolean).join(', ');
            const head = `${mealName}${mac ? ` (${mac})` : ''}:`;
            const items = (itemsByMeal.get(m.id) ?? [])
              .map((it) => pick(it, es))
              .filter(Boolean)
              .map((text) => `- ${text}`);
            return [head, ...items];
          }),
      ]);

      const groceryLines: string[] = [];
      let lastCategory = '';
      for (const g of grocery.filter((x) => x.protocol_id === p.id)) {
        const category = pick({ en: g.category_en, es: g.category_es }, es);
        if (category && category !== lastCategory) {
          groceryLines.push(`${category}:`);
          lastCategory = category;
        }
        const item = pick({ en: g.item_en, es: g.item_es }, es);
        const qty = pick({ en: g.quantity_en, es: g.quantity_es }, es);
        if (item) groceryLines.push(`- ${item}${qty ? ` (${qty})` : ''}`);
      }
      add('grocery', [es ? 'Lista de compras:' : 'Grocery list:', ...groceryLines]);
    }
  }
  return docs;
}

// Embed a list of documents with bounded concurrency and write each one as it resolves. Returns how
// many were written. Serial would be correct but slow enough to eat the whole request budget.
async function embedAndWrite(svc: Svc, companyId: string, docs: CorpusDoc[]): Promise<number> {
  let written = 0;
  let cursor = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = cursor;
      cursor += 1;
      if (i >= docs.length) return;
      const d = docs[i];
      const vec = await embedText(d.content);
      // No key, or a transient embed failure: leave the document unwritten so the next run retries
      // it. Writing it with a null embedding would make it permanently invisible to retrieval while
      // looking indexed.
      if (!vec) continue;
      const { error } = await svc.from('coach_knowledge').upsert(
        {
          company_id: companyId,
          source_id: d.sourceId,
          chunk_index: d.chunkIndex,
          title: d.title,
          content: d.content,
          embedding: toVectorLiteral(vec),
          created_by: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,source_id,chunk_index' },
      );
      if (error) {
        console.error('corpus upsert:', error.message);
        continue;
      }
      written += 1;
    }
  };
  await Promise.all(Array.from({ length: Math.min(CORPUS_CONCURRENCY, docs.length) }, () => worker()));
  return written;
}

// Reconcile the whole shared corpus for one company. Idempotent, resumable, cap-bounded.
export async function runCorpusIndex(companyId: string): Promise<CorpusResult> {
  const svc = createServiceClient();
  const byKind: Record<string, number> = {};

  // What is already system-managed for this company, with its text, so an EDITED cue re-embeds and a
  // merely re-read one does not. Comparing content is what makes the job track her edits instead of
  // freezing whatever it saw first.
  const existing = new Map<string, string>();
  const { data: have } = await svc
    .from('coach_knowledge')
    .select('source_id, chunk_index, content')
    .eq('company_id', companyId)
    .is('created_by', null)
    .limit(20000);
  for (const r of (have ?? []) as { source_id: string; chunk_index: number; content: string | null }[]) {
    existing.set(`${r.source_id}:${r.chunk_index}`, r.content ?? '');
  }

  const sources: { kind: string; build: () => Promise<CorpusDoc[]> }[] = [
    { kind: 'exercise_cues', build: () => exerciseDocs(svc, companyId) },
    { kind: 'protocol', build: () => protocolDocs(svc, companyId) },
  ];

  let unchanged = 0;
  const pending: { kind: string; doc: CorpusDoc }[] = [];
  for (const s of sources) {
    let docs: CorpusDoc[] = [];
    try {
      docs = await s.build();
    } catch (e) {
      // One corpus source failing must not stop the others, same contract as the member builders.
      console.error(`runCorpusIndex ${s.kind}:`, e instanceof Error ? e.message : e);
      continue;
    }
    for (const doc of docs) {
      if (existing.get(`${doc.sourceId}:${doc.chunkIndex}`) === doc.content) {
        unchanged += 1;
        continue;
      }
      pending.push({ kind: s.kind, doc });
    }
  }

  const take = pending.slice(0, CORPUS_EMBED_CAP);
  const deferred = pending.length - take.length;
  const written = await embedAndWrite(svc, companyId, take.map((p) => p.doc));
  // Attribution is approximate when a batch is partially written (embedAndWrite returns a count, not
  // a per-doc result). It is a log line, not a ledger, so an approximate split is the right cost.
  for (const p of take.slice(0, written)) byKind[p.kind] = (byKind[p.kind] ?? 0) + 1;

  return { written, unchanged, deferred, byKind };
}

export type BatchResult = {
  ok: boolean;
  members: number;
  indexed: number;
  corpus: CorpusResult & { companies: number };
};

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

  // PHASE 2 runs FIRST, and deliberately so. The corpus is what every member's answer is grounded
  // in, so on a run that cannot finish everything the shared knowledge is the thing worth having.
  // The member sweep is per-member and resumes cleanly; a half-indexed corpus makes every reply
  // worse for everyone.
  const companyIds = [...new Set(targets.map((t) => t.companyId))];
  const corpus: CorpusResult & { companies: number } = {
    written: 0,
    unchanged: 0,
    deferred: 0,
    byKind: {},
    companies: companyIds.length,
  };
  for (const companyId of companyIds) {
    try {
      const r = await runCorpusIndex(companyId);
      corpus.written += r.written;
      corpus.unchanged += r.unchanged;
      corpus.deferred += r.deferred;
      for (const [k, v] of Object.entries(r.byKind)) corpus.byKind[k] = (corpus.byKind[k] ?? 0) + v;
    } catch (e) {
      console.error('runMemoryIndex corpus:', e instanceof Error ? e.message : e);
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
  return { ok: true, members: targets.length, indexed, corpus };
}
