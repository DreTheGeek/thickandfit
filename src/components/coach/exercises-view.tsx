'use client';

import { useRef, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { useClientFilterUrl } from '@/components/coach/use-client-filters';
import { ExerciseCard } from '@/components/coach/exercise-card';
import { EmptyState } from '@/components/states/empty-state';
import { slugLabel, type SlugTranslator } from '@/lib/exercises/labels';
import type { ExercisesPage, ExerciseFilters } from '@/lib/coach/exercises';

/**
 * The exercise library.
 *
 * WHAT THIS REPLACED. Five stacked bands before a single movement appeared: a search box, an
 * ownership chip row, a filming progress bar, a block chip row, a muscle chip row and an equipment
 * chip row. All four chip rows shared one class, so a TOGGLE ("My exercises") looked exactly like a
 * FACET ("glutes"), and two of the rows were near-useless by construction: `muscle_group` is null
 * on 359 of her 366 filmed movements, and `block` is null on 293 of the 294 seed rows. Whichever
 * half of the library she was looking at, half the chips were blank.
 *
 * Now: a toolbar, then ONE chip row that speaks whichever vocabulary applies to what she is looking
 * at. Equipment moved into a select, because it narrows a list rather than being a way into one.
 *
 * AND IT BROWSES BEFORE IT PAGINATES. With nothing typed, the screen is sections with a preview of
 * each, so she can see the shape of her library. The moment she searches or taps a chip it becomes
 * a flat paged grid, because a search result should not be grouped: the query already states the
 * group, and grouping a filtered set is what printed the same heading on all ten pages.
 */
export function ExercisesView({ page, filters }: { page: ExercisesPage; filters: ExerciseFilters }): ReactElement {
  const t = useTranslations('app.coach');
  const tl = useTranslations('app.library');
  const { setParam, toggleMulti, clearAll } = useClientFilterUrl();
  const [q, setQ] = useState(filters.q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pages = Math.ceil(page.total / page.pageSize);

  function onSearch(v: string): void {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setParam('q', v.trim() || null), 250);
  }

  /** A FACET. Outlined, and never the same shape as the scope switch below. */
  const chipCls = (on: boolean): string =>
    [
      'tf-press shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold',
      on ? 'border-ink bg-ink text-bg' : 'border-line text-soft hover:border-ink hover:text-ink',
    ].join(' ');

  /** A SCOPE. A filled segment inside a track, so it cannot be mistaken for a filter chip. */
  const segCls = (on: boolean): string =>
    [
      'tf-press shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors',
      on ? 'bg-ink text-bg' : 'text-soft hover:text-ink',
    ].join(' ');

  const selectCls =
    'tf-press shrink-0 rounded-full border border-line bg-surface px-3.5 py-2 text-[12px] font-semibold text-soft outline-none focus:border-ink';

  /** The label for a facet key, in the vocabulary the current axis speaks. */
  const facetLabel = (key: string): string =>
    page.axis === 'block'
      ? t(`block_${key}` as never)
      : slugLabel(tl as unknown as SlugTranslator, key, 'muscles');

  const groupLabel = (key: string | null): string => (key ? facetLabel(key) : t('blockUnsorted'));

  return (
    <div className="flex flex-col gap-4">
      {/* ONE toolbar: search, count, shoot progress, equipment. The progress bar used to own a band
          of its own; beside the count is where a reading belongs. */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-1 basis-[240px]">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="search" size={16} />
          </span>
          <input
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t('exercisesSearch')}
            className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-[14px] outline-none placeholder:text-faint focus:border-ink"
          />
        </div>
        <span className="shrink-0 text-[13px] font-medium text-muted">
          {t('exercisesCount', { count: page.total })}
        </span>
        {page.equipmentOptions.length > 0 && (
          <select
            className={selectCls}
            value={filters.equipment[0] ?? ''}
            onChange={(e) => setParam('equipment', e.target.value || null)}
          >
            <option value="">{t('exercisesEquipmentAll')}</option>
            {page.equipmentOptions.map((e) => (
              <option key={e.key} value={e.key}>
                {slugLabel(tl as unknown as SlugTranslator, e.key, 'equipmentTypes')} ({e.count})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* SCOPE. The switch that decides which half of the library she is in, and therefore which
          vocabulary the chips below speak. ON is the default, so OFF is what gets written. */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-warm p-1">
          <button
            type="button"
            onClick={() => setParam('mine', null)}
            aria-pressed={filters.mine}
            className={segCls(filters.mine)}
          >
            {t('exercisesScopeMine')}{' '}
            <span className={filters.mine ? 'text-bg/60' : 'text-faint'}>{page.counts.mine}</span>
          </button>
          <button
            type="button"
            onClick={() => setParam('mine', '0')}
            aria-pressed={!filters.mine}
            className={segCls(!filters.mine)}
          >
            {t('exercisesScopeAll')}{' '}
            <span className={!filters.mine ? 'text-bg/60' : 'text-faint'}>{page.totalAll}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setParam('fav', filters.fav ? null : '1')}
          aria-pressed={filters.fav}
          className={chipCls(filters.fav)}
        >
          {t('exercisesFilterFavorites')}{' '}
          <span className={filters.fav ? 'text-bg/60' : 'text-faint'}>{page.counts.fav}</span>
        </button>
        {/* Only offered once she owns something to shoot, so a fresh tenant never sees a chip that
            can only ever read 0. It reads footage now, not the manual flag: see isFilmed(). */}
        {page.filming.total > 0 && page.counts.toFilm > 0 && (
          <button
            type="button"
            onClick={() => setParam('tofilm', filters.toFilm ? null : '1')}
            aria-pressed={filters.toFilm}
            className={chipCls(filters.toFilm)}
          >
            {t('exercisesFilterToFilm')}{' '}
            <span className={filters.toFilm ? 'text-bg/60' : 'text-faint'}>{page.counts.toFilm}</span>
          </button>
        )}
        {page.filming.total > 0 && (
          <span className="flex min-w-[150px] flex-1 items-center gap-2.5">
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-warm">
              <span
                className="block h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${Math.round((page.filming.filmed / page.filming.total) * 100)}%` }}
              />
            </span>
            <span className="shrink-0 text-[12px] font-semibold tabular-nums text-muted">
              {t('exercisesFilmedProgress', { filmed: page.filming.filmed, total: page.filming.total })}
            </span>
          </span>
        )}
      </div>

      {/* THE ONE CHIP ROW. Blocks when she is in her own library, muscles when she is in the seed
          catalog. Labels come from the shared catalogs rather than printing the raw slug. */}
      {page.facets.length > 0 && (
        <div className="tf-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {page.facets.map((f) => {
            const on =
              page.axis === 'block' ? filters.block.includes(f.key) : filters.muscle.includes(f.key);
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleMulti(page.axis === 'block' ? 'block' : 'muscle', f.key)}
                aria-pressed={on}
                className={chipCls(on)}
              >
                {facetLabel(f.key)} <span className={on ? 'text-bg/60' : 'text-faint'}>{f.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* list */}
      {page.total === 0 ? (
        <EmptyState
          title={page.totalAll === 0 ? t('exercisesEmpty') : t('exercisesNoneFiltered')}
          message={page.totalAll === 0 ? undefined : t('exercisesNoneFilteredBody')}
          action={
            page.totalAll === 0 ? undefined : (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  clearAll();
                }}
                className="tf-press rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink"
              >
                {t('exercisesClearFilters')}
              </button>
            )
          }
        />
      ) : page.browsing ? (
        <div className="flex flex-col gap-6">
          {page.groups.map((g) => (
            <div key={g.key ?? 'unsorted'}>
              <div className="mb-2.5 flex items-baseline gap-2">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-soft">
                  {groupLabel(g.key)}
                </h2>
                <span className="text-[12px] tabular-nums text-faint">{g.total}</span>
                {/* Writes the axis filter, which is also what flips browsing off, so "See all" and
                    the chip above lead to exactly the same screen. */}
                {g.total > g.rows.length && g.key && (
                  <button
                    type="button"
                    onClick={() => toggleMulti(page.axis === 'block' ? 'block' : 'muscle', g.key as string)}
                    className="tf-press ml-auto text-[12px] font-semibold text-muted hover:text-ink"
                  >
                    {t('exercisesSeeAll', { n: g.total })}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                {g.rows.map((r) => (
                  <ExerciseCard key={r.id} row={r} demoUrl={page.demoUrls[r.id] ?? null} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {page.rows.map((r) => (
            <ExerciseCard key={r.id} row={r} demoUrl={page.demoUrls[r.id] ?? null} />
          ))}
        </div>
      )}

      {/* Only when the list is actually paged. Browsing has no pages by design. */}
      {!page.browsing && pages > 1 && (
        <div className="mt-2 flex items-center justify-center gap-3 text-[13px] text-muted">
          <button
            type="button"
            disabled={page.page <= 1}
            onClick={() => setParam('page', String(page.page - 1))}
            className="tf-press rounded-full border border-line p-2 disabled:opacity-40"
          >
            <Icon name="chevronLeft" size={14} />
          </button>
          <span>{t('pageOf', { page: page.page, pages })}</span>
          <button
            type="button"
            disabled={page.page >= pages}
            onClick={() => setParam('page', String(page.page + 1))}
            className="tf-press rounded-full border border-line p-2 disabled:opacity-40"
          >
            <Icon name="chevronRight" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
