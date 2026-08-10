'use client';

import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { setWeightGoalAction } from '@/lib/coach/weight-goal-actions';

/**
 * Set or clear a client's goal weight.
 *
 * Collapsed to a single link until she wants it, because this is a rarely-touched field on a page
 * that already has a lot on it. Clearing is a first-class action, not an omission: "no goal" is a
 * real answer for a client training for strength or maintenance, and forcing a number would put a
 * fictional target on her chart.
 */
export function WeightGoalEditor({
  contactId,
  initial,
}: {
  contactId: string;
  initial: number | null;
}): ReactElement {
  const t = useTranslations('app.coach');
  const [goal, setGoal] = useState<number | null>(initial);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initial != null ? String(initial) : '');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save(next: number | null): void {
    setError(null);
    start(async () => {
      const res = await setWeightGoalAction({ contactId, targetWeightKg: next });
      if (res.ok) {
        setGoal(res.targetWeightKg);
        setDraft(res.targetWeightKg != null ? String(res.targetWeightKg) : '');
        setOpen(false);
      } else {
        // Say which failure it was. "invalid" is her typo to fix; anything else is ours.
        setError(res.error === 'invalid' ? t('weightGoalRange') : t('weightGoalFailed'));
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tf-press text-[12px] font-semibold text-muted underline decoration-line underline-offset-2 hover:text-ink"
      >
        {goal != null ? t('weightGoalEdit') : t('weightGoalSet')}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.1"
          inputMode="decimal"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          placeholder="kg"
          className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-[13px] tabular-nums outline-none focus:border-ink"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const n = Number.parseFloat(draft);
            if (!Number.isFinite(n)) {
              setError(t('weightGoalRange'));
              return;
            }
            save(n);
          }}
          className="tf-press rounded-full bg-ink px-3 py-1.5 text-[12px] font-semibold text-bg disabled:opacity-50"
        >
          {t('save')}
        </button>
        {goal != null && (
          <button
            type="button"
            disabled={pending}
            onClick={() => save(null)}
            className="tf-press text-[12px] text-muted hover:text-ink disabled:opacity-50"
          >
            {t('weightGoalClear')}
          </button>
        )}
        <button type="button" onClick={() => setOpen(false)} className="tf-press text-[12px] text-faint hover:text-ink">
          {t('cancel')}
        </button>
      </div>
      {error && <span className="text-[11px] text-alert-ink">{error}</span>}
    </div>
  );
}
