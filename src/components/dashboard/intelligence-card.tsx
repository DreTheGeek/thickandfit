// K9: the intelligence strip on the Today screen.
//
// Server component on purpose: everything here is derived server-side and rendered once. There is no
// interactivity, so shipping it as a client component would only add JS to the most-visited screen.
//
// Editorial rule this follows: SAY NOTHING RATHER THAN SAY SOMETHING WEAK. Each block renders only
// when its underlying engine cleared its own confidence guards (K7 needs a real weight trend, K8
// needs enough logged days and a good/bad contrast). A "coach intelligence" panel that pads itself
// with generic encouragement teaches members to ignore the panel.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import type { MemberPrediction } from '@/lib/prediction/read';
import type { MealIntelligence } from '@/lib/intelligence/meal-recs';

export async function IntelligenceCard({
  prediction,
  meals,
}: {
  prediction: MemberPrediction | null;
  meals: MealIntelligence | null;
}): Promise<ReactElement | null> {
  const t = await getTranslations('app.intelligence');

  const goal = prediction?.goal ?? null;
  const pace = prediction?.pace ?? null;
  // Only show a projection the engine itself vouched for. It sets goalDateIso to null for plateau,
  // wrong-direction, no-trend and too-far-out, and reports the reason; projecting a date anyway would
  // be fiction. `stale` means the nightly snapshot is >48h old, which is also not worth asserting.
  const showGoal = Boolean(goal?.goalDateIso) && !prediction?.stale;
  // Protein pace only, and only when it is neither unknown nor flagged low-confidence (<5 logging
  // days in 30). A verdict off two logged days is noise wearing a badge.
  const showPace = Boolean(pace && pace.protein !== 'unknown' && !pace.lowConfidence);
  const top = meals?.recs?.[0] ?? null;

  if (!showGoal && !showPace && !top) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <span className="text-ink">
          <Icon name="sparkles" size={16} strokeWidth={2.2} />
        </span>
        <h2 className="text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">
          {t('title')}
        </h2>
      </div>

      <div className="mt-3 flex flex-col gap-3.5">
        {showGoal && goal?.goalDateIso ? (
          <div>
            <div className="font-display text-[20px] leading-tight">
              {t('goalEta', { date: formatMonthDay(goal.goalDateIso) })}
            </div>
            <p className="mt-0.5 text-[13px] leading-[1.5] text-soft">
              {t('goalEtaWhy', { weekly: Math.abs(goal.weeklyKg ?? 0).toFixed(1) })}
            </p>
          </div>
        ) : null}

        {showPace && pace ? (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[14px]">{t(`pace.${pace.protein}`)}</span>
            <span className="shrink-0 text-[13px] tabular-nums text-muted">
              {t('proteinAvg', {
                have: Math.round(pace.avgProteinG ?? 0),
                target: Math.round(pace.targetProteinG ?? 0),
              })}
            </span>
          </div>
        ) : null}

        {top ? (
          <div className="rounded-[12px] bg-warm px-4 py-3">
            <div className="text-[13px] font-semibold text-ink">{t('mealTitle')}</div>
            <p className="mt-0.5 text-[13px] leading-[1.5] text-soft">
              {/* The reason is the whole value: not "eat this" but "this is on X% of the days you
                  hit your protein". Advice she can check against her own history. */}
              {t('mealWhy', {
                food: top.food,
                pct: Math.round(top.goodDayRate * 100),
              })}
            </p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/** "2026-09-27" -> "Sep 27". UTC-pinned so a date-only value cannot slip a day. */
function formatMonthDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
