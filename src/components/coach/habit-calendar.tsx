import type { ReactElement } from 'react';
import type { HabitDay } from '@/lib/coach/client-habits';

/**
 * Eight weeks of habit completion, one square a day.
 *
 * A percentage tells a coach the client is at 60%. This tells her the missing 40% is every weekend,
 * which is the thing she can actually coach. Three states, matching what Lenus shows: everything
 * done, some done, nothing done.
 *
 * Server-rendered, no interactivity: a native title on each square carries the detail, which is
 * enough for a read-only grid and costs no client JavaScript.
 */
export function HabitCalendar({
  days,
  habitCount,
  streak,
  locale,
  labels,
}: {
  days: readonly HabitDay[];
  habitCount: number;
  streak: number;
  locale: string;
  labels: { legendFull: string; legendPartial: string; legendNone: string; streak: string; ofHabits: string };
}): ReactElement | null {
  if (!days.length || !habitCount) return null;

  const fmt = (d: string): string =>
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(`${d}T00:00:00`));

  // Green ONLY for a completed day: this is a functional signal about whether the work happened,
  // which is exactly what the brand reserves it for. Partial is neutral, not amber, because a day
  // with 2 of 3 done is progress and does not deserve a warning colour.
  const cls = (state: HabitDay['state']): string =>
    state === 'full'
      ? 'bg-accent'
      : state === 'partial'
        ? 'bg-soft/45'
        : state === 'none'
          ? 'bg-warm'
          : 'bg-transparent border border-divider';

  return (
    <div className="flex flex-col gap-2.5 py-2">
      <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1">
        {days.map((d) => (
          <span
            key={d.date}
            title={`${fmt(d.date)} - ${d.state === null ? '' : `${d.done}/${d.total}`}`}
            className={`aspect-square rounded-[3px] ${cls(d.state)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-accent" /> {labels.legendFull}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-soft/45" /> {labels.legendPartial}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-warm" /> {labels.legendNone}
        </span>
        <span className="ml-auto tabular-nums">
          {habitCount} {labels.ofHabits}
          {streak > 0 && <span className="ml-2 font-semibold text-accent">{labels.streak}</span>}
        </span>
      </div>
    </div>
  );
}
