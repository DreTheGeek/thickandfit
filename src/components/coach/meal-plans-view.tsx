'use client';

import { useRef, useState, type ReactElement } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { useClientFilterUrl } from '@/components/coach/use-client-filters';
import type { MealPlansPage, MealPlanFilters, MealPlanSort } from '@/lib/coach/meal-plans-types';

const SORTS: MealPlanSort[] = ['client', 'name', 'calories'];

export function MealPlansView({ page, filters }: { page: MealPlansPage; filters: MealPlanFilters }): ReactElement {
  const t = useTranslations('app.coach');
  const router = useRouter();
  const sp = useSearchParams();
  const { setParam } = useClientFilterUrl();
  const [q, setQ] = useState(filters.q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pages = Math.ceil(page.total / page.pageSize);

  function onSearch(v: string): void {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setParam('q', v.trim() || null), 250);
  }
  const open = (id: string): void => {
    const from = sp.toString();
    router.push(`/coach/tool/meal-plans/${id}${from ? `?from=${encodeURIComponent(from)}` : ''}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="search" size={16} />
          </span>
          <input
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t('searchMealPlans')}
            className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-[14px] outline-none placeholder:text-faint focus:border-ink"
          />
        </div>
        <span className="shrink-0 text-[13px] font-medium text-muted">{t('mealPlansCount', { count: page.total })}</span>
        <select
          value={filters.sort}
          onChange={(e) => setParam('sort', e.target.value)}
          className="tf-press shrink-0 rounded-full border border-line bg-surface px-3.5 py-2 text-[12px] font-semibold text-muted outline-none focus:border-ink"
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`mealSort_${s}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line bg-warm/40 text-left text-[10px] uppercase tracking-[1px] text-faint">
                <th className="px-4 py-2.5 font-semibold">{t('colClient')}</th>
                <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">{t('colPlan')}</th>
                <th className="px-4 py-2.5 text-right font-semibold">{t('colCalories')}</th>
                <th className="hidden px-4 py-2.5 font-semibold md:table-cell">{t('colMacros')}</th>
                <th className="hidden px-4 py-2.5 font-semibold lg:table-cell">{t('colTiming')}</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.map((r) => (
                <tr key={r.id} onClick={() => open(r.id)} className="tf-press cursor-pointer border-b border-divider last:border-0 hover:bg-warm/50">
                  <td className="px-4 py-3 text-[13px] font-semibold">{r.clientName ?? t('leadUnnamed')}</td>
                  <td className="hidden px-4 py-3 text-[13px] text-soft sm:table-cell">{r.name}</td>
                  <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums">{r.calorieGoal ?? '-'}</td>
                  <td className="hidden px-4 py-3 text-[12px] tabular-nums text-soft md:table-cell">
                    {r.proteinG ?? 0}p / {r.carbG ?? 0}c / {r.fatG ?? 0}f
                  </td>
                  <td className="hidden px-4 py-3 text-[13px] text-soft lg:table-cell">{r.macroTiming ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {page.rows.length === 0 && (
          <div className="px-4 py-16 text-center text-sm text-faint">{page.totalAll === 0 ? t('noMealPlans') : t('noMealPlansFiltered')}</div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-[13px] text-muted">
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
