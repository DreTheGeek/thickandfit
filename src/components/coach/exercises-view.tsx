'use client';

import { useRef, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { useClientFilterUrl } from '@/components/coach/use-client-filters';
import { ExerciseFavoriteButton } from '@/components/coach/exercise-favorite-button';
import { ExerciseFilmedButton } from '@/components/coach/exercise-filmed-button';
import type { ExercisesPage, ExerciseFilters } from '@/lib/coach/exercises';

/**
 * The exercise library, laid out the way Stephanie already reads one: a search box, ownership
 * toggles, a muscle filter, then the list. "My exercises" is ON by default, because her own 367
 * are the ones she programmes from and the seed library is the fallback, not the front page.
 *
 * Kept as a card grid rather than the table she had: the same information in a shape that survives
 * a 390px phone, where a four-column table does not.
 */
export function ExercisesView({ page, filters }: { page: ExercisesPage; filters: ExerciseFilters }): ReactElement {
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
      'tf-press shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold capitalize',
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
            placeholder={t('exercisesSearch')}
            className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-[14px] outline-none placeholder:text-faint focus:border-ink"
          />
        </div>
        <span className="shrink-0 text-[13px] font-medium text-muted">{t('exercisesCount', { count: page.total })}</span>
      </div>

      {/* ownership toggles: her own, and the ones she starred */}
      <div className="tf-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          // ON is the default, so OFF has to be written to the URL. See parseExerciseFilters.
          onClick={() => setParam('mine', filters.mine ? '0' : null)}
          aria-pressed={filters.mine}
          className={chipCls(filters.mine)}
        >
          {t('exercisesFilterMine')} <span className={filters.mine ? 'text-bg/60' : 'text-faint'}>{page.counts.mine}</span>
        </button>
        <button
          type="button"
          onClick={() => setParam('fav', filters.fav ? null : '1')}
          aria-pressed={filters.fav}
          className={chipCls(filters.fav)}
        >
          {t('exercisesFilterFavorites')}{' '}
          <span className={filters.fav ? 'text-bg/60' : 'text-faint'}>{page.counts.fav}</span>
        </button>
        {/* Only offered once she owns something to shoot, so a fresh tenant never sees a chip
            that can only ever read 0. */}
        {page.filming.total > 0 && (
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
      </div>

      {/* Shoot progress. Measured against her whole library rather than the filtered view, so the
          number means the same thing whatever is typed in the search box. This is the thing the
          published checklist could not do: it reset to 0 percent every time she opened it. */}
      {page.filming.total > 0 && (
        <div className="flex items-center gap-3">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-warm">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${Math.round((page.filming.filmed / page.filming.total) * 100)}%` }}
            />
          </div>
          <span className="shrink-0 text-[12px] font-semibold tabular-nums text-muted">
            {t('exercisesFilmedProgress', { filmed: page.filming.filmed, total: page.filming.total })}
          </span>
        </div>
      )}

      {/* muscle-group chips */}
      <div className="tf-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {page.facets.muscle.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => toggleMulti('muscle', m.key)}
            className={chipCls(filters.muscle.includes(m.key))}
          >
            {m.key} <span className="text-faint">{m.count}</span>
          </button>
        ))}
      </div>

      {/* equipment chips */}
      {page.facets.equipment.length > 0 && (
        <div className="tf-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {page.facets.equipment.map((e) => (
            <button
              key={e.key}
              type="button"
              onClick={() => toggleMulti('equipment', e.key)}
              className={chipCls(filters.equipment.includes(e.key))}
            >
              {e.key} <span className="text-faint">{e.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* list */}
      {page.rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-faint">
          {page.totalAll === 0 ? t('exercisesEmpty') : t('exercisesNoneFiltered')}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {page.rows.map((r) => (
            <ExerciseCard key={r.id} row={r} />
          ))}
        </div>
      )}

      {pages > 1 && (
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

type CardRow = ExercisesPage['rows'][number];

/** One row: name, muscle/equipment, her "Owned by me" badge, and the star. */
function ExerciseCard({ row }: { row: CardRow }): ReactElement {
  const t = useTranslations('app.coach');
  return (
    <div className="group relative flex items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <Link href={`/coach/exercises/${row.id}`} className="tf-press flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warm text-soft">
          <Icon name="dumbbell" size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-ink">{row.name}</span>
          <span className="mt-0.5 flex items-center gap-1.5">
            <span className="min-w-0 truncate text-[12px] capitalize text-muted">
              {[row.muscleGroup, row.equipment].filter(Boolean).join(' · ')}
            </span>
            {row.isCoachAuthored && (
              <span className="shrink-0 rounded-full bg-warm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-soft">
                {t('exercisesOwnedByMe')}
              </span>
            )}
          </span>
        </span>
      </Link>
      {/* The camera only appears on her own rows. The seed library is not hers to film, and the
          action rejects those ids anyway, so rendering a control that could only ever fail would be
          the same kind of lie as the checklist that said "saved" and did not. */}
      {row.isCoachAuthored && <ExerciseFilmedButton exerciseId={row.id} initial={row.filmedAt != null} />}
      <ExerciseFavoriteButton exerciseId={row.id} initial={row.isFavorite} />
    </div>
  );
}
