// AI safety queue: flagged coach-chat conversations that need a human eye.
//
// There is no dedicated "safety_flag" column on coach_messages (deliberate: the coach's safety
// posture is enforced via SAFETY_CLAUSE_EN in the system prompt, not a per-row flag). So this
// module DERIVES the queue from three sources the operator actually needs to see:
//
//   1. SCOFF trigger: a user turn from a member whose client_intake screen is positive
//      (scoffPositive() in @/lib/health-profile/screening) — those threads should always get a
//      gentle-eye review, not because the message is dangerous but because the *member* is.
//   2. Keyword trigger: a user turn whose content matches the medical/injury/pregnancy/eating-
//      disorder/self-harm word list below — the same categories SAFETY_CLAUSE_EN warns the model
//      about. Bilingual (EN + ES) because members write in both.
//   3. Error trigger: an ai_trace row with feature='chat' AND status='error' — every failed
//      coach reply is by definition an unanswered member with no safety guardrail applied.
//
// All three feeds are unified into one queue, most-recent first. Company-scoped; no cross-tenant
// leaks. Service client (this is an operator-only surface — the layout already gates it).
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { scoffPositive } from '@/lib/health-profile/screening';

export type TriggerReason = 'scoff' | 'safety_keyword' | 'error';

export type FlaggedThread = {
  key: string; // unique row key for React
  profileId: string;
  memberName: string;
  memberEmail: string | null;
  preview: string;
  trigger: TriggerReason;
  triggerLabel: string;
  timestamp: string;
};

export type SafetyQueue = {
  flagged: FlaggedThread[];
  kpi: {
    openFlaggedThreads: number;
    scoffPositiveMembers: number;
    chatErrorRate24h: { errors: number; total: number; pct: number | null };
  };
};

// Bilingual word list mirroring the clauses in SAFETY_CLAUSE_EN. Word-boundary matching so
// "paint" does not match "pain". Case-insensitive.
const SAFETY_KEYWORDS: { label: string; pattern: RegExp }[] = [
  {
    label: 'self-harm',
    pattern: /\b(suicide|suicidal|kill myself|hurt myself|end it all|suicidio|suicida|hacerme dano|hacerme dano)\b/i,
  },
  {
    label: 'eating disorder',
    pattern: /\b(anorexia|anorexic|bulimia|bulimic|purge|purging|binge eating|starve|starving myself|not eating|atracon|atracones|purgar|desorden alimentario)\b/i,
  },
  {
    label: 'pregnancy',
    pattern: /\b(pregnant|pregnancy|nursing|breastfeed(ing)?|embarazada|embarazo|lactando|lactancia|amamant)\b/i,
  },
  {
    label: 'injury',
    pattern: /\b(injured|injury|hurt my|torn|sprain|fracture|surgery|physical therapy|lesion|lesionad|fractur|cirugia|dolor)\b/i,
  },
  {
    label: 'medical',
    pattern: /\b(diagnosed|prescription|medication|medicine|hospital|doctor said|diabetes|thyroid|hypertension|diagnostic|medicamento|medicina|tiroides|hipertensi|receta)\b/i,
  },
];

function matchKeyword(content: string): { hit: true; label: string } | { hit: false } {
  for (const k of SAFETY_KEYWORDS) if (k.pattern.test(content)) return { hit: true, label: k.label };
  return { hit: false };
}

