import 'server-only';
// Admin waitlist metrics — one aggregator, one page reads from it. Reads the three funnel tables
// (waitlist_leads / waitlist_entry_events / waitlist_quiz_responses) and returns the numbers the
// campaign plan's weekly checkpoint tree cares about:
//   Aug 11 (1 week in): 500–800 signups expected
//   Aug 18 (2 weeks in): 1,200–2,000 signups expected
//   ~Sep 13 (~2 weeks pre-launch): 2,500–3,500 signups expected
// Kb-funnels doctrine 5: "Every stalled waitlist stalls for one of three reasons: not enough top-
// of-funnel traffic, top of funnel works but page doesn't convert, or the page works but nobody
// shares." This aggregator surfaces all three signals so the operator can point at the right one.
import { createServiceClient } from '@/lib/supabase/service';

export type WaitlistMetrics = {
  total: number;
  confirmed: number;
  unconfirmed: number;
  converted: number;
  unsubscribed: number;
  last24h: number;
  lastHour: number;
  quizCompleted: number;
  quizCompletionPct: number;
  totalReferrals: number;
  uniqueReferrers: number;
  kFactor: number; // referred friends / unique referrers (rough viral coefficient)
  esCount: number;
  enCount: number;
  esPct: number;
  checkpoints: Checkpoint[];
  topReferrers: TopReferrer[];
  tierCandidateCounts: Record<string, number>;
};

export type Checkpoint = {
  label: string; // e.g. "Aug 11 (1 week in)"
  targetLo: number;
  targetHi: number;
  actual: number;
  dueIso: string;
  status: 'ahead' | 'on_track' | 'behind' | 'pending';
};

export type TopReferrer = {
  leadId: string;
  firstName: string | null;
  email: string;
  referralCode: string;
  referralCount: number;
  entryCount: number;
};

// Campaign schedule locked in the 2026-07-23 call. Dates are UTC-anchored midnight (loose enough
// for weekly checkpoints; if the campaign slips a week per the fallback plan we edit these).
const CAMPAIGN_START_ISO = '2026-08-04T00:00:00Z';
const CHECKPOINTS: ReadonlyArray<{ label: string; dueIso: string; targetLo: number; targetHi: number }> = [
  { label: 'Aug 11 (1 week in)',    dueIso: '2026-08-11T00:00:00Z', targetLo: 500,  targetHi: 800  },
  { label: 'Aug 18 (2 weeks in)',   dueIso: '2026-08-18T00:00:00Z', targetLo: 1200, targetHi: 2000 },
  { label: 'Sep 13 (~2wk pre-launch)', dueIso: '2026-09-13T00:00:00Z', targetLo: 2500, targetHi: 3500 },
];

