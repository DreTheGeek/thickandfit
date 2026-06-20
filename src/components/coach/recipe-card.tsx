'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { RecipeImage } from '@/components/coach/recipe-image';
import { RecipeFavoriteButton } from '@/components/coach/recipe-favorite-button';
import { RecipeQualityBadge } from '@/components/coach/recipe-quality-badge';
import type { RecipeRow } from '@/lib/coach/recipes-types';

function Macro({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <span className="flex flex-col items-center">
      <span className="text-[12px] font-semibold tabular-nums">{Math.round(value)}g</span>
      <span className="text-[9px] uppercase tracking-[1px] text-faint">{label}</span>
    </span>
  );
}

export function RecipeCard({ recipe }: { recipe: RecipeRow }): ReactElement {
  const t = useTranslations('app.coach');
  const sp = useSearchParams();
  const from = sp.toString();
  const href = `/coach/tool/recipes/${recipe.id}${from ? `?from=${encodeURIComponent(from)}` : ''}`;

  return (
    <Link href={href} className="tf-press group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-warm">
        <RecipeImage
          src={recipe.image}
          alt={recipe.name}
          sizes="(max-width: 640px) 50vw, 280px"
          imgClassName="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="absolute left-2 top-2 rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-semibold text-bg">
          {recipe.kcal} kcal
        </span>
        <span className="absolute right-2 top-2 flex items-center gap-1.5">
          {recipe.hasVideo && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/85 text-bg">
              <Icon name="play" size={12} />
            </span>
          )}
          <RecipeFavoriteButton recipeId={recipe.id} initial={recipe.isFavorite} />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <div className="mb-1 flex items-center justify-between gap-2">
          {recipe.category ? (
            <div className="text-[10px] font-semibold uppercase tracking-[1px] text-faint">{recipe.category}</div>
          ) : (
            <span />
          )}
          <RecipeQualityBadge band={recipe.qualityBand} />
        </div>
        <div className="mb-3 line-clamp-2 text-[14px] font-semibold leading-tight">{recipe.name || t('recipeUntitled')}</div>
        <div className="mt-auto flex items-center justify-between border-t border-divider pt-3">
          <div className="flex gap-3.5">
            <Macro label={t('macroP')} value={recipe.proteinG} />
            <Macro label={t('macroC')} value={recipe.carbG} />
            <Macro label={t('macroF')} value={recipe.fatG} />
          </div>
          {recipe.totalTime > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-faint">
              <Icon name="calendar" size={12} /> {recipe.totalTime}m
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
