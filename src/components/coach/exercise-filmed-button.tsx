'use client';

import { useState, useTransition, type MouseEvent, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { setFilmedAction } from '@/lib/exercises/filming-actions';

/**
 * Tick a movement off the shoot list.
 *
 * This exists because the last checklist we gave her could not remember anything: "when I try to
 * input that checklist on Google Chrome ... it completely put it at 0%. It doesn't save what I
 * complete." That one lived in a published document with nowhere to write to. This one writes to
 * `exercises.filmed_at`, so it survives the tab, the device and the shoot day.
 *
 * Optimistic like the star next to it, and it reverts on failure rather than leaving a tick on
 * screen for a row the server never recorded. That distinction is the entire point of the change.
 */
export function ExerciseFilmedButton({
  exerciseId,
  initial,
  size = 18,
}: {
  exerciseId: string;
  initial: boolean;
  size?: number;
}): ReactElement {
  const t = useTranslations('app.coach');
  const [filmed, setFilmed] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  function toggle(e: MouseEvent<HTMLButtonElement>): void {
    // Without this the tick navigates to the exercise, because the row is a link.
    e.preventDefault();
    e.stopPropagation();
    const next = !filmed;
    setFilmed(next);
    setFailed(false);
    start(async () => {
      const res = await setFilmedAction(exerciseId, next);
      if (!res.ok) {
        setFilmed(!next);
        setFailed(true);
      }
    });
  }

  const label = failed
    ? t('exercisesFilmedFailed')
    : filmed
      ? t('exercisesUnmarkFilmed')
      : t('exercisesMarkFilmed');

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={filmed}
      aria-label={label}
      title={label}
      className={[
        'tf-press shrink-0 rounded-full p-1.5 transition-colors',
        // Green is the functional "done" signal here, which is exactly what the brand rule reserves
        // it for. Red only ever appears after a real failure.
        failed ? 'text-alert-ink' : filmed ? 'text-accent' : 'text-line hover:text-soft',
      ].join(' ')}
    >
      {/* `camera` reads as "shot", which is what she is actually recording here, and it is
          distinguishable at a glance from the star beside it. `check` alone looked like the star's
          twin at 18px. */}
      <Icon name={failed ? 'x' : 'camera'} size={size} fill={filmed && !failed ? 'currentColor' : 'none'} />
    </button>
  );
}
