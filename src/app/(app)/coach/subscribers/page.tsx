// Coach members list: app accounts (profiles), coach-guarded. Real subscribers + workout counts,
// client-side search/segment filtering, responsive table/cards.
//
// Not the same population as /coach/clients, which reads `contacts` (the Lenus + GHL CRM). A woman
// who signs up and stops before finishing setup has a profile and no contact row, so this is the only
// place she is visible. Not the same page as /admin/subscribers either: that one unions native Stripe
// subscriptions with the CRM imports to answer "who is paying", and deep-links back into
// /coach/subscribers/[id] as the canonical member record.
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { PageTitle } from '@/components/ui/section';
import { SubscribersList, type CoachSubscriber } from '@/components/coach/subscribers-list';

export const dynamic = 'force-dynamic';

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  is_legacy_client: boolean;
  ui_locale: string;
  created_at: string;
};

export default async function CoachSubscribersPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  const locale = await getLocale();

  let rows: CoachSubscriber[] = [];
  if (ctx.companyId) {
    const supabase = createServiceClient();
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, is_legacy_client, ui_locale, created_at')
      .eq('company_id', ctx.companyId)
      .in('role', ['subscriber', 'free'])
      .order('created_at', { ascending: false });

    // Per-profile workout counts in ONE round trip (was N+1: a COUNT per subscriber). Fetch the
    // company's workout_logs profile_ids once and tally in memory. If the log volume ever grows large,
    // move this to a grouped-aggregate RPC; at the current scale one indexed read is cheaper than N.
    const profileRows = (profiles ?? []) as ProfileRow[];
    const { data: logRows } = await supabase
      .from('workout_logs')
      .select('profile_id')
      .eq('company_id', ctx.companyId);
    const counts = new Map<string, number>();
    for (const row of (logRows ?? []) as { profile_id: string | null }[]) {
      if (row.profile_id) counts.set(row.profile_id, (counts.get(row.profile_id) ?? 0) + 1);
    }
    const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' });

    rows = profileRows.map((p) => ({
      id: p.id,
      name: (p.full_name ?? p.email ?? '').trim() || t('noName'),
      email: p.email,
      role: p.role,
      legacy: p.is_legacy_client,
      locale: p.ui_locale,
      joined: fmt.format(new Date(p.created_at)),
      workouts: counts.get(p.id) ?? 0,
    }));
  }

  return (
    <div>
      <PageTitle className="mb-2">{t('navMembers')}</PageTitle>
      <p className="mb-6 max-w-[68ch] text-[13px] leading-relaxed text-faint">{t('membersSubtitle')}</p>
      <SubscribersList rows={rows} />
    </div>
  );
}
