'use client';
// The post-log coaching line. Renders under the confirmation, dismissible, never blocking.
//
// One card, four templates, chosen server-side (coach-moment.ts owns the decision ladder so photo,
// search, text and barcode logs cannot disagree about what to say). This file only picks the string
// and draws it.
//
// Renders NOTHING when there is no moment. A member with no targets yet gets silence, not an empty
// panel telling her we know nothing about her.
import { useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import type { CoachMoment } from '@/lib/nutrition/coach-moment';

export function CoachMomentCard({ moment }: { moment: CoachMoment | null | undefined }): ReactElement | null {
  // app.nutrition, matching every other nutrition component. NOT a top-level `nutrition` namespace:
  // the root layout strips only `app` from marketing pages, so strings parked outside it get shipped
  // to every anonymous visitor.
  const t = useTranslations('app.nutrition.coachMoment');
  const [dismissed, setDismissed] = useState(false);

  if (!moment || moment.kind === 'none' || dismissed) return null;

  const line = ((): string => {
    switch (moment.kind) {
      case 'protein_push':
        // The food-shaped variant only when we know one of HER foods. Otherwise the plain grams
        // line, which is still useful and never pretends to know her diet.
        return moment.foodHint
          ? t('proteinPushFood', {
              protein: moment.proteinG,
              food: moment.foodHint,
              target: moment.targetProteinG ?? 0,
            })
          : t('proteinPush', {
              protein: moment.proteinG,
              remaining: moment.remainingProteinG ?? 0,
              target: moment.targetProteinG ?? 0,
            });
      case 'protein_hit':
        return t('proteinHit', { protein: moment.proteinG, target: moment.targetProteinG ?? 0 });
      case 'kcal_watch':
        return t('kcalWatch', { kcal: moment.kcal, target: moment.targetKcal ?? 0 });
      default:
        return t('onTrack', { protein: moment.proteinG, kcal: moment.kcal });
    }
  })();

  // Protein progress, drawn only when there is a target to draw against. A bar with no denominator
  // is decoration.
  const pct =
    moment.targetProteinG && moment.targetProteinG > 0
      ? Math.min(100, Math.round((moment.proteinG / moment.targetProteinG) * 100))
      : null;

  return (
    <div role="status" className="mt-4 rounded-2xl bg-warm px-4 py-3.5">
      <p className="text-[14px] leading-[1.55] text-ink">{line}</p>

      {pct !== null && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
            {/* bg-accent is the FUNCTIONAL green (globals.css): it marks the target actually being
                met. Anything short of the target stays ink, so green never becomes decoration. */}
            <div
              className={`h-full rounded-full transition-all ${moment.kind === 'protein_hit' ? 'bg-accent' : 'bg-ink'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between text-[11px] tabular-nums text-faint">
            <span>
              {moment.proteinG}g / {moment.targetProteinG}g
            </span>
            <span>{pct}%</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="tf-press mt-3 text-[12px] font-semibold uppercase tracking-[1.2px] text-muted hover:text-ink"
      >
        {t('dismiss')}
      </button>
    </div>
  );
}
