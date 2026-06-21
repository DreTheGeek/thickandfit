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
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, is_legacy_client, ui_locale, created_at')
      .eq('company_id', ctx.companyId)
      .in('role', ['subscriber', 'free'])
      .order('created_at', { ascending: false });

    // Per-profile workout counts via head-only COUNT queries (DB-side aggregate). This avoids
    // pulling the entire workout_logs table into app memory just to tally rows per profile.
    const profileRows = (profiles ?? []) as ProfileRow[];
    const countPairs = await Promise.all(
      profileRows.map(async (p): Promise<[string, number]> => {
        const { count } = await supabase
          .from('workout_logs')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', ctx.companyId!)
          .eq('profile_id', p.id);
        return [p.id, count ?? 0];
      }),
    );
    const counts = new Map<string, number>(countPairs);
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
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
      <PageTitle className="mb-6">{t('subscribers')}</PageTitle>
      <SubscribersList rows={rows} />
    </div>
  );
}
