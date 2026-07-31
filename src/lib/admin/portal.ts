// Data layer for the operator/admin portal. Everything an operator runs the backend with: overview
// metrics, integration connections, AI usage + spend, cron/status, support tickets, knowledge base.
// All operator-gated at the page/layout level; reads via the service client.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

export type Connection = { key: string; label: string; configured: boolean; note: string; critical: boolean };

// Which integrations are wired (runtime env check). In prod the keys live in Vercel; locally most are
// unset. "critical" = blocks launch when missing.
export function getConnections(): Connection[] {
  const has = (v: string | undefined): boolean => !!v && v.trim().length > 0;
  return [
    { key: 'stripe', label: 'Stripe (payments)', configured: has(process.env.STRIPE_SECRET_KEY), note: 'Live key + prices to take money', critical: true },
    { key: 'openrouter', label: 'OpenRouter (AI)', configured: has(process.env.OPENROUTER_API_KEY), note: 'Chat, plan-gen, text-to-macro', critical: true },
    { key: 'resend', label: 'Resend (email)', configured: has(process.env.RESEND_API_KEY), note: 'Transactional + coach emails', critical: true },
    { key: 'supabase', label: 'Supabase (DB/auth)', configured: has(process.env.SUPABASE_SERVICE_ROLE_KEY), note: 'Database, auth, storage', critical: true },
    { key: 'mux', label: 'Mux (video)', configured: has(process.env.MUX_TOKEN_ID), note: 'Workout demo streaming', critical: false },
    { key: 'gemini', label: 'Gemini (free vision)', configured: has(process.env.GEMINI_API_KEY), note: 'Free photo-scan tier', critical: false },
    { key: 'twilio', label: 'Twilio (SMS)', configured: has(process.env.TWILIO_ACCOUNT_SID), note: '10DLC reminders', critical: false },
    { key: 'sentry', label: 'Sentry (errors)', configured: has(process.env.SENTRY_DSN) || has(process.env.NEXT_PUBLIC_SENTRY_DSN), note: 'Error monitoring', critical: false },
    { key: 'posthog', label: 'PostHog (analytics)', configured: has(process.env.NEXT_PUBLIC_POSTHOG_KEY), note: 'Product analytics', critical: false },
    { key: 'ghl', label: 'GoHighLevel (CRM)', configured: has(process.env.GHL_API_KEY) || has(process.env.GHL_LOCATION_ID), note: 'Marketing CRM sync', critical: false },
  ];
}

export type UsageStat = { feature: string; calls: number; promptTokens: number; completionTokens: number; costCents: number };
export type Usage = { total: { calls: number; costCents: number; tokens: number }; byFeature: UsageStat[]; scans7d: number; rateHits24h: number };

export async function getUsage(companyId: string): Promise<Usage> {
  const sb = createServiceClient();
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: usage }, { count: scans7d }, { count: rateHits24h }] = await Promise.all([
    sb.from('ai_usage_log').select('feature, prompt_tokens, completion_tokens, cost_cents').eq('company_id', companyId).gte('created_at', since30).limit(20000),
    sb.from('ai_inferences').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    sb.from('rate_limit_log').select('id', { count: 'exact', head: true }).gte('hit_at', new Date(Date.now() - 86400000).toISOString()),
  ]);
  const rows = (usage ?? []) as { feature: string | null; prompt_tokens: number | null; completion_tokens: number | null; cost_cents: number | null }[];
  const map = new Map<string, UsageStat>();
  let calls = 0, costCents = 0, tokens = 0;
  for (const r of rows) {
    const f = r.feature ?? 'other';
    const e = map.get(f) ?? { feature: f, calls: 0, promptTokens: 0, completionTokens: 0, costCents: 0 };
    e.calls += 1; e.promptTokens += Number(r.prompt_tokens ?? 0); e.completionTokens += Number(r.completion_tokens ?? 0); e.costCents += Number(r.cost_cents ?? 0);
    map.set(f, e);
    calls += 1; costCents += Number(r.cost_cents ?? 0); tokens += Number(r.prompt_tokens ?? 0) + Number(r.completion_tokens ?? 0);
  }
  return { total: { calls, costCents, tokens }, byFeature: [...map.values()].sort((a, b) => b.costCents - a.costCents), scans7d: scans7d ?? 0, rateHits24h: rateHits24h ?? 0 };
}

export type CronRow = { name: string; schedule: string; active: boolean; lastRun: string | null; lastStatus: string | null; runs7d: number; fails7d: number };

