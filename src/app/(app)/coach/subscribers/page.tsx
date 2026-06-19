// Coach subscribers list. Coach-guarded. Real subscribers + workout counts, client-side
// search/segment filtering, responsive table/cards.
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
    const [{ data: profiles }, { data: logs }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, role, is_legacy_client, ui_locale, created_at')
        .eq('company_id', ctx.companyId)
        .in('role', ['subscriber', 'free'])
        .order('created_at', { ascending: false }),
      supabase.from('workout_logs').select('profile_id').eq('company_id', ctx.companyId),
    ]);

    const counts = new Map<string, number>();
    for (const l of logs ?? []) counts.set(l.profile_id, (counts.get(l.profile_id) ?? 0) + 1);
    const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' });

    rows = ((profiles ?? []) as ProfileRow[]).map((p) => ({
      id: p.id,
      name: (p.full_name ?? p.email).trim(),
      email: p.email,
      role: p.role,
      legacy: p.is_legacy_client,
      locale: p.ui_locale,
      joined: fmt.format(new Date(p.created_at)),
      workouts: counts.get(p.id) ?? 0,
    }));
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
      <PageTitle className="mb-6">{t('subscribers')}</PageTitle>
      <SubscribersList rows={rows} />
    </div>
  );
}
