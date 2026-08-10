import 'server-only';
// Cycle-log reads. Thin on purpose: every derived number (average length, next start, current phase)
// comes from the pure math in ./phase.ts, so nothing derived is ever stored and a corrected start
// date instantly fixes the whole picture.
//
// On the privacy boundary: 0097's RLS is member-only, so the coach CONSOLE cannot browse this. The
// function below runs with the service client for one specific member, and its only consumer is that
// member's own coach context. Her assistant answering "why am I so hungry this week?" with her own
// data is the point of tracking it. Staff browsing it is not, and RLS still prevents that.
import { createServiceClient } from '@/lib/supabase/service';
import { currentPhase, cycleStats, type CycleLog, type PhaseInfo } from '@/lib/cycle/phase';

export type CycleRow = CycleLog & {
  id: string;
  flow: 'light' | 'medium' | 'heavy' | null;
  notes: string | null;
};

/** Recent periods, newest first. 24 is two years of history, plenty for the averages. */
export async function loadCycleLogs(profileId: string, limit = 24): Promise<CycleRow[]> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('cycle_logs')
    .select('id, started_on, ended_on, flow, notes')
    .eq('profile_id', profileId)
    .order('started_on', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('loadCycleLogs:', error.message);
    return [];
  }
  return ((data ?? []) as { id: string; started_on: string; ended_on: string | null; flow: string | null; notes: string | null }[]).map(
    (r) => ({
      id: r.id,
      startedOn: r.started_on,
      endedOn: r.ended_on,
      flow: (r.flow as CycleRow['flow']) ?? null,
      notes: r.notes,
    }),
  );
}

export type CycleDay = { symptoms: string[]; moods: string[]; energy: number | null };

/** A logged day, with its date, for the calendar. */
export type CycleDayRow = CycleDay & { loggedOn: string };

/**
 * Every logged day in the recent window.
 *
 * Loaded whole rather than a month at a time. Six months of day logs is at most ~180 small rows,
 * which is far cheaper than a round trip every time she pages the calendar back, and it means
 * scrolling through her history is instant instead of a spinner per month.
 */
export async function loadCycleDays(profileId: string, since: string): Promise<CycleDayRow[]> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('cycle_day_logs')
    .select('logged_on, symptoms, moods, energy')
    .eq('profile_id', profileId)
    .gte('logged_on', since)
    .order('logged_on', { ascending: false })
    .limit(400);
  if (error) {
    console.error('loadCycleDays:', error.message);
    return [];
  }
  return ((data ?? []) as { logged_on: string; symptoms: string[] | null; moods: string[] | null; energy: number | null }[]).map(
    (r) => ({ loggedOn: r.logged_on, symptoms: r.symptoms ?? [], moods: r.moods ?? [], energy: r.energy }),
  );
}

export type CycleSummary = {
  logs: CycleRow[];
  phase: PhaseInfo;
  averageLength: number | null;
  isIrregular: boolean;
  predictedNextStart: string | null;
  predictedRange: { from: string; to: string } | null;
  /** Today's entry, so the logger opens on what she already saved rather than blank. */
  todayLog: CycleDay | null;
  /** Six months of logged days, for the calendar. Loaded whole so paging back is instant. */
  days: CycleDayRow[];
};

/** Everything the cycle screen renders. `today` is injected so the caller owns the clock read. */
export async function loadCycleSummary(profileId: string, today: string): Promise<CycleSummary> {
  const logs = await loadCycleLogs(profileId);
  const stats = cycleStats(logs);
  const since = new Date(Date.parse(today + 'T00:00:00Z') - 183 * 86400000).toISOString().slice(0, 10);
  const days = await loadCycleDays(profileId, since);
  const sb = createServiceClient();
  const { data: dayRow } = await sb
    .from('cycle_day_logs')
    .select('symptoms, moods, energy')
    .eq('profile_id', profileId)
    .eq('logged_on', today)
    .maybeSingle<{ symptoms: string[] | null; moods: string[] | null; energy: number | null }>();
  return {
    logs,
    phase: currentPhase(logs, today),
    averageLength: stats.averageLength,
    isIrregular: stats.isIrregular,
    predictedNextStart: stats.predictedNextStart,
    predictedRange: stats.predictedRange,
    todayLog: dayRow ? { symptoms: dayRow.symptoms ?? [], moods: dayRow.moods ?? [], energy: dayRow.energy } : null,
    days,
  };
}
