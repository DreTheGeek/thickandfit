import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { isAtRisk } from '@/lib/coach/overview';

/**
 * What is waiting on her, counted once, on the page she opens first.
 *
 * The work already had pages: /coach/awaiting, /coach/intake, /coach/approvals. The problem is that
 * a queue you have to remember to visit is a queue that grows. Her Lenus home surfaces the same
 * idea, and on the live database the answer is not small: 116 clients have no meal plan at all.
 *
 * COUNTS AND LINKS, not a fourth implementation of each list. Duplicating the queries here would
 * mean two definitions of "needs a plan" that drift, and the number on the home page disagreeing
 * with the page it links to is worse than no number.
 */

export type AttentionItem = {
  key: 'noPlan' | 'intake' | 'atRisk' | 'unanswered';
  count: number;
  href: string;
};

export async function getAttention(companyId: string): Promise<AttentionItem[]> {
  const sb = createServiceClient();

  const [clientsRes, plansRes, intakeRes, riskRes, msgRes] = await Promise.all([
    sb.from('contacts').select('id').eq('company_id', companyId).eq('type', 'client').limit(5000),
    sb.from('meal_plans').select('contact_id').eq('company_id', companyId).not('contact_id', 'is', null).limit(5000),
    sb
      .from('client_intake')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('needs_coach_review', true),
    // THE SAME DEFINITION THE KPI TILE USES, imported rather than restated. Written by hand this
    // counted only billing_health and returned 9 while the tile above it read 39, because the tile
    // also counts past_due and unpaid statuses. Two numbers for "at risk" on one screen is worse
    // than one, and it is the precise failure this module's header warns about.
    sb
      .from('client_subscriptions')
      .select('status, billing_health')
      .eq('company_id', companyId)
      .limit(20000),
    // A message from the client with nothing from the coach after it is the one that actually
    // costs a renewal. Counted over 14 days: older than that is not "unanswered", it is lost.
    sb
      .from('client_messages')
      .select('contact_id, sent_at, is_from_coach')
      .eq('company_id', companyId)
      .gte('sent_at', new Date(Date.now() - 14 * 86_400_000).toISOString())
      .order('sent_at', { ascending: false })
      .limit(2000),
  ]);

  const withPlan = new Set(
    ((plansRes.data ?? []) as { contact_id: string | null }[]).map((r) => r.contact_id).filter(Boolean) as string[],
  );
  const noPlan = ((clientsRes.data ?? []) as { id: string }[]).filter((c) => !withPlan.has(c.id)).length;

  // Newest message per contact wins: if it is from the client, nobody has replied.
  const latest = new Map<string, boolean>();
  for (const m of (msgRes.data ?? []) as { contact_id: string | null; is_from_coach: boolean | null }[]) {
    if (!m.contact_id || latest.has(m.contact_id)) continue;
    latest.set(m.contact_id, Boolean(m.is_from_coach));
  }
  const unanswered = [...latest.values()].filter((fromCoach) => !fromCoach).length;

  const atRisk = ((riskRes.data ?? []) as { status: string | null; billing_health: string | null }[]).filter((r) =>
    isAtRisk(r.status, r.billing_health),
  ).length;

  const items: AttentionItem[] = [
    { key: 'unanswered', count: unanswered, href: '/coach/inbox' },
    { key: 'intake', count: intakeRes.count ?? 0, href: '/coach/intake' },
    { key: 'noPlan', count: noPlan, href: '/coach/awaiting' },
    { key: 'atRisk', count: atRisk, href: '/coach/billing' },
  ];

  // Only what is actually waiting. A row reading 0 trains the eye to skip the whole block, and this
  // block only works if its presence means something.
  return items.filter((i) => i.count > 0);
}
