'use client';

import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { toggleRecipeFavoriteAction } from '@/lib/coach/recipe-favorites-actions';

type Variant = 'icon' | 'button';

// Optimistic favorite toggle. Reverts on server error. Two shapes: a compact icon (recipe cards)
// and a labeled button (detail header).
export function RecipeFavoriteButton({
  recipeId,
  initial,
  variant = 'icon',
  className = '',
}: {
  recipeId: string;
  initial: boolean;
  variant?: Variant;
  className?: string;
}): ReactElement {
  const t = useTranslations('app.coach');
  const [fav, setFav] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle(): void {
    const next = !fav;
    setFav(next);
    startTransition(async () => {
      const res = await toggleRecipeFavoriteAction(recipeId);
      if (!res.ok) setFav(!next);
      else if (typeof res.isFavorite === 'boolean') setFav(res.isFavorite);
    });
  }

  const aria = fav ? t('recipeUnfavorite') : t('recipeFavorite');

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={fav}
        className={`tf-press inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-semibold disabled:opacity-50 ${
          fav ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:border-ink hover:text-ink'
        } ${className}`}
      >
        <Icon name="heart" size={15} className={fav ? 'fill-accent' : ''} strokeWidth={fav ? 0 : 1.8} />
        {fav ? t('recipeFavorited') : t('recipeFavorite')}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      disabled={pending}
      aria-label={aria}
      aria-pressed={fav}
      className={`tf-press flex h-7 w-7 items-center justify-center rounded-full bg-ink/85 disabled:opacity-50 ${className}`}
    >
      <Icon name="heart" size={14} className={fav ? 'fill-accent text-accent' : 'text-bg'} strokeWidth={fav ? 0 : 1.8} />
    </button>
  );
}
