// Habits data layer. Coach-assigned daily habits + the client's per-day completion. Read by the
// dashboard "things to do" row. Owner/coach RLS scopes the rows; reads run on the server client.
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { localDay } from '@/lib/datetime/local-day';

export type TodayHabit = {
  id: string;
  title: string;
  icon: string;
  targetCount: number;
  done: boolean;
};

/**
 * The user's LOCAL calendar day (YYYY-MM-DD). WP11 made this timezone-aware: habit completion is a
 * per-day toggle, so an evening logger must check off TODAY, not roll into tomorrow at UTC midnight.
 */
export function localToday(timeZone: string | null | undefined): string {
  return localDay(timeZone);
}

/** The caller's active habits for `date`, each flagged with whether it is already done that day. */
export async function getTodayHabits(profileId: string, date: string): Promise<TodayHabit[]> {
  const sb = await createClient();
  const { data: habits } = await sb
    .from('habits')
    .select('id, title, icon, target_count')
    .eq('profile_id', profileId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  const rows =
    (habits as { id: string; title: string; icon: string; target_count: number }[] | null) ?? [];
  if (rows.length === 0) return [];

  const { data: logs } = await sb
    .from('habit_logs')
    .select('habit_id, done')
    .eq('profile_id', profileId)
    .eq('logged_date', date);
  const doneSet = new Set(
    ((logs as { habit_id: string; done: boolean }[] | null) ?? [])
      .filter((l) => l.done)
      .map((l) => l.habit_id),
  );

  return rows.map((h) => ({
    id: h.id,
    title: h.title,
    icon: h.icon,
    targetCount: h.target_count,
    done: doneSet.has(h.id),
  }));
}