function preview(s: string, n = 120): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}...`;
}

type ProfileRow = { id: string; full_name: string | null; email: string | null };
type MessageRow = { id: string; profile_id: string; content: string; created_at: string };
type IntakeRow = { profile_id: string | null; contact_id: string | null; eating_disorder_screening: Record<string, unknown> | null };
type ContactRow = { id: string; profile_id: string | null };
type TraceRow = { id: number; profile_id: string | null; input_preview: string | null; ts: string; error: string | null };

/**
 * Build the full safety queue for one company. Called once per page render; never throws (a
 * missing companyId short-circuits to an empty queue so the page still renders).
 */
export async function getSafetyQueue(companyId: string | null): Promise<SafetyQueue> {
  const empty: SafetyQueue = {
    flagged: [],
    kpi: { openFlaggedThreads: 0, scoffPositiveMembers: 0, chatErrorRate24h: { errors: 0, total: 0, pct: null } },
  };
  if (!companyId) return empty;

  const svc = createServiceClient();
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const since24h = new Date(Date.now() - 86400000).toISOString();
  const since7d = new Date(Date.now() - 7 * 86400000).toISOString();

  // Parallel fetch: user turns (30d), all intakes, coach-chat traces (24h). Every query is
  // company-scoped except ai_trace, which we join on profile_id -> company filter after.
  const [msgsRes, intakesRes, contactsRes, tracesTotalRes, tracesErrRes] = await Promise.all([
    svc
      .from('coach_messages')
      .select('id, profile_id, content, created_at')
      .eq('company_id', companyId)
      .eq('role', 'user')
      .gte('created_at', since30)
      .order('created_at', { ascending: false })
      .limit(500),
    svc
      .from('client_intake')
      .select('profile_id, contact_id, eating_disorder_screening')
      .eq('company_id', companyId)
      .limit(5000),
    svc
      .from('contacts')
      .select('id, profile_id')
      .eq('company_id', companyId)
      .not('profile_id', 'is', null)
      .limit(10000),
    svc
      .from('ai_trace')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('feature', 'chat')
      .gte('ts', since24h),
    svc
      .from('ai_trace')
      .select('id, profile_id, input_preview, ts, error')
      .eq('company_id', companyId)
      .eq('feature', 'chat')
      .eq('status', 'error')
      .gte('ts', since24h)
      .order('ts', { ascending: false })
      .limit(100),
  ]);

  const messages = (msgsRes.data ?? []) as MessageRow[];
  const intakes = (intakesRes.data ?? []) as IntakeRow[];
  const contactRows = (contactsRes.data ?? []) as ContactRow[];
  const errorTraces = (tracesErrRes.data ?? []) as TraceRow[];
  const chatTotal24h = tracesTotalRes.count ?? 0;

  // contact_id -> profile_id lookup so we can resolve intake rows keyed by contact.
  const contactToProfile = new Map<string, string>();
  for (const c of contactRows) if (c.profile_id) contactToProfile.set(c.id, c.profile_id);

  // Build the set of SCOFF-positive profile ids and remember the count for the KPI.
  const scoffProfileIds = new Set<string>();
  for (const row of intakes) {
    if (!scoffPositive(row.eating_disorder_screening ?? null)) continue;
    const pid = row.profile_id ?? (row.contact_id ? contactToProfile.get(row.contact_id) ?? null : null);
    if (pid) scoffProfileIds.add(pid);
  }

  // Resolve every profile we might display in the table in one query.
  const flaggedProfileIds = new Set<string>();
  for (const m of messages) flaggedProfileIds.add(m.profile_id);
  for (const t of errorTraces) if (t.profile_id) flaggedProfileIds.add(t.profile_id);
  const profileIds = [...flaggedProfileIds];
  const profileMap = new Map<string, ProfileRow>();
  if (profileIds.length > 0) {
    const { data: profiles } = await svc
      .from('profiles')
      .select('id, full_name, email')
      .in('id', profileIds);
    for (const p of ((profiles ?? []) as ProfileRow[])) profileMap.set(p.id, p);
  }

  // Compose the unified list. A single message can carry multiple triggers (SCOFF member who
  // also wrote a safety keyword); we prefer the more specific one for the label but still show
  // the row once.
  const flagged: FlaggedThread[] = [];
  const seenPerProfile = new Set<string>(); // one row per (profile, message) — dedupe

  for (const m of messages) {
    const kw = matchKeyword(m.content);
    const isScoff = scoffProfileIds.has(m.profile_id);
    if (!kw.hit && !isScoff) continue;
    // For SCOFF-positive members, only surface user turns with keyword matches OR turns from
    // the last 7 days (otherwise the queue drowns in normal chat from those members).
    if (!kw.hit && isScoff && m.created_at < since7d) continue;

    const p = profileMap.get(m.profile_id);
    const trigger: TriggerReason = kw.hit ? 'safety_keyword' : 'scoff';
    const triggerLabel = kw.hit ? `Keyword: ${kw.label}` : 'SCOFF-positive member';
    const key = `msg:${m.id}`;
    if (seenPerProfile.has(key)) continue;
    seenPerProfile.add(key);
    flagged.push({
      key,
      profileId: m.profile_id,
      memberName: p?.full_name?.trim() || p?.email || 'Unknown member',
      memberEmail: p?.email ?? null,
      preview: preview(m.content),
      trigger,
      triggerLabel,
      timestamp: m.created_at,
    });
  }

  for (const t of errorTraces) {
    if (!t.profile_id) continue;
    const p = profileMap.get(t.profile_id);
    flagged.push({
      key: `err:${t.id}`,
      profileId: t.profile_id,
      memberName: p?.full_name?.trim() || p?.email || 'Unknown member',
      memberEmail: p?.email ?? null,
      preview: preview(t.input_preview ?? t.error ?? 'Coach reply failed with no captured input.'),
      trigger: 'error',
      triggerLabel: 'Coach-chat error',
      timestamp: t.ts,
    });
  }

  flagged.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  const openFlaggedThreads = new Set(
    flagged.filter((f) => f.timestamp >= since7d).map((f) => f.profileId),
  ).size;
  const chatErrorRate24h = {
    errors: errorTraces.length,
    total: chatTotal24h,
    pct: chatTotal24h > 0 ? errorTraces.length / chatTotal24h : null,
  };

  return {
    flagged: flagged.slice(0, 100),
    kpi: {
      openFlaggedThreads,
      scoffPositiveMembers: scoffProfileIds.size,
      chatErrorRate24h,
    },
  };
}
