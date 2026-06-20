'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/ui/avatar';
import { formatCents } from '@/components/coach/money';
import { LeadStatusPill } from '@/components/coach/lead-status-pill';
import type { LeadCardRow } from '@/lib/coach/leads-types';

export function LeadCard({ card, locale }: { card: LeadCardRow; locale: string }): ReactElement {
  const t = useTranslations('app.coach');
  const sp = useSearchParams();
  const from = sp.toString();
  const href = `/coach/leads/${card.id}${from ? `?from=${encodeURIComponent(from)}` : ''}`;
  const rotting = card.status === 'open' && card.daysInStage != null && card.daysInStage > 21;

  return (
    <Link
      href={href}
      className="tf-press block rounded-xl border border-line bg-surface p-3 hover:border-ink"
    >
      <div className="flex items-center gap-2.5">
        <Avatar initials={card.initials} size={28} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-ink">{card.name}</div>
          {card.source && <div className="truncate text-[11px] text-faint">{card.source}</div>}
        </div>
        {card.valueCents != null && card.valueCents > 0 && (
          <span className="shrink-0 text-[13px] font-semibold tabular-nums">{formatCents(card.valueCents, card.currency, locale)}</span>
        )}
      </div>

      {card.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.tags.slice(0, 2).map((tag) => (
            <span key={tag.slug} className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] text-soft" style={{ borderColor: `${tag.color}55` }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
              {tag.label}
            </span>
          ))}
          {card.tags.length > 2 && <span className="text-[10px] text-faint">+{card.tags.length - 2}</span>}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        {card.status === 'open' ? (
          <span className={['text-[11px]', rotting ? 'font-semibold text-alert-ink' : 'text-faint'].join(' ')}>
            {card.daysInStage != null ? t('idleDays', { days: card.daysInStage }) : ''}
          </span>
        ) : (
          <LeadStatusPill status={card.status} />
        )}
        {card.owner && <span className="text-[11px] capitalize text-faint">{card.owner}</span>}
      </div>
    </Link>
  );
}
