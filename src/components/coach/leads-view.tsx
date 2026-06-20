'use client';

import { useRef, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { useClientFilterUrl } from '@/components/coach/use-client-filters';
import { LeadsBoard } from '@/components/coach/leads-board';
import type { PipelineBoard, LeadFilters } from '@/lib/coach/leads-types';

const STATUSES = ['open', 'won', 'lost', 'abandoned'] as const;

function statusLabel(t: (k: string) => string, s: string): string {
  return t(s === 'won' ? 'oppStatusWon' : s === 'lost' ? 'oppStatusLost' : s === 'abandoned' ? 'oppStatusAbandoned' : 'oppStatusOpen');
}

export function LeadsView({ board, filters, locale }: { board: PipelineBoard; filters: LeadFilters; locale: string }): ReactElement {
  const t = useTranslations('app.coach');
  const { setParam } = useClientFilterUrl();
  const [q, setQ] = useState(filters.q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusCount = new Map(board.statusCounts.map((b) => [b.key, b.count]));
  const effStatus = filters.status.length ? filters.status : ['open'];

  function onSearch(v: string): void {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setParam('q', v.trim() || null), 250);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* pipeline switcher */}
      <div className="flex flex-wrap items-center gap-2">
        {board.pipelines.map((p) => {
          const isActive = board.activeSlug === p.slug;
          return (
            <button
              key={p.slug}
              type="button"
              onClick={() => setParam('pipeline', p.slug)}
              className={[
                'tf-press rounded-full border px-4 py-2 text-[13px] font-semibold',
                isActive ? 'border-ink bg-ink text-bg' : 'border-line text-soft hover:border-ink hover:text-ink',
              ].join(' ')}
            >
              {p.slug === 'reengagement' ? t('pipelineReengagement') : t('pipelineMarketing')}
            </button>
          );
        })}
      </div>

      {/* search + status filter */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="search" size={16} />
          </span>
          <input
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t('searchLeads')}
            className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-[14px] outline-none placeholder:text-faint focus:border-ink"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => {
            const on = effStatus.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => setParam('status', s)}
                className={[
                  'tf-press inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold',
                  on ? 'border-ink bg-ink text-bg' : 'border-line text-muted hover:border-ink hover:text-ink',
                ].join(' ')}
              >
                {statusLabel(t, s)}
                <span className={on ? 'text-bg/70' : 'text-faint'}>{statusCount.get(s) ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      <LeadsBoard board={board} locale={locale} />
    </div>
  );
}
