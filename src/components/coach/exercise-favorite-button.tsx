'use client';

import { useState, useTransition, type MouseEvent, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { setExerciseFavorite } from '@/lib/coach/exercise-favorite-actions';

/**
 * The star Stephanie used on every row of her old exercise list, as a shortlist of the movements
 * she actually programmes from.
 *
 * Optimistic, because the server round trip revalidates a 600-row page and the star must not lag
 * the finger. It reverts on failure rather than leaving a lie on screen.
 *
 * `stopPropagation` matters wherever this sits inside a card that is also a link: without it,
 * starring an exercise navigates to it instead.
 */
export function ExerciseFavoriteButton({
  exerciseId,
  initial,
  size = 18,
}: {
  exerciseId: string;
  initial: boolean;
  size?: number;
}): ReactElement {
  const t = useTranslations('app.coach');
  const [starred, setStarred] = useState(initial);
  const [pending, start] = useTransition();

  function toggle(e: MouseEvent<HTMLButtonElement>): void {
    e.preventDefault();
    e.stopPropagation();
    const next = !starred;
    setStarred(next);
    start(async () => {
      const res = await setExerciseFavorite({ exerciseId, isFavorite: next });
      if (!res.ok) setStarred(!next);
    });
  }

  const label = starred ? t('exercisesUnfavorite') : t('exercisesFavorite');

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={starred}
      aria-label={label}
      title={label}
      className={[
        'tf-press shrink-0 rounded-full p-1.5 transition-colors',
        starred ? 'text-ink' : 'text-line hover:text-soft',
      ].join(' ')}
    >
      <Icon name="star" size={size} fill={starred ? 'currentColor' : 'none'} />
    </button>
  );
}
