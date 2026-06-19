// Coach overview: real KPIs + live activity + workouts-this-week chart. Coach-guarded, responsive.
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { PageTitle, SectionTitle } from '@/components/ui/section';
import { ButtonLink } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { WeekBars } from '@/components/coach/week-bars';

export const dynamic = 'force-dynamic';

type Activity = { kind: 'join' | 'workout'; name: string; ts: number };

function relTime(fromMs: number, nowMs: number, locale: string): string {
  const s = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (s < 3600) return rtf.format(-Math.round(s / 60) || 0, 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
}

export default async function CoachOverviewPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  const locale = await getLocale();
  const cid = ctx.companyId;
  const now = new Date().getTime();

  let kpi = { subs: 0, free: 0, programs: 0, forms: 0, workouts: 0 };
  let activity: Activity[] = [];
  const week: { day: string; count: number; today: boolean }[] = [];

  if (cid) {
    const supabase = createServiceClient();
    const sevenAgo = new Date(now - 6 * 86400_000);
    sevenAgo.setHours(0, 0, 0, 0);

    const [subs, free, programs, forms, workouts, joins, completions, logs] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', cid).eq('role', 'subscriber'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', cid).eq('role', 'free'),
      supabase.from('plans').select('id', { count: 'exact', head: true }).eq('company_id', cid),
      supabase.from('forms').select('id', { count: 'exact', head: true }).eq('company_id', cid),
      supabase.from('workout_logs').select('id', { count: 'exact', head: true }).eq('company_id', cid),
      supabase.from('profiles').select('full_name, email, created_at').eq('company_id', cid).in('role', ['subscriber', 'free']).order('created_at', { ascending: false }).limit(5),
      supabase.from('workout_completion_history').select('changed_at, profile:profile_id(full_name)').eq('company_id', cid).order('changed_at', { ascending: false }).limit(6),
      supabase.from('workout_logs').select('performed_at').eq('company_id', cid).gte('performed_at', sevenAgo.toISOString()),
    ]);

    kpi = {
      subs: subs.count ?? 0,
      free: free.count ?? 0,
      programs: programs.count ?? 0,
      forms: forms.count ?? 0,
      workouts: workouts.count ?? 0,
    };

    const joinActs: Activity[] = (joins.data ?? []).map((p) => ({
      kind: 'join',
      name: (p.full_name ?? p.email ?? 'A member').trim(),
      ts: new Date(p.created_at).getTime(),
    }));
    const compActs: Activity[] = (completions.data ?? []).map((row) => {
      const prof = row.profile as { full_name: string | null } | { full_name: string | null }[] | null;
      const full = Array.isArray(prof) ? prof[0]?.full_name : prof?.full_name;
      return { kind: 'workout', name: (full ?? 'A member').trim(), ts: new Date(row.changed_at).getTime() };
    });
    activity = [...joinActs, ...compActs].sort((a, b) => b.ts - a.ts).slice(0, 6);

    const narrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
    const buckets = new Map<string, number>();
    for (const row of logs.data ?? []) {
      const key = new Date(row.performed_at).toDateString();
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400_000);
      const key = d.toDateString();
      week.push({ day: narrow.format(d), count: buckets.get(key) ?? 0, today: i === 0 });
    }
  }

  const kpis: { label: string; value: number; dark?: boolean }[] = [
    { label: t('kpiActiveMembers'), value: kpi.subs + kpi.free, dark: true },
    { label: t('kpiSubscribers'), value: kpi.subs },
    { label: t('kpiFree'), value: kpi.free },
    { label: t('kpiPrograms'), value: kpi.programs },
    { label: t('kpiForms'), value: kpi.forms },
    { label: t('kpiWorkouts'), value: kpi.workouts },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-10">
      <div className="mb-7 flex items-center justify-between gap-4">
        <PageTitle>{t('overview')}</PageTitle>
        <ButtonLink href="/coach/programs/new" size="sm" className="shrink-0">
          {t('newProgram')}
        </ButtonLink>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={[
              'rounded-2xl p-5',
              k.dark ? 'bg-ink text-white' : 'bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
            ].join(' ')}
          >
            <div
              className={[
                'text-[10px] font-semibold uppercase tracking-[1px]',
                k.dark ? 'text-white/55' : 'text-faint',
              ].join(' ')}
            >
              {k.label}
            </div>
            <div className="mt-1.5 font-display text-[30px] leading-none">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Live activity + chart */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] lg:col-span-2">
          <SectionTitle className="mb-3">{t('liveActivity')}</SectionTitle>
          {activity.length === 0 ? (
            <p className="py-6 text-sm text-faint">{t('noActivity')}</p>
          ) : (
            <div>
              {activity.map((a, i) => (
                <div
                  key={i}
                  className={[
                    'flex items-center gap-3 py-3',
                    i < activity.length - 1 ? 'border-b border-divider' : '',
                  ].join(' ')}
                >
                  <Avatar size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">
                      {a.kind === 'join' ? `${a.name} joined` : `${a.name} completed a workout`}
                    </div>
                  </div>
                  <span className="shrink-0 text-[12px] text-faint">{relTime(a.ts, now, locale)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <SectionTitle className="mb-3">{t('weekActivity')}</SectionTitle>
          <WeekBars data={week} />
        </div>
      </div>
    </div>
  );
}