// pg_cron registry + recent run outcomes. Uses the Management API SQL runner is not available at
// runtime; instead read cron_job_log (app-written) + cron schema via the service client's rpc where
// possible. Falls back to the app-maintained cron_job_log table.
export async function getCronStatus(): Promise<CronRow[]> {
  const sb = createServiceClient();
  // cron schema is not exposed to PostgREST; the app writes successes to public.cron_job_log.
  const { data } = await sb
    .from('cron_job_log')
    .select('job_name, status, ran_at')
    .gte('ran_at', new Date(Date.now() - 7 * 86400000).toISOString())
    .order('ran_at', { ascending: false })
    .limit(2000);
  const rows = (data ?? []) as { job_name: string; status: string | null; ran_at: string }[];
  const map = new Map<string, CronRow>();
  for (const r of rows) {
    const e = map.get(r.job_name) ?? { name: r.job_name, schedule: '', active: true, lastRun: null, lastStatus: null, runs7d: 0, fails7d: 0 };
    if (!e.lastRun) { e.lastRun = r.ran_at; e.lastStatus = r.status; }
    e.runs7d += 1;
    if (r.status && r.status !== 'success' && r.status !== 'succeeded') e.fails7d += 1;
    map.set(r.job_name, e);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// `body` and `source` are part of this on purpose. The board could only ever show the subject line,
// so a ticket was unreadable and therefore unworkable: the column was written on create and never
// read back anywhere.
export type TicketTriage = {
  category?: string;
  priority?: string;
  summary?: string;
  memberFound?: boolean;
  memberContext?: string;
  likelyArea?: string[];
  suggestedReply?: string;
  confidence?: number;
};

export type Ticket = { id: string; subject: string; body: string | null; email: string | null; category: string | null; priority: string; status: string; source: string | null; createdAt: string; triage: TicketTriage | null; githubIssueUrl: string | null };

export async function getSupportTickets(companyId: string): Promise<{ tickets: Ticket[]; openCount: number }> {
  const sb = createServiceClient();
  const [{ data }, { count: openCount }] = await Promise.all([
    sb.from('support_tickets').select('id, subject, body, email, category, priority, status, source, created_at, triage, github_issue_url').eq('company_id', companyId).order('created_at', { ascending: false }).limit(100),
    sb.from('support_tickets').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('status', ['open', 'in_progress']),
  ]);
  const tickets = ((data ?? []) as { id: string; subject: string; body: string | null; email: string | null; category: string | null; priority: string; status: string; source: string | null; created_at: string; triage: TicketTriage | null; github_issue_url: string | null }[]).map((t) => ({
    id: t.id, subject: t.subject, body: t.body, email: t.email, category: t.category, priority: t.priority, status: t.status, source: t.source, createdAt: t.created_at, triage: t.triage, githubIssueUrl: t.github_issue_url,
  }));
  return { tickets, openCount: openCount ?? 0 };
}

export type KnowledgeSource = { source: string; title: string; chunks: number };

export async function getKnowledge(companyId: string): Promise<{ sources: KnowledgeSource[]; totalChunks: number; embedded: number }> {
  const sb = createServiceClient();
  const { data } = await sb.from('coach_knowledge').select('source_id, title, embedding').eq('company_id', companyId).limit(5000);
  const rows = (data ?? []) as { source_id: string; title: string | null; embedding: unknown }[];
  const map = new Map<string, KnowledgeSource>();
  let embedded = 0;
  for (const r of rows) {
    const e = map.get(r.source_id) ?? { source: r.source_id, title: r.title ?? 'Untitled source', chunks: 0 };
    e.chunks += 1;
    map.set(r.source_id, e);
    if (r.embedding != null) embedded += 1;
  }
  return { sources: [...map.values()].sort((a, b) => b.chunks - a.chunks), totalChunks: rows.length, embedded };
}

export type ApiAnalytics = {
  totals: { requests: number; errors: number; error_rate: number; p95: number; p99: number; anon: number; auth_fail: number; public_hits: number };
  volume: { day: string; requests: number; errors: number }[];
  endpoints: { path: string; method: string; requests: number; error_rate: number; avg_ms: number }[];
  latency: { path: string; requests: number; p50: number; p95: number; p99: number }[];
  consumers: { email: string; requests: number; errors: number; last: string }[];
  recent_errors: { ts: string; status: number; method: string; path: string; duration_ms: number | null; email: string; error: string | null }[];
  rate_limits: { ts: string; path: string; email: string }[];
};

export async function getApiAnalytics(days = 30): Promise<ApiAnalytics | null> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('api_analytics', { days });
  if (error || !data) return null;
  return data as ApiAnalytics;
}

export type Learning = {
  knowledge: { chunks: number; sources: number; addedThisWeek: number; growth: { day: string; count: number }[] };
  corrections: { total: number; last30: number; topFoods: { name: string; n: number }[] };
  scans: { total: number; last7: number; withCorrection: number };
  insights: { total: number; last7: number };
  // K4: what the engine has learned from EVERY member, not just one. Empty until enough distinct
  // members have corrected the same food; that emptiness is the honest state, not a failure.
  populationBias: { food: string; ratio: number; samples: number; members: number }[];
};

// The learning loop: knowledge growing, corrections teaching the food matcher, scans + insights.
export async function getLearning(companyId: string): Promise<Learning> {
  const sb = createServiceClient();
  const wk = new Date(Date.now() - 7 * 86400000).toISOString();
  const mo = new Date(Date.now() - 30 * 86400000).toISOString();
  // Corrections = food_log rows the member re-portioned (corrected_at set) - the supervised signal that
  // teaches portion estimation (the hardest problem). This is the AI's training data, growing per log.
  const [{ data: kn }, { count: corrTotal }, { count: corr30 }, { data: corrRows }, { count: scanTotal }, { count: scan7 }, { count: scanCorrected }, { count: insTotal }, { count: ins7 }, { data: biasRows }] = await Promise.all([
    sb.from('coach_knowledge').select('source_id, created_at').eq('company_id', companyId).limit(6000),
    sb.from('food_log').select('id', { count: 'exact', head: true }).eq('company_id', companyId).not('corrected_at', 'is', null),
    sb.from('food_log').select('id', { count: 'exact', head: true }).eq('company_id', companyId).not('corrected_at', 'is', null).gte('corrected_at', mo),
    sb.from('food_log').select('name').eq('company_id', companyId).not('corrected_at', 'is', null).limit(2000),
    // feature='photo-scan' or this is not a scan count. Without the filter it summed EVERY inference
    // in the table, and the nightly insights cron alone writes ~54 rows against 9 real photo scans,
    // so the panel read "50 scans processed, 14 this week" while members had scanned 9 photos total.
    // A dashboard whose job is to prove the system is learning must not inflate its own numbers.
    sb.from('ai_inferences').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('feature', 'photo-scan'),
    sb.from('ai_inferences').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('feature', 'photo-scan').gte('created_at', wk),
    // Scans the member actually corrected. Was reusing the food_log corrected_at count, which is a
    // different thing measured on a different table: a text-typed macro correction (the only one that
    // exists) was being displayed under PHOTO-SCAN VOLUME as a corrected scan.
    sb.from('ai_inferences').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('feature', 'photo-scan').not('correction', 'is', null),
    sb.from('user_insights').select('id', { count: 'exact', head: true }),
    sb.from('user_insights').select('id', { count: 'exact', head: true }).gte('created_at', wk),
    sb.from('scan_population_bias').select('food_key, ratio, sample_count, member_count').eq('company_id', companyId).limit(12),
  ]);
  const knRows = (kn ?? []) as { source_id: string; created_at: string }[];
  const sources = new Set(knRows.map((k) => k.source_id)).size;
  const addedThisWeek = knRows.filter((k) => k.created_at >= wk).length;
  const byDay = new Map<string, number>();
  for (const k of knRows) { const d = k.created_at.slice(0, 10); byDay.set(d, (byDay.get(d) ?? 0) + 1); }
  const growth = [...byDay.entries()].sort().slice(-30).map(([day, count]) => ({ day, count }));
  const foodCounts = new Map<string, number>();
  for (const r of (corrRows ?? []) as { name: string | null }[]) { const n = (r.name ?? '').trim(); if (n) foodCounts.set(n, (foodCounts.get(n) ?? 0) + 1); }
  const topFoods = [...foodCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, n]) => ({ name, n }));
  return {
    knowledge: { chunks: knRows.length, sources, addedThisWeek, growth },
    corrections: { total: corrTotal ?? 0, last30: corr30 ?? 0, topFoods },
    scans: { total: scanTotal ?? 0, last7: scan7 ?? 0, withCorrection: scanCorrected ?? 0 },
    insights: { total: insTotal ?? 0, last7: ins7 ?? 0 },
    populationBias: ((biasRows ?? []) as { food_key: string; ratio: number; sample_count: number; member_count: number }[])
      .map((b) => ({ food: b.food_key, ratio: Number(b.ratio), samples: b.sample_count, members: b.member_count }))
      .sort((a, b) => Math.abs(b.ratio - 1) - Math.abs(a.ratio - 1)),
  };
}

