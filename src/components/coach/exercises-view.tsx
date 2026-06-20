'use client';

import { useRef, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { useClientFilterUrl } from '@/components/coach/use-client-filters';
import type { ExercisesPage, ExerciseFilters } from '@/lib/coach/exercises';

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
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {page.rows.map((r) => (
            <Link
              key={r.id}
              href={`/coach/exercises/${r.id}`}
              className="tf-press group flex items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warm text-soft">
                <Icon name="dumbbell" size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink">{r.name}</span>
                <span className="block truncate text-[12px] capitalize text-muted">
                  {[r.muscleGroup, r.equipment].filter(Boolean).join(' · ')}
                </span>
              </span>
              <Icon name="chevronRight" size={16} className="shrink-0 text-faint group-hover:text-ink" />
            </Link>
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
