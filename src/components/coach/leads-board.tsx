'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { formatCents } from '@/components/coach/money';
import { LeadCard } from '@/components/coach/lead-card';
import type { PipelineBoard } from '@/lib/coach/leads-types';

function Kpi({ label, value, dark = false }: { label: string; value: string; dark?: boolean }): ReactElement {
  return (
    <div className={['rounded-2xl p-4', dark ? 'bg-ink text-white' : 'bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]'].join(' ')}>
      <div className={['text-[10px] font-semibold uppercase tracking-[1px]', dark ? 'text-white/55' : 'text-faint'].join(' ')}>{label}</div>
      <div className="mt-1 font-display text-[24px] leading-none">{value}</div>
    </div>
  );
}

export function LeadsBoard({ board, locale }: { board: PipelineBoard; locale: string }): ReactElement {
  const t = useTranslations('app.coach');
  const k = board.kpis;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Kpi label={t('kpiOpenValue')} value={formatCents(k.openValueCents, 'USD', locale)} dark />
        <Kpi label={t('kpiOpenCount')} value={String(k.open)} />
        <Kpi label={t('kpiWonValue')} value={formatCents(k.wonValueCents, 'USD', locale)} />
        <Kpi label={t('oppStatusWon')} value={String(k.won)} />
        <Kpi label={t('kpiWinRate')} value={`${k.winRatePct}%`} />
      </div>

      {board.columns.length === 0 ? (
        <p className="py-16 text-center text-sm text-faint">{t('noLeads')}</p>
      ) : (
        <div className="tf-scroll flex gap-3 overflow-x-auto pb-3">
          {board.columns.map((col) => (
            <div key={col.id} className="flex w-[270px] shrink-0 flex-col rounded-2xl bg-warm/40 p-2.5">
              <div className="mb-2 flex items-center justify-between px-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-[0.5px] text-soft">{col.name}</span>
                <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted">{col.count}</span>
              </div>
              {col.valueCents > 0 && (
                <div className="mb-2 px-1.5 text-[12px] font-medium text-faint">{formatCents(col.valueCents, 'USD', locale)}</div>
              )}
              <div className="tf-scroll flex max-h-[calc(100vh-320px)] flex-col gap-2 overflow-y-auto">
                {col.cards.map((card) => (
                  <LeadCard key={card.id} card={card} locale={locale} />
                ))}
                {col.count === 0 && <p className="px-1.5 py-4 text-center text-[12px] text-faint">{t('emptyStage')}</p>}
                {col.count > col.cards.length && (
                  <div className="px-1.5 py-2 text-center text-[11px] text-faint">{t('plusMore', { n: col.count - col.cards.length })}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