export type Overview = {
  members: number; clients: number; activeSubs: number; mrrCents: number;
  scans7d: number; openTickets: number; cronFails7d: number; connectionsMissing: number;
};

export async function getOverview(companyId: string): Promise<Overview> {
  const sb = createServiceClient();
  const [{ count: members }, { count: clients }, { count: activeSubs }, usage, tickets, crons] = await Promise.all([
    sb.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('role', ['subscriber', 'free']),
    sb.from('contacts').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('type', 'client'),
    sb.from('client_subscriptions').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('status', ['active', 'trialing', 'past_due']),
    getUsage(companyId),
    getSupportTickets(companyId),
    getCronStatus(),
  ]);
  // MRR from client_subscriptions grandfathered prices (best-effort; matches the coach overview source).
  const { data: subs } = await sb.from('client_subscriptions').select('grandfathered_price_cents, status').eq('company_id', companyId).in('status', ['active', 'trialing']);
  const mrrCents = ((subs ?? []) as { grandfathered_price_cents: number | null }[]).reduce((a, s) => a + Number(s.grandfathered_price_cents ?? 0), 0);
  const connectionsMissing = getConnections().filter((c) => c.critical && !c.configured).length;
  return {
    members: members ?? 0, clients: clients ?? 0, activeSubs: activeSubs ?? 0, mrrCents,
    scans7d: usage.scans7d, openTickets: tickets.openCount, cronFails7d: crons.reduce((a, c) => a + c.fails7d, 0), connectionsMissing,
  };
}

