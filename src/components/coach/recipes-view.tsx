'use client';

import { useRef, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { useClientFilterUrl } from '@/components/coach/use-client-filters';
import { RecipeCard } from '@/components/coach/recipe-card';
import type { RecipesPage, RecipeFilters, RecipeSort } from '@/lib/coach/recipes-types';

const SORTS: RecipeSort[] = ['name', 'kcal', 'protein', 'time'];

export function RecipesView({ page, filters }: { page: RecipesPage; filters: RecipeFilters }): ReactElement {
  const t = useTranslations('app.coach');
  const { setParam, toggleMulti } = useClientFilterUrl();
  const [q, setQ] = useState(filters.q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pages = Math.ceil(page.total / page.pageSize);

  function onSearch(v: string): void {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setParam('q', v.trim() || null), 250);
  }
  const chipCls = (on: boolean): string =>
    [
      'tf-press shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold',
      on ? 'border-ink bg-ink text-bg' : 'border-line text-soft hover:border-ink hover:text-ink',
    ].join(' ');

  return (
    <div className="flex flex-col gap-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="search" size={16} />
          </span>
          <input
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t('searchRecipes')}
            className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-[14px] outline-none placeholder:text-faint focus:border-ink"
          />
        </div>
        <span className="shrink-0 text-[13px] font-medium text-muted">{t('recipesCount', { count: page.total })}</span>
        <select
          value={filters.sort}
          onChange={(e) => setParam('sort', e.target.value)}
          className="tf-press shrink-0 rounded-full border border-line bg-surface px-3.5 py-2 text-[12px] font-semibold text-muted outline-none focus:border-ink"
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`recipeSort_${s}`)}
            </option>
          ))}
        </select>
      </div>

      {/* category chips + quick filters */}
      <div className="tf-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button type="button" onClick={() => setParam('highProtein', filters.highProtein ? null : '1')} className={chipCls(filters.highProtein)}>
          {t('filterHighProtein')}
        </button>
        {page.facets.book.map((b) => (
          <button key={b.key} type="button" onClick={() => toggleMulti('book', b.key)} className={chipCls(filters.book.includes(b.key))}>
            {b.key}
          </button>
        ))}
        {page.facets.category.map((cat) => (
          <button key={cat.key} type="button" onClick={() => toggleMulti('category', cat.key)} className={chipCls(filters.category.includes(cat.key))}>
            {cat.key} <span className="text-faint">{cat.count}</span>
          </button>
        ))}
      </div>

      {/* grid */}
      {page.rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-faint">{page.totalAll === 0 ? t('noRecipes') : t('noRecipesFiltered')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {page.rows.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-2 flex items-center justify-center gap-3 text-[13px] text-muted">
          <button type="button" disabled={page.page <= 1} onClick={() => setParam('page', String(page.page - 1))} className="tf-press rounded-full border border-line p-2 disabled:opacity-40">
            <Icon name="chevronLeft" size={14} />
          </button>
          <span>{t('pageOf', { page: page.page, pages })}</span>
          <button type="button" disabled={page.page >= pages} onClick={() => setParam('page', String(page.page + 1))} className="tf-press rounded-full border border-line p-2 disabled:opacity-40">
            <Icon name="chevronRight" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
