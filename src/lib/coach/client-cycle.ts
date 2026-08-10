import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { cycleStats, currentPhase, type CycleLog, type CyclePhase } from '@/lib/cycle/phase';

/**
 * What the coach may see of a member's cycle.
 *
 * EVERY READ GOES THROUGH coach_cycle_window (0123), a SECURITY DEFINER function that filters on
 * shares_with_coach. That is deliberate: cycle_logs is owner-only and rls-isolation-test.cjs
 * asserts it, so widening the table policy to let a coach in would weaken the guarantee for every
 * other reader. Because the filter is inside the function, a member who turns sharing off makes
 * this return nothing at all, rather than returning rows that the UI then politely declines to
 * draw. The difference matters the day someone writes a second UI.
 */

export type CoachCycleView = {
  shared: boolean;
  phase: CyclePhase;
  dayOfCycle: number | null;
  isIrregular: boolean;
  /** Only ever set when the history is regular enough to justify a date. */
  predictedNextStart: string | null;
  lastPeriodStart: string | null;
  /** Counts since the window opened, most frequent first. */
  symptoms: { key: string; count: number }[];
  moods: { key: string; count: number }[];
  daysLogged: number;
};

type Row = {
  logged_on: string;
  symptoms: string[] | null;
  moods: string[] | null;
  energy: number | null;
  period_started_on: string | null;
  period_ended_on: string | null;
  flow: string | null;
};

export async function loadCoachCycle(
  profileId: string | null,
  companyId: string,
  since: string,
  today: string,
): Promise<CoachCycleView | null> {
  // Cycle data is keyed by profile. A migrated client who has never claimed an account has no
  // profile and therefore nothing here, which is a real state and not an error.
  if (!profileId) return null;

  const sb = createServiceClient();
  const { data, error } = await sb.rpc('coach_cycle_window', {
    p_profile_id: profileId,
    p_company_id: companyId,
    p_since: since,
  });
  if (error) {
    console.error('[loadCoachCycle]', error.message);
    return null;
  }

  const rows = (data ?? []) as Row[];
  // No rows means either "she shares nothing" or "she has logged nothing". Both render as the same
  // empty state, and we deliberately do not distinguish them to the coach: telling her that a
  // member has turned sharing off is itself a disclosure about that member.
  if (rows.length === 0) return null;

  const periods: CycleLog[] = rows
    .filter((r) => r.period_started_on)
    .map((r) => ({ startedOn: r.period_started_on as string, endedOn: r.period_ended_on }));

  const tally = (pick: (r: Row) => string[] | null): { key: string; count: number }[] => {
    const m = new Map<string, number>();
    for (const r of rows) for (const v of pick(r) ?? []) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  };

  const stats = cycleStats(periods);
  const phase = currentPhase(periods, today);

  return {
    shared: true,
    phase: phase.phase,
    dayOfCycle: phase.cycleDay,
    isIrregular: stats.isIrregular,
    // Withheld when irregular, matching what the member is shown. A coach quoting a date the member
    // was never given would be worse than saying nothing.
    predictedNextStart: stats.isIrregular ? null : stats.predictedNextStart,
    lastPeriodStart: periods.length ? periods[periods.length - 1].startedOn : null,
    symptoms: tally((r) => r.symptoms),
    moods: tally((r) => r.moods),
    daysLogged: rows.filter((r) => (r.symptoms?.length ?? 0) > 0 || (r.moods?.length ?? 0) > 0).length,
  };
}