// ---- Evals (eval_run: one summary row per suite run) -----------------------------------------
export type EvalRunRow = {
  id: string; suite: string; cases: number; passed: number; score: number | null;
  metrics: Record<string, unknown>; commitSha: string | null; createdAt: string;
};
export type EvalSuiteSummary = { suite: string; latest: EvalRunRow | null; runs: number; trend: number | null };
export type Evals = { suites: EvalSuiteSummary[]; history: EvalRunRow[] };

export async function getEvals(limit = 40): Promise<Evals> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('eval_run')
    .select('id, suite, cases, passed, score, metrics, commit_sha, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  const rows = ((data ?? []) as Record<string, unknown>[]).map((r): EvalRunRow => ({
    id: r.id as string, suite: r.suite as string, cases: (r.cases as number) ?? 0, passed: (r.passed as number) ?? 0,
    score: (r.score as number) ?? null, metrics: (r.metrics as Record<string, unknown>) ?? {},
    commitSha: (r.commit_sha as string) ?? null, createdAt: r.created_at as string,
  }));
  const bySuite = new Map<string, EvalRunRow[]>();
  for (const r of rows) { const a = bySuite.get(r.suite) ?? []; a.push(r); bySuite.set(r.suite, a); }
  const suites: EvalSuiteSummary[] = [...bySuite.entries()].map(([suite, list]) => {
    const latest = list[0] ?? null;
    const prev = list[1] ?? null;
    const trend = latest?.score != null && prev?.score != null ? latest.score - prev.score : null;
    return { suite, latest, runs: list.length, trend };
  });
  return { suites, history: rows };
}

// ---- Agent observability (ai_trace: one row per model call) ----------------------------------
export type TraceRow = {
  id: number; ts: string; feature: string; operation: string; model: string | null; status: string;
  latencyMs: number | null; promptTokens: number | null; completionTokens: number | null;
  retrievalCount: number | null; inputPreview: string | null; outputPreview: string | null; error: string | null;
};
export type TraceFeatureStat = { feature: string; calls: number; errors: number; avgLatencyMs: number };
export type Traces = {
  total: number; errors: number; last24h: number; avgLatencyMs: number;
  byFeature: TraceFeatureStat[]; recent: TraceRow[]; recentErrors: TraceRow[];
};

