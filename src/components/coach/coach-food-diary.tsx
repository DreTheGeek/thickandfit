'use client';

// Read-only Nutrition tab for the coach client profile (Lenus parity): today's macros vs the client's
// target, a 7-day calorie chart with the target line, weekly adherence, and today's logged foods.
import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/ring';
import type { CoachDiaryWeek } from '@/lib/coach/food-diary';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
function dow(iso: string): string {
  return DOW[new Date(`${iso}T00:00:00Z`).getUTCDay()] ?? '';
}
function pct(consumed: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((consumed / target) * 100));
}

export function CoachFoodDiary({ week }: { week: CoachDiaryWeek }): ReactElement {
  const t = useTranslations('app.coach');
  const { totals, target, entries, days, loggedDays, avgKcal } = week;
  const chartMax = Math.max(target.kcal, ...days.map((d) => d.kcal), 1);

  const macros = [
    { label: t('nutKcal'), consumed: Math.round(totals.kcal), target: target.kcal, color: 'var(--color-ink)', unit: '' },
    { label: t('macroProtein'), consumed: Math.round(totals.proteinG), target: target.proteinG, color: 'var(--color-macro-protein)', unit: 'g' },
    { label: t('macroCarbs'), consumed: Math.round(totals.carbG), target: target.carbG, color: 'var(--color-macro-carbs)', unit: 'g' },
    { label: t('macroFat'), consumed: Math.round(totals.fatG), target: target.fatG, color: 'var(--color-macro-fat)', unit: 'g' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Today vs target */}
      <Card className="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">{t('nutToday')}</div>
        <div className="mt-3 space-y-3">
          {macros.map((m) => (
            <div key={m.label}>
              <div className="mb-1 flex items-baseline justify-between text-[13px]">
                <span className="font-medium">{m.label}</span>
                <span className="text-faint">
                  {m.consumed}{m.unit} <span className="text-faint">/ {m.target}{m.unit}</span>
                </span>
              </div>
              <ProgressBar pct={pct(m.consumed, m.target)} color={m.color} height={7} />
            </div>
          ))}
        </div>
      </Card>

      {/* 7-day calorie chart + weekly stats */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">{t('nutWeek')}</div>
          <div className="flex gap-4 text-[12px] text-muted">
            <span>
              {t('nutLoggedDays')} <span className="font-semibold text-ink">{loggedDays}/7</span>
            </span>
            {avgKcal != null && (
              <span>
                {t('nutAvgKcal')} <span className="font-semibold text-ink">{avgKcal}</span>
              </span>
            )}
          </div>
        </div>
        <div className="relative mt-4 flex h-32 gap-2">
          {/* target line, positioned above the ~26px weekday-label row */}
          <div
            className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-line"
            style={{ bottom: `calc(26px + ${(target.kcal / chartMax) * (100 - 20)}%)` }}
          />
          {days.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-accent/70"
                  style={{ height: `${Math.max(2, (d.kcal / chartMax) * 100)}%` }}
                  title={`${d.kcal} kcal`}
                />
              </div>
              <span className="text-[10px] text-faint">{dow(d.date)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Today's entries */}
      <Card className="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">{t('nutEntries')}</div>
        {entries.length === 0 ? (
          <p className="mt-3 text-[14px] text-faint">{t('nutNoEntries')}</p>
        ) : (
          <div className="mt-2">
            {entries.map((e, i) => (
              <div
                key={e.id}
                className={['flex items-center justify-between gap-3 py-2.5', i < entries.length - 1 ? 'border-b border-divider' : ''].join(' ')}
              >
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium">{e.name}</div>
                  <div className="text-[11px] text-faint">
                    {e.mealSlot ? `${e.mealSlot} · ` : ''}
                    {e.grams != null ? `${e.grams} g` : ''}
                  </div>
                </div>
                <div className="shrink-0 text-right text-[12px] text-muted">
                  <div className="font-semibold text-ink">{Math.round(e.kcal)} kcal</div>
                  <div>P{Math.round(e.proteinG)} · C{Math.round(e.carbG)} · F{Math.round(e.fatG)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
