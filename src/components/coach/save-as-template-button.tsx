'use client';

import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { saveAsTemplateAction } from '@/lib/coach/meal-plan-actions';

/**
 * Keep this plan for the next client.
 *
 * Her method is a small number of structures reused across many people, so the plan she perfects
 * for one is the plan she wants for the next twenty. Without this she rebuilds it by hand, which is
 * where drift and typos come from.
 *
 * It COPIES. The plan stays assigned to the client it was written for, because turning a client's
 * live plan into a library template would quietly take away the plan she is eating from today.
 */
export function SaveAsTemplateButton({ planId, name }: { planId: string; name: string }): ReactElement {
  const t = useTranslations('app.coach');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Pre-filled with a distinguishable name, because a library with two rows called "Fat loss 1700"
  // is a library she cannot use.
  const [draft, setDraft] = useState(`${name} (${t('mbTemplateSuffix')})`);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  function save(): void {
    setFailed(false);
    start(async () => {
      const res = await saveAsTemplateAction({ planId, name: draft.trim() });
      if (res.ok) {
        setOpen(false);
        router.push('/coach/tool/meal-plans');
        router.refresh();
      } else setFailed(true);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tf-press rounded-full border border-line px-4 py-2.5 text-[13px] font-semibold text-muted hover:border-ink hover:text-ink"
      >
        {t('mbSaveAsTemplate')}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        aria-label={t('mbSaveAsTemplate')}
        className="w-56 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-ink"
      />
      <button
        type="button"
        disabled={pending || draft.trim().length === 0}
        onClick={save}
        className="tf-press rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-bg disabled:opacity-50"
      >
        {pending ? '…' : t('mbSaveCopy')}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="tf-press text-[12px] text-muted">
        {t('cancel')}
      </button>
      {failed && <span className="text-[12px] text-alert-ink">{t('mbError')}</span>}
    </div>
  );
}
