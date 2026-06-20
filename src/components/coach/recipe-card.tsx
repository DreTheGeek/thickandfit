'use client';

import type { ReactElement } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
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
        {recipe.image ? (
          <Image
            src={recipe.image}
            alt={recipe.name}
            fill
            sizes="(max-width: 640px) 50vw, 280px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-faint">
            <Icon name="nutrition" size={32} />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-semibold text-bg">
          {recipe.kcal} kcal
        </span>
        {recipe.hasVideo && (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink/85 text-bg">
            <Icon name="camera" size={12} />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        {recipe.category && <div className="mb-1 text-[10px] font-semibold uppercase tracking-[1px] text-faint">{recipe.category}</div>}
        <div className="mb-3 line-clamp-2 text-[14px] font-semibold leading-tight">{recipe.name}</div>
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
