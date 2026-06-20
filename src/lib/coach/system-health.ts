// Real system-health checks for the coach App Health surface. Server-only: probes the DB,
// reads live row counts, and reports which integrations are actually configured (env presence
// only — secret VALUES are never returned). No fabricated "operational" lights.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

export type ServiceStatus = 'operational' | 'configured' | 'planned' | 'down';

export type ServiceCheck = {
  key: string;
  name: string;
  category: 'core' | 'integration' | 'planned';
  status: ServiceStatus;
  detail: string;
};

export type DataCount = { key: string; label: string; value: number };

export type SystemHealth = {
  services: ServiceCheck[];
  data: DataCount[];
  automation: { ghlLastSync: string | null; ghlCron: string };
  deploy: { commit: string | null; env: string; region: string | null };
  checkedAtIso: string;
};

function has(...names: string[]): boolean {
  return names.some((n) => {
    const v = process.env[n];
    return typeof v === 'string' && v.trim().length > 0;
  });
}

async function safeCount(
  sb: ReturnType<typeof createServiceClient>,
  table: string,
  companyId: string,
  filters: Record<string, string> = {},
): Promise<number> {
  try {
    let q = sb.from(table).select('id', { count: 'exact', head: true }).eq('company_id', companyId);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getSystemHealth(companyId: string): Promise<SystemHealth> {
  const sb = createServiceClient();

  // Core: actually probe the database with a trivial scoped count.
  let dbUp = true;
  let contactCount = 0;
  try {
    const { count, error } = await sb
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId);
    if (error) dbUp = false;
    else contactCount = count ?? 0;
  } catch {
    dbUp = false;
  }

  const [clients, leads, activeSubs, openOpps, recipes, mealPlans, programs] = await Promise.all([
    safeCount(sb, 'contacts', companyId, { type: 'client' }),
    safeCount(sb, 'contacts', companyId, { type: 'lead' }),
    safeCount(sb, 'client_subscriptions', companyId, { billing_health: 'paying-current' }),
    safeCount(sb, 'opportunities', companyId, { status: 'open' }),
    safeCount(sb, 'recipes', companyId),
    safeCount(sb, 'meal_plans', companyId),
    safeCount(sb, 'programs', companyId),
  ]);

  // App accounts (profiles aren't company-scoped the same way; count by role).
  let appSubs = 0;
  try {
    const { count } = await sb
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .in('role', ['subscriber', 'free']);
    appSubs = count ?? 0;
  } catch {
    appSubs = 0;
  }

  // Last GHL sync ~ most recent opportunity update.
  let ghlLastSync: string | null = null;
  try {
    const { data } = await sb
      .from('opportunities')
      .select('updated_at')
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    ghlLastSync = (data as { updated_at?: string } | null)?.updated_at ?? null;
  } catch {
    ghlLastSync = null;
  }

  const services: ServiceCheck[] = [
    {
      key: 'database',
      name: 'Database (Supabase)',
      category: 'core',
      status: dbUp ? 'operational' : 'down',
      detail: dbUp ? `Responding · ${contactCount} contacts` : 'Probe failed',
    },
    {
      key: 'auth',
      name: 'Authentication',
      category: 'core',
      status: has('NEXT_PUBLIC_SUPABASE_URL') && has('NEXT_PUBLIC_SUPABASE_ANON_KEY') ? 'operational' : 'down',
      detail: has('SUPABASE_SERVICE_ROLE_KEY') ? 'Supabase Auth + service role wired' : 'Missing service role key',
    },
    {
      key: 'email',
      name: 'Email (Resend)',
      category: 'integration',
      status: has('RESEND_API_KEY') ? 'configured' : 'planned',
      detail: has('RESEND_API_KEY')
        ? `Sending as ${process.env.RESEND_FROM ? process.env.RESEND_FROM : 'default sender'}`
        : 'RESEND_API_KEY not set',
    },
    {
      key: 'crm_sync',
      name: 'CRM sync (GoHighLevel)',
      category: 'integration',
      // the sync route reads GHL_API_TOKEN; the waitlist client reads GHL_API_KEY
      status: has('GHL_API_TOKEN', 'GHL_API_KEY') && has('GHL_LOCATION_ID') ? 'configured' : 'planned',
      detail: has('GHL_API_TOKEN')
        ? 'Token + location set · daily auto-sync'
        : has('GHL_API_KEY')
          ? 'GHL_API_KEY set but the sync expects GHL_API_TOKEN'
          : 'GHL token not set',
    },
    {
      key: 'ai',
      name: 'AI (OpenRouter)',
      category: 'integration',
      status: has('OPENROUTER_API_KEY') ? 'configured' : 'planned',
      detail: has('OPENROUTER_API_KEY') ? 'Key set' : 'OPENROUTER_API_KEY not set',
    },
    {
      key: 'cron',
      name: 'Scheduled jobs (Vercel Cron)',
      category: 'core',
      status: has('CRON_SECRET') ? 'operational' : 'down',
      detail: has('CRON_SECRET') ? 'Secret-gated · GHL sync daily' : 'CRON_SECRET not set',
    },
    {
      key: 'payments',
      name: 'Payments (Stripe)',
      category: 'planned',
      status: has('STRIPE_SECRET_KEY') ? 'configured' : 'planned',
      detail: has('STRIPE_SECRET_KEY') ? 'Key set' : 'Not yet integrated',
    },
    {
      key: 'video',
      name: 'Video (Mux)',
      category: 'planned',
      status: has('MUX_TOKEN_ID') ? 'configured' : 'planned',
      detail: has('MUX_TOKEN_ID') ? 'Key set' : 'Not yet integrated',
    },
    {
      key: 'sms',
      name: 'SMS (Twilio)',
      category: 'planned',
      status: has('TWILIO_AUTH_TOKEN') ? 'configured' : 'planned',
      detail: has('TWILIO_AUTH_TOKEN') ? 'Key set' : 'Not yet integrated',
    },
    {
      key: 'monitoring',
      name: 'Error monitoring (Sentry)',
      category: 'planned',
      status: has('NEXT_PUBLIC_SENTRY_DSN', 'SENTRY_DSN') ? 'configured' : 'planned',
      detail: has('NEXT_PUBLIC_SENTRY_DSN', 'SENTRY_DSN') ? 'DSN set' : 'Not yet integrated',
    },
    {
      key: 'analytics',
      name: 'Product analytics (PostHog)',
      category: 'planned',
      status: has('NEXT_PUBLIC_POSTHOG_KEY') ? 'configured' : 'planned',
      detail: has('NEXT_PUBLIC_POSTHOG_KEY') ? 'Key set' : 'Not yet integrated',
    },
  ];

  const data: DataCount[] = [
    { key: 'clients', label: 'Clients', value: clients },
    { key: 'leads', label: 'Leads', value: leads },
    { key: 'activeSubs', label: 'Paying subscriptions', value: activeSubs },
    { key: 'openOpps', label: 'Open opportunities', value: openOpps },
    { key: 'recipes', label: 'Recipes', value: recipes },
    { key: 'mealPlans', label: 'Meal plans', value: mealPlans },
    { key: 'programs', label: 'Programs', value: programs },
    { key: 'appAccounts', label: 'App accounts', value: appSubs },
  ];

  return {
    services,
    data,
    automation: { ghlLastSync, ghlCron: '0 6 * * * (daily)' },
    deploy: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : null,
      env: process.env.VERCEL_ENV ?? 'development',
      region: process.env.VERCEL_REGION ?? null,
    },
    checkedAtIso: new Date().toISOString(),
  };
}
