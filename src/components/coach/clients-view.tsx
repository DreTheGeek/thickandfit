'use client';

import { useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { ClientsSmartLists } from '@/components/coach/clients-smartlists';
import { ClientsToolbar } from '@/components/coach/clients-toolbar';
import { ClientsFilterRail } from '@/components/coach/clients-filter-rail';
import { ClientsTable } from '@/components/coach/clients-table';
import { useClientFilterUrl } from '@/components/coach/use-client-filters';
import type { ClientFilters, ClientsPage, SavedSegment } from '@/lib/coach/clients-types';

function Pagination({ total, page, pageSize }: { total: number; page: number; pageSize: number }): ReactElement | null {
  const t = useTranslations('app.coach');
  const { setParam } = useClientFilterUrl();
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-[13px] text-muted">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => setParam('page', String(page - 1))}
        className="tf-press rounded-full border border-line p-2 disabled:opacity-40"
      >
        <Icon name="chevronLeft" size={14} />
      </button>
      <span>{t('pageOf', { page, pages })}</span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => setParam('page', String(page + 1))}
        className="tf-press rounded-full border border-line p-2 disabled:opacity-40"
      >
        <Icon name="chevronRight" size={14} />
      </button>
    </div>
  );
}

export function ClientsView({
  page,
  segments,
  filters,
  locale,
}: {
  page: ClientsPage;
  segments: SavedSegment[];
  filters: ClientFilters;
  locale: string;
}): ReactElement {
  const [showFilters, setShowFilters] = useState(false);
  const { pending } = useClientFilterUrl();
  const t = useTranslations('app.coach');

  return (
    <div className="flex flex-col gap-4">
      {page.listTruncated && (
        <p className="rounded-2xl border border-line bg-warm/40 px-4 py-2.5 text-[12px] text-muted">
          {t('listTruncated', { n: page.totalAll })}
        </p>
      )}
      <ClientsSmartLists filters={filters} saved={segments} />
      <ClientsToolbar
        filters={filters}
        facets={page.facets}
        total={page.total}
        onToggleFilters={() => setShowFilters((s) => !s)}
      />
      <div className="flex flex-col gap-5 lg:flex-row">
        <div className={showFilters ? 'block' : 'hidden lg:block'}>
          <ClientsFilterRail facets={page.facets} filters={filters} />
        </div>
        <div className="min-w-0 flex-1">
          <ClientsTable
            rows={page.rows}
            totalAll={page.totalAll}
            sort={filters.sort}
            dir={filters.dir}
            locale={locale}
            pending={pending}
          />
          <Pagination total={page.total} page={page.page} pageSize={page.pageSize} />
        </div>
      </div>
    </div>
  );
}
