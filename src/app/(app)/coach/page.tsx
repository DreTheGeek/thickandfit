// Admin Home / command center. Real KPIs + live activity + workouts chart + team + planner.
// Honest placeholders for metrics that need analytics we haven't wired yet (traffic/NPS/etc.).
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { SectionTitle } from '@/components/ui/section';
import { Avatar } from '@/components/ui/avatar';
import { WeekBars } from '@/components/coach/week-bars';
import { HomePlanner, type PlannerDay } from '@/components/coach/home-planner';

export const dynamic = 'force-dynamic';

type Activity = { kind: 'join' | 'workout'; name: string; ts: number };

function relTime(fromMs: number, nowMs: number, locale: string): string {
  const s = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (s < 3600) return rtf.format(-Math.round(s / 60) || 0, 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
}

export default async function CoachHomePage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  const locale = await getLocale();
  const cid = ctx.companyId;
  const now = new Date().getTime();

  // Coach name
  const ownSupabase = await createClient();
  const { data: me } = await ownSupabase
    .from('profiles')
    .select('full_name')
    .eq('id', ctx.userId)
    .maybeSingle();
  const firstName = (me?.full_name ?? '').trim().split(/\s+/)[0] || 'Coach';

  let kpi = { subs: 0, free: 0, programs: 0, forms: 0, workouts: 0 };
  let activity: Activity[] = [];
  let team: string[] = [];
  const week: { day: string; count: number; today: boolean }[] = [];

  if (cid) {
    const supabase = createServiceClient();
    const sevenAgo = new Date(now - 6 * 86400_000);
    sevenAgo.setHours(0, 0, 0, 0);

    const [subs, free, programs, forms, workouts, joins, completions, logs, teamRows] =
      await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', cid).eq('role', 'subscriber'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', cid).eq('role', 'free'),
        supabase.from('plans').select('id', { count: 'exact', head: true }).eq('company_id', cid),
        supabase.from('forms').select('id', { count: 'exact', head: true }).eq('company_id', cid),
        supabase.from('workout_logs').select('id', { count: 'exact', head: true }).eq('company_id', cid),
        supabase.from('profiles').select('full_name, email, created_at').eq('company_id', cid).in('role', ['subscriber', 'free']).order('created_at', { ascending: false }).limit(5),
        supabase.from('workout_completion_history').select('changed_at, profile:profile_id(full_name)').eq('company_id', cid).order('changed_at', { ascending: false }).limit(6),
        supabase.from('workout_logs').select('performed_at').eq('company_id', cid).gte('performed_at', sevenAgo.toISOString()),
        supabase.from('profiles').select('full_name, email').eq('company_id', cid).in('role', ['coach', 'assistant_coach', 'operator']).order('created_at', { ascending: true }),
      ]);

    kpi = {
      subs: subs.count ?? 0,
      free: free.count ?? 0,
      programs: programs.count ?? 0,
      forms: forms.count ?? 0,
      workouts: workouts.count ?? 0,
    };
    team = (teamRows.data ?? []).map((r) => (r.full_name ?? r.email ?? 'Team member').trim());

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
      week.push({ day: narrow.format(d), count: buckets.get(d.toDateString()) ?? 0, today: i === 0 });
    }
  }

  const totalClients = kpi.subs + kpi.free;
  const kpis = [
    { label: t('kpiActiveMembers'), value: totalClients, dark: true },
    { label: t('kpiSubscribers'), value: kpi.subs },
    { label: t('kpiFree'), value: kpi.free },
    { label: t('kpiPrograms'), value: kpi.programs },
    { label: t('kpiForms'), value: kpi.forms },
    { label: t('kpiWorkouts'), value: kpi.workouts },
  ];
  const placeholders = [t('websiteTraffic'), t('conversion'), t('avgLifetime'), t('nps')];

  // Planner week + date label
  const nowDate = new Date(now);
  const startOfWeek = new Date(nowDate);
  startOfWeek.setDate(nowDate.getDate() - nowDate.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  const narrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  const weekDays: PlannerDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return { key: String(i), label: narrow.format(d), day: d.getDate(), isToday: d.toDateString() === nowDate.toDateString() };
  });
  const md = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  const rangeLabel = `${md.format(startOfWeek)} - ${md.format(endOfWeek)}, ${nowDate.getFullYear()}`;
  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(nowDate);

  return (
    <div className="flex flex-col xl:flex-row">
      <div className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:py-10">
        <h1 className="tf-display text-[34px]">{t('welcomeBack', { name: firstName })}</h1>
        <p className="mb-7 mt-1 text-sm text-faint">{dateLabel}</p>

        {/* KPIs */}
        <div className="mb-4 grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-6">
          {kpis.map((k) => (
            <div
              key={k.label}
              className={[
                'rounded-2xl p-5',
                k.dark ? 'bg-ink text-white' : 'bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
              ].join(' ')}
            >
              <div className={['text-[10px] font-semibold uppercase tracking-[1px]', k.dark ? 'text-white/55' : 'text-faint'].join(' ')}>
                {k.label}
              </div>
              <div className="mt-1.5 font-display text-[30px] leading-none">{k.value}</div>
            </div>
          ))}
        </div>

        {/* Analytics placeholders (need connected analytics) */}
        <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {placeholders.map((label) => (
            <div key={label} className="rounded-2xl bg-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <div className="text-[10px] font-semibold uppercase tracking-[1px] text-faint">{label}</div>
              <div className="mt-1.5 font-display text-[26px] leading-none text-line">--</div>
              <div className="mt-1 text-[11px] text-faint">{t('needsConnect')}</div>
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
              activity.map((a, i) => (
                <div key={i} className={['flex items-center gap-3 py-3', i < activity.length - 1 ? 'border-b border-divider' : ''].join(' ')}>
                  <Avatar size={32} />
                  <div className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                    {a.kind === 'join' ? `${a.name} joined` : `${a.name} completed a workout`}
                  </div>
                  <span className="shrink-0 text-[12px] text-faint">{relTime(a.ts, now, locale)}</span>
                </div>
              ))
            )}
          </div>
          <div className="rounded-2xl bg-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <SectionTitle className="mb-3">{t('weekActivity')}</SectionTitle>
            <WeekBars data={week} />
          </div>
        </div>

        {/* Clients per team member */}
        {team.length > 0 && (
          <div className="mt-4 rounded-2xl bg-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <SectionTitle className="mb-4">{t('clientsPerTeam')}</SectionTitle>
            <div className="flex flex-col gap-3">
              {team.map((name) => (
                <div key={name} className="flex items-center gap-4">
                  <span className="w-28 shrink-0 truncate text-[13px] font-medium">{name}</span>
                  <span className="h-3 flex-1 overflow-hidden rounded-full bg-warm">
                    <span className="block h-3 rounded-full bg-accent" style={{ width: '100%' }} />
                  </span>
                  <span className="w-8 shrink-0 text-right text-[13px] font-semibold">{totalClients}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <HomePlanner rangeLabel={rangeLabel} weekDays={weekDays} />
    </div>
  );
}