export async function getTraces(limit = 60): Promise<Traces> {
  const sb = createServiceClient();
  const since24 = new Date(Date.now() - 86400000).toISOString();
  const [{ data: agg }, { data: recent }, { data: errs }, { count: total }, { count: last24h }] = await Promise.all([
    sb.from('ai_trace').select('feature, status, latency_ms').gte('ts', new Date(Date.now() - 7 * 86400000).toISOString()).limit(20000),
    sb.from('ai_trace').select('id, ts, feature, operation, model, status, latency_ms, prompt_tokens, completion_tokens, retrieval_count, input_preview, output_preview, error').order('ts', { ascending: false }).limit(limit),
    sb.from('ai_trace').select('id, ts, feature, operation, model, status, latency_ms, prompt_tokens, completion_tokens, retrieval_count, input_preview, output_preview, error').eq('status', 'error').order('ts', { ascending: false }).limit(25),
    sb.from('ai_trace').select('id', { count: 'exact', head: true }),
    sb.from('ai_trace').select('id', { count: 'exact', head: true }).gte('ts', since24),
  ]);
  const rows = (agg ?? []) as { feature: string; status: string; latency_ms: number | null }[];
  const map = new Map<string, { calls: number; errors: number; latSum: number; latN: number }>();
  let errors = 0, latSum = 0, latN = 0;
  for (const r of rows) {
    const m = map.get(r.feature) ?? { calls: 0, errors: 0, latSum: 0, latN: 0 };
    m.calls += 1;
    // Only 'error' is a failure. 'notConfigured' is a benign key-gated no-op and must not inflate the error rate.
    if (r.status === 'error') { m.errors += 1; errors += 1; }
    if (typeof r.latency_ms === 'number') { m.latSum += r.latency_ms; m.latN += 1; latSum += r.latency_ms; latN += 1; }
    map.set(r.feature, m);
  }
  const toRow = (r: Record<string, unknown>): TraceRow => ({
    id: r.id as number, ts: r.ts as string, feature: r.feature as string, operation: r.operation as string,
    model: (r.model as string) ?? null, status: r.status as string, latencyMs: (r.latency_ms as number) ?? null,
    promptTokens: (r.prompt_tokens as number) ?? null, completionTokens: (r.completion_tokens as number) ?? null,
    retrievalCount: (r.retrieval_count as number) ?? null, inputPreview: (r.input_preview as string) ?? null,
    outputPreview: (r.output_preview as string) ?? null, error: (r.error as string) ?? null,
  });
  return {
    total: total ?? 0,
    errors,
    last24h: last24h ?? 0,
    avgLatencyMs: latN ? Math.round(latSum / latN) : 0,
    byFeature: [...map.entries()]
      .map(([feature, m]) => ({ feature, calls: m.calls, errors: m.errors, avgLatencyMs: m.latN ? Math.round(m.latSum / m.latN) : 0 }))
      .sort((a, b) => b.calls - a.calls),
    recent: ((recent ?? []) as Record<string, unknown>[]).map(toRow),
    recentErrors: ((errs ?? []) as Record<string, unknown>[]).map(toRow),
  };
}

// ---- Knowledge graph (kg_node / kg_edge, built by kg_rebuild) --------------------------------
export type KgNode = { id: string; type: string; key: string; label: string; weight: number };
export type KgEdge = { id: string; src_id: string; dst_id: string; rel: string; weight: number };
export type Graph = { nodes: KgNode[]; edges: KgEdge[]; builtAt: string | null; byType: Record<string, number>; byRel: Record<string, number> };

export async function getGraph(companyId: string): Promise<Graph> {
  const sb = createServiceClient();
  // Whole graph in two reads - ~600 nodes / ~1.2K edges is a small payload the client filters in-memory.
  const [{ data: nodes }, { data: edges }] = await Promise.all([
    sb.from('kg_node').select('id, type, key, label, weight, updated_at').eq('company_id', companyId).order('weight', { ascending: false }).limit(5000),
    sb.from('kg_edge').select('id, src_id, dst_id, rel, weight').eq('company_id', companyId).limit(20000),
  ]);
  const nodeRows = (nodes ?? []) as (KgNode & { updated_at: string })[];
  const edgeRows = (edges ?? []) as KgEdge[];
  const byType: Record<string, number> = {};
  for (const n of nodeRows) byType[n.type] = (byType[n.type] ?? 0) + 1;
  const byRel: Record<string, number> = {};
  for (const e of edgeRows) byRel[e.rel] = (byRel[e.rel] ?? 0) + 1;
  const builtAt = nodeRows.reduce<string | null>((max, n) => (!max || n.updated_at > max ? n.updated_at : max), null);
  return {
    nodes: nodeRows.map(({ id, type, key, label, weight }) => ({ id, type, key, label, weight })),
    edges: edgeRows,
    builtAt,
    byType,
    byRel,
  };
}
