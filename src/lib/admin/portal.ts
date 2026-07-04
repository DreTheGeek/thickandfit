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

export type Ticket = { id: string; subject: string; email: string | null; category: string | null; priority: string; status: string; createdAt: string };

export async function getSupportTickets(companyId: string): Promise<{ tickets: Ticket[]; openCount: number }> {
  const sb = createServiceClient();
  const [{ data }, { count: openCount }] = await Promise.all([
    sb.from('support_tickets').select('id, subject, email, category, priority, status, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(100),
    sb.from('support_tickets').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('status', ['open', 'in_progress']),
  ]);
  const tickets = ((data ?? []) as { id: string; subject: string; email: string | null; category: string | null; priority: string; status: string; created_at: string }[]).map((t) => ({
    id: t.id, subject: t.subject, email: t.email, category: t.category, priority: t.priority, status: t.status, createdAt: t.created_at,
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
