'use client';
// Coach assigns a daily habit to this client from the profile. assignHabitAction existed with no
// UI caller; this small form is the missing wire. The member sees + checks the habit on Today.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { assignHabitAction } from '@/lib/habits/habit-actions';

export function AssignHabitForm({ profileId }: { profileId: string }): ReactElement {
  const t = useTranslations('app.coach');
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function submit(): void {
    const trimmed = title.trim();
    if (trimmed.length < 1) return;
    setError(false);
    startTransition(async () => {
      const res = await assignHabitAction({ profileId, title: trimmed });
      if (!res.ok) setError(true);
      else {
        setTitle('');
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          maxLength={80}
          placeholder={t('habitsAssignPlaceholder')}
          aria-label={t('habitsAssignPlaceholder')}
          className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-[13px] outline-none placeholder:text-faint focus:border-ink"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || title.trim().length < 1}
          className="tf-press shrink-0 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-bg disabled:opacity-40"
        >
          {t('habitsAssignCta')}
        </button>
      </div>
      {error && <p className="mt-1 text-[12px] text-alert-ink">{t('habitsAssignError')}</p>}
    </div>
  );
}
