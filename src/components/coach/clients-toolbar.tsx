'use client';

import { useRef, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { useClientFilterUrl } from '@/components/coach/use-client-filters';
import { buildActiveChips } from '@/components/coach/client-labels';
import { SaveSegmentDialog } from '@/components/coach/save-segment-dialog';
import type { ClientFacets, ClientFilters } from '@/lib/coach/clients-types';

export function ClientsToolbar({
  filters,
  facets,
  total,
  onToggleFilters,
}: {
  filters: ClientFilters;
  facets: ClientFacets;
  total: number;
  onToggleFilters: () => void;
}): ReactElement {
  const t = useTranslations('app.coach');
  const { setParam, removeValue, clearAll } = useClientFilterUrl();
  const [q, setQ] = useState(filters.q);
  const [saveOpen, setSaveOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chips = buildActiveChips(t, filters, facets);

  function onSearch(value: string): void {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setParam('q', value.trim() || null), 250);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={onToggleFilters}
          className="tf-press inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink lg:hidden"
        >
          <Icon name="funnel" size={14} /> {t('filters')}
        </button>

        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="search" size={16} />
          </span>
          <input
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t('searchClients')}
            className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-[14px] outline-none placeholder:text-faint focus:border-ink"
          />
        </div>

        <span className="shrink-0 text-[13px] font-medium text-muted">{t('clientsCount', { count: total })}</span>

        <button
          type="button"
          onClick={() => setSaveOpen(true)}
          className="tf-press inline-flex shrink-0 items-center gap-2 rounded-full border border-line px-3.5 py-2 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink"
        >
          <Icon name="bookmark" size={14} /> {t('saveSmartList')}
        </button>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={`${c.param}:${c.value}`}
              type="button"
              onClick={() => (c.multi ? removeValue(c.param, c.value) : setParam(c.param, null))}
              className="tf-press inline-flex items-center gap-1.5 rounded-full bg-warm px-3 py-1 text-[12px] font-medium text-ink hover:bg-line"
            >
              {c.label}
              <Icon name="x" size={12} />
            </button>
          ))}
          <button type="button" onClick={clearAll} className="tf-press px-2 text-[12px] font-semibold text-faint hover:text-ink">
            {t('clearAll')}
          </button>
        </div>
      )}

      <SaveSegmentDialog filters={filters} open={saveOpen} onClose={() => setSaveOpen(false)} />
    </div>
  );
}
