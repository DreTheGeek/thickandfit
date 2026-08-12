'use client';

import { useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { StructuredPlanView } from '@/components/nutrition/structured-plan-view';
import type { PlanSlot } from '@/lib/coach/meal-plan-structured';

/**
 * What the client will actually see, before it is sent.
 *
 * THE SAME COMPONENT THE MEMBER RENDERS, deliberately. A second "preview" renderer is a second
 * thing to keep in step, and it drifts the first time someone changes one and not the other. Then
 * the preview is worse than none, because it is confidently wrong: a coach checks it, sends the
 * plan, and the client sees something else.
 *
 * It renders the DRAFT in memory rather than reloading from the database, so a coach can check her
 * work before saving instead of having to save something half-written to look at it.
 */
export function PlanPreview({
  name,
  slots,
  goal,
  calorieTarget,
  macros,
}: {
  name: string;
  slots: PlanSlot[];
  goal: string | null;
  calorieTarget: number | null;
  macros: { proteinG: number; carbG: number; fatG: number };
}): ReactElement | null {
  const t = useTranslations('app.coach');
  const [open, setOpen] = useState(false);

  // A slot with no recipes renders nothing in the member view, so a plan with none is a blank
  // screen. Better to say there is nothing to preview than to open an empty sheet.
  const hasContent = slots.some((s) => s.recipes.some((r) => r.title.trim().length > 0));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!hasContent}
        title={hasContent ? undefined : t('mbPreviewEmpty')}
        className="tf-press rounded-full border border-line px-4 py-2.5 text-[13px] font-semibold text-muted hover:border-ink hover:text-ink disabled:opacity-40"
      >
        {t('mbPreview')}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={t('mbPreview')}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[560px] rounded-2xl bg-bg p-6 shadow-xl"
            // Clicks inside must not close it: a coach scrolling a long plan will click the sheet.
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                  {t('mbPreviewLabel')}
                </div>
                <div className="tf-display text-[20px]">{name || t('mbUntitled')}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="tf-press rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink"
              >
                {t('mbPreviewClose')}
              </button>
            </div>
            {/* macroSplit and intro are null because the BUILDER does not author them: intro is
                written by plan-gen and a builder re-save already drops it (documented in
                meal-plan-structured.ts). Passing a fabricated value here would make the preview
                show something the saved plan will not have. */}
            <StructuredPlanView plan={{ goal, calorieTarget, macros, macroSplit: null, intro: null, slots }} />
          </div>
        </div>
      )}
    </>
  );
}
