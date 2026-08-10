import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * A client's habit completion, day by day.
 *
 * Lenus shows a coach a calendar with three states per day: everything done, some done, nothing
 * done. That distinction is the whole value. A percentage says a client is at 60%; a calendar shows
 * her that the 40% is every Saturday and Sunday, which is a conversation rather than a number.
 *
 * NOT-STARTED and PARTIAL are genuinely different from NO-DATA, and this keeps them apart. A day
 * before the client had any habits assigned is blank, not a failure: colouring pre-history red
 * would invent a relapse out of the absence of a feature.
 */

export type HabitDay = {
  date: string;
  done: number;
  total: number;
  /** 'full' | 'partial' | 'none' | null, where null means the day predates any habit. */
  state: 'full' | 'partial' | 'none' | null;
};

export type ClientHabits = {
  days: HabitDay[];
  habitCount: number;
  /** Consecutive days ending today (or yesterday) with everything done. */
  streak: number;
};

const WINDOW_DAYS = 56; // eight weeks reads as a block of full rows in a 7-wide grid.

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getClientHabits(companyId: string, profileId: string): Promise<ClientHabits> {
  const sb = createServiceClient();

  const [{ data: habits }, { data: logs }] = await Promise.all([
    // Active only. An archived habit still counts toward `total` otherwise, so every day would read
    // "partial" forever and the calendar would show a client failing at something she was told to
    // stop doing.
    sb
      .from('habits')
      .select('id, created_at')
      .eq('company_id', companyId)
      .eq('profile_id', profileId)
      .eq('is_active', true),
    (async () => {
      const from = new Date();
      from.setUTCDate(from.getUTCDate() - (WINDOW_DAYS - 1));
      return sb
        .from('habit_logs')
        .select('logged_date, done, habit_id')
        .eq('company_id', companyId)
        .eq('profile_id', profileId)
        .gte('logged_date', isoDay(from))
        .limit(2000);
    })(),
  ]);

  const habitRows = (habits ?? []) as { id: string; created_at: string }[];
  const habitCount = habitRows.length;
  if (!habitCount) return { days: [], habitCount: 0, streak: 0 };

  // The earliest habit's creation date bounds "no data": before it, the client had nothing to do.
  const earliest = habitRows.map((h) => h.created_at.slice(0, 10)).sort()[0];

  const doneByDate = new Map<string, number>();
  for (const l of (logs ?? []) as { logged_date: string; done: boolean }[]) {
    if (!l.done) continue;
    doneByDate.set(l.logged_date, (doneByDate.get(l.logged_date) ?? 0) + 1);
  }

  const days: HabitDay[] = [];
  const today = new Date();
  for (let i = WINDOW_DAYS - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const date = isoDay(d);
    const done = doneByDate.get(date) ?? 0;
    const state: HabitDay['state'] =
      date < earliest ? null : done === 0 ? 'none' : done >= habitCount ? 'full' : 'partial';
    days.push({ date, done, total: habitCount, state });
  }

  // Streak counts back from the most recent day, and TODAY not being finished yet does not break
  // it: at 9am a client has done nothing and is not on a broken streak, she is mid-morning.
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const d = days[i];
    if (i === days.length - 1 && d.state !== 'full') continue;
    if (d.state === 'full') streak += 1;
    else break;
  }

  return { days, habitCount, streak };
}
