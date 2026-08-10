'use client';

import { useMemo, useState, useTransition, type ReactElement } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { currentPhase, parseDay, addDays, type CyclePhase } from '@/lib/cycle/phase';
import { logPeriodStartAction } from '@/lib/cycle/actions';
import type { CycleRow, CycleDayRow } from '@/lib/cycle/data';

/**
 * The month view, and the only place a period can be logged on a day that is not today.
 *
 * THE TODAY-ONLY TRAP THIS FIXES: the screen's one button logs `startedOn: today`. A period that
 * started on Saturday and gets logged on Monday was being recorded two days late, which silently
 * corrupts every cycle length derived from it, which corrupts the average, which corrupts the
 * prediction. Nobody notices, because every number still looks plausible. Tapping the actual day is
 * the fix.
 *
 * Phases are computed per day through the same currentPhase() the rest of the feature uses, rather
 * than by colouring "day 1-5 is menstrual". A member on a 40-day cycle gets her own boundaries, and
 * a member with no history gets no colour at all instead of a confident wrong one.
 */
const PHASE_TINT: Record<Exclude<CyclePhase, 'unknown'>, string> = {
  // Menstrual is the only one that gets a fill strong enough to read as "this is happening now".
  // The other three are a wash: they are context, not events, and four saturated bands across a
  // month is a heat map nobody can read.
  menstrual: 'bg-alert-bg',
  follicular: 'bg-warm/50',
  ovulation: 'bg-accent/15',
  luteal: 'bg-warm/25',
};

function monthMatrix(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  // Monday-first. Sunday is 0 from getUTCDay, which would put it at the start of the week.
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) {
    cells.push(new Date(Date.UTC(year, month, d)).toISOString().slice(0, 10));
  }
  return cells;
}

export function CycleCalendar({
  logs,
  days,
  today,
}: {
  logs: CycleRow[];
  days: CycleDayRow[];
  today: string;
}): ReactElement {
  const t = useTranslations('app.cycle');
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cursor, setCursor] = useState(() => today.slice(0, 7)); // YYYY-MM
  const [selected, setSelected] = useState<string | null>(null);

  const [year, month] = useMemo(() => {
    const [y, m] = cursor.split('-').map(Number);
    return [y, m - 1];
  }, [cursor]);

  const cells = useMemo(() => monthMatrix(year, month), [year, month]);
  const logged = useMemo(() => new Set(days.map((d) => d.loggedOn)), [days]);

  // Days covered by a logged period, so bleeding shows as a run rather than one marked start.
  const bleeding = useMemo(() => {
    const s = new Set<string>();
    for (const l of logs) {
      // An open period (no end date) is shown as five days, the population median, rather than
      // running to today: a member who forgot to close one in March should not see six months of red.
      const end = l.endedOn ?? addDays(l.startedOn, 4);
      for (let d = l.startedOn; parseDay(d) <= parseDay(end); d = addDays(d, 1)) s.add(d);
    }
    return s;
  }, [logs]);

  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month, 1)),
  );
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
    // 2024-01-01 was a Monday, which anchors the Monday-first header to the locale's own letters.
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2024, 0, 1 + i))));
  }, [locale]);

  const shift = (by: number): void => {
    const d = new Date(Date.UTC(year, month + by, 1));
    setCursor(d.toISOString().slice(0, 7));
    setSelected(null);
  };

  function logStart(day: string): void {
    start(async () => {
      const res = await logPeriodStartAction({ startedOn: day });
      if (res.ok) {
        setSelected(null);
        router.refresh();
      }
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} aria-label={t('prevMonth')} className="tf-press rounded-full p-2 text-muted hover:text-ink">
          <Icon name="chevronLeft" size={16} />
        </button>
        <span className="text-[14px] font-semibold capitalize text-ink">{monthLabel}</span>
        <button type="button" onClick={() => shift(1)} aria-label={t('nextMonth')} className="tf-press rounded-full p-2 text-muted hover:text-ink">
          <Icon name="chevronRight" size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-faint">
        {weekdays.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <span key={`pad-${i}`} />;
          const isFuture = parseDay(day) > parseDay(today);
          const phase = currentPhase(logs, day).phase;
          const tint = bleeding.has(day)
            ? PHASE_TINT.menstrual
            : phase !== 'unknown' && !isFuture
              ? PHASE_TINT[phase]
              : '';
          return (
            <button
              key={day}
              type="button"
              // A future day cannot have had a period or a symptom. Leaving it tappable invites a
              // mis-tap that poisons the cycle history with a start date that has not happened.
              disabled={isFuture}
              onClick={() => setSelected(selected === day ? null : day)}
              aria-pressed={selected === day}
              className={[
                'relative flex h-10 items-center justify-center rounded-lg text-[13px] tabular-nums',
                tint,
                isFuture ? 'text-faint/40' : 'tf-press text-ink',
                day === today ? 'ring-1 ring-ink' : '',
                selected === day ? 'ring-2 ring-ink' : '',
              ].join(' ')}
            >
              {Number(day.slice(8, 10))}
              {/* A dot means "she wrote something that day", distinct from the phase wash behind it. */}
              {logged.has(day) && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-ink" />}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="flex flex-col gap-2 border-t border-divider pt-3">
          <span className="text-[12px] text-muted">
            {new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(
              new Date(`${selected}T00:00:00Z`),
            )}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => logStart(selected)}
            className="tf-press rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-ink disabled:opacity-50"
          >
            {pending ? '…' : t('periodStartedThisDay')}
          </button>
        </div>
      )}

      <p className="text-[11px] leading-[1.5] text-faint">{t('calendarHint')}</p>
    </Card>
  );
}