async function resolveTenantId(sb: ReturnType<typeof createServiceClient>): Promise<string | null> {
  const { data } = await sb.from('companies').select('id').eq('slug', 'thick-and-fit').maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Read every KPI the /admin/waitlist page renders. Runs a fixed set of parallel COUNT + SELECT
 *  queries so page load is one round-trip's-worth of round-trips. Never throws — returns zeros
 *  everywhere when the DB is unreachable so the page still renders. */
export async function getWaitlistMetrics(): Promise<WaitlistMetrics> {
  const sb = createServiceClient();
  const companyId = await resolveTenantId(sb);
  if (!companyId) return empty();

  const nowMs = Date.now();
  const dayAgoIso = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
  const hourAgoIso = new Date(nowMs - 60 * 60 * 1000).toISOString();

  // Head-only COUNT(*) queries are cheap; every filter is on an indexed column (company_id +
  // partial where clauses on idx_waitlist_active for the active-lead filters).
  const c = (filter: (q: ReturnType<typeof sb.from>) => ReturnType<typeof sb.from>) =>
    filter(sb.from('waitlist_leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId));

  const [
    totalRes,
    confirmedRes,
    convertedRes,
    unsubRes,
    last24hRes,
    lastHourRes,
    quizRes,
    esRes,
    enRes,
    referralEventsRes,
    topReferrersRes,
    tierCandidatesRes,
  ] = await Promise.all([
    c((q) => q),
    c((q) => q.not('confirmed_at', 'is', null)),
    c((q) => q.not('converted_at', 'is', null)),
    c((q) => q.not('unsubscribed_at', 'is', null)),
    c((q) => q.gte('created_at', dayAgoIso)),
    c((q) => q.gte('created_at', hourAgoIso)),
    c((q) => q.not('quiz_completed_at', 'is', null)),
    c((q) => q.eq('locale', 'es')),
    c((q) => q.eq('locale', 'en')),
    sb
      .from('waitlist_entry_events')
      .select('lead_id', { count: 'exact' })
      .eq('company_id', companyId)
      .eq('kind', 'referral'),
    sb
      .from('waitlist_leads')
      .select('id, first_name, email, referral_code, entry_count')
      .eq('company_id', companyId)
      .is('unsubscribed_at', null)
      .gt('entry_count', 1)
      .order('entry_count', { ascending: false })
      .limit(20),
    sb
      .from('waitlist_quiz_responses')
      .select('tier_candidate')
      .eq('company_id', companyId)
      .not('tier_candidate', 'is', null),
  ]);

  const total = totalRes.count ?? 0;
  const confirmed = confirmedRes.count ?? 0;
  const converted = convertedRes.count ?? 0;
  const unsubscribed = unsubRes.count ?? 0;
  const last24h = last24hRes.count ?? 0;
  const lastHour = lastHourRes.count ?? 0;
  const quizCompleted = quizRes.count ?? 0;
  const esCount = esRes.count ?? 0;
  const enCount = enRes.count ?? 0;

  const totalReferrals = referralEventsRes.count ?? 0;
  const referralRows = (referralEventsRes.data ?? []) as { lead_id: string }[];
  const uniqueReferrers = new Set(referralRows.map((r) => r.lead_id)).size;

  const topReferrersRaw = (topReferrersRes.data ?? []) as {
    id: string; first_name: string | null; email: string; referral_code: string; entry_count: number;
  }[];
  // entry_count > 1 gives us leads with at least 1 referral or the quiz + follow bonuses; compute
  // actual referral count per top-20 in a second batched query to avoid 20 individual round-trips.
  const topIds = topReferrersRaw.map((r) => r.id);
  const perReferrerCounts: Record<string, number> = {};
  if (topIds.length > 0) {
    const { data: allRefs } = await sb
      .from('waitlist_entry_events')
      .select('lead_id')
      .eq('company_id', companyId)
      .eq('kind', 'referral')
      .in('lead_id', topIds);
    for (const row of (allRefs ?? []) as { lead_id: string }[]) {
      perReferrerCounts[row.lead_id] = (perReferrerCounts[row.lead_id] ?? 0) + 1;
    }
  }
  const topReferrers: TopReferrer[] = topReferrersRaw
    .map((r) => ({
      leadId: r.id,
      firstName: r.first_name,
      email: r.email,
      referralCode: r.referral_code,
      referralCount: perReferrerCounts[r.id] ?? 0,
      entryCount: r.entry_count,
    }))
    .filter((r) => r.referralCount > 0)
    .sort((a, b) => b.referralCount - a.referralCount)
    .slice(0, 10);

  const tierCandidateCounts: Record<string, number> = {};
  for (const row of (tierCandidatesRes.data ?? []) as { tier_candidate: string }[]) {
    tierCandidateCounts[row.tier_candidate] = (tierCandidateCounts[row.tier_candidate] ?? 0) + 1;
  }

  const checkpoints: Checkpoint[] = CHECKPOINTS.map((cp) => {
    const dueMs = new Date(cp.dueIso).getTime();
    const isPastDue = nowMs >= dueMs;
    if (!isPastDue) return { ...cp, actual: total, status: 'pending' as const };
    if (total >= cp.targetHi) return { ...cp, actual: total, status: 'ahead' as const };
    if (total >= cp.targetLo) return { ...cp, actual: total, status: 'on_track' as const };
    return { ...cp, actual: total, status: 'behind' as const };
  });

  const denom = enCount + esCount;
  const esPct = denom === 0 ? 0 : Math.round((esCount / denom) * 100);
  const quizCompletionPct = total === 0 ? 0 : Math.round((quizCompleted / total) * 100);
  const kFactor = uniqueReferrers === 0 ? 0 : Math.round((totalReferrals / uniqueReferrers) * 100) / 100;

  return {
    total,
    confirmed,
    unconfirmed: Math.max(0, total - confirmed),
    converted,
    unsubscribed,
    last24h,
    lastHour,
    quizCompleted,
    quizCompletionPct,
    totalReferrals,
    uniqueReferrers,
    kFactor,
    esCount,
    enCount,
    esPct,
    checkpoints,
    topReferrers,
    tierCandidateCounts,
  };
}

function empty(): WaitlistMetrics {
  return {
    total: 0, confirmed: 0, unconfirmed: 0, converted: 0, unsubscribed: 0,
    last24h: 0, lastHour: 0, quizCompleted: 0, quizCompletionPct: 0,
    totalReferrals: 0, uniqueReferrers: 0, kFactor: 0,
    esCount: 0, enCount: 0, esPct: 0,
    checkpoints: CHECKPOINTS.map((cp) => ({ ...cp, actual: 0, status: 'pending' as const })),
    topReferrers: [],
    tierCandidateCounts: {},
  };
}

// Exported for the /admin/launch runway page — it wants "days until Aug 4" and "days until Sept 27"
// as tiles, and they belong in the same schedule module.
export const CAMPAIGN_SCHEDULE = {
  waitlistOpensIso: CAMPAIGN_START_ISO,
  doorsOpenIso: '2026-09-27T00:00:00Z',
  foundingClosesIso: '2026-10-02T00:00:00Z', // 5-day founding window after doors open
} as const;
