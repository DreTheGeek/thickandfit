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

export type CycleSummary = {
  logs: CycleRow[];
  phase: PhaseInfo;
  averageLength: number | null;
  isIrregular: boolean;
  predictedNextStart: string | null;
  predictedRange: { from: string; to: string } | null;
  /** Today's entry, so the logger opens on what she already saved rather than blank. */
  todayLog: CycleDay | null;
};

/** Everything the cycle screen renders. `today` is injected so the caller owns the clock read. */
export async function loadCycleSummary(profileId: string, today: string): Promise<CycleSummary> {
  const logs = await loadCycleLogs(profileId);
  const stats = cycleStats(logs);
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
  };
}
