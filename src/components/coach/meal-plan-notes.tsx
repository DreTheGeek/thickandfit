'use client';

// Coach-editable notes on a meal plan (Stephanie's "feel free to add spinach/onions" note). Saves to
// meal_plans.notes; the client sees it on their meal-plan view.
import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { saveMealPlanNotesAction } from '@/lib/coach/meal-plan-actions';

export function MealPlanNotesEditor({
  planId,
  initial,
}: {
  planId: string;
  initial: string | null;
}): ReactElement {
  const t = useTranslations('app.coach');
  const [notes, setNotes] = useState(initial ?? '');
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [pending, start] = useTransition();

  function save(): void {
    setStatus('idle');
    start(async () => {
      const res = await saveMealPlanNotesAction({ planId, notes });
      setStatus(res.ok ? 'ok' : 'error');
    });
  }

  return (
    <div className="mt-5 rounded-2xl border border-line bg-surface p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-display text-[18px]">{t('planNotesTitle')}</h2>
        {status === 'ok' && <span className="text-[12px] text-accent">{t('planNotesSaved')}</span>}
        {status === 'error' && <span className="text-[12px] text-red-600">{t('planNotesError')}</span>}
      </div>
      <p className="mb-3 text-[13px] text-faint">{t('planNotesHint')}</p>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          if (status !== 'idle') setStatus('idle');
        }}
        rows={3}
        maxLength={2000}
        placeholder={t('planNotesPlaceholder')}
        className="w-full resize-none rounded-xl border border-line bg-transparent px-3.5 py-3 text-[14px] text-ink outline-none placeholder:text-faint focus:border-ink"
      />
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="tf-press rounded-full bg-ink px-5 py-2 text-[13px] font-semibold text-bg disabled:opacity-50"
        >
          {pending ? t('planNotesSaving') : t('planNotesSave')}
        </button>
      </div>
    </div>
  );
}
