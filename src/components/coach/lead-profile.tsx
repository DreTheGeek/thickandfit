'use client';

import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icons';
import { LeadStatusPill } from '@/components/coach/lead-status-pill';
import { formatCents } from '@/components/coach/money';
import type { LeadDetail } from '@/lib/coach/leads-types';

function Stat({ value, label }: { value: string; label: string }): ReactElement {
  return (
    <div className="min-w-0">
      <div className="font-display text-[22px] leading-none">{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[1px] text-faint">{label}</div>
    </div>
  );
}
function RailRow({ label, value }: { label: string; value: ReactNode }): ReactElement {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-[13px]">
      <span className="shrink-0 text-faint">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-ink">{value}</span>
    </div>
  );
}
function fmtDate(value: string | null, locale: string): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

export function LeadProfile({
  detail,
  locale,
  backHref = '/coach/leads',
}: {
  detail: LeadDetail;
  locale: string;
  backHref?: string;
}): ReactElement {
  const t = useTranslations('app.coach');

  return (
    <div className="mx-auto w-full max-w-[1000px] px-5 py-7 sm:px-8">
      <Link href={backHref} className="tf-press mb-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink">
        <Icon name="arrowLeft" size={15} /> {t('backToLeads')}
      </Link>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar initials={detail.initials} size={60} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="tf-display text-[26px] leading-none">{detail.name || t('leadUnnamed')}</h1>
                <LeadStatusPill status={detail.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-faint">
                {detail.email && <span>{detail.email}</span>}
                {detail.phone && <span>{detail.phone}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {detail.email && (
              <a href={`mailto:${detail.email}`} className="tf-press inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink">
                <Icon name="send" size={14} /> {t('email')}
              </a>
            )}
            {detail.phone && (
              <a href={`tel:${detail.phone}`} className="tf-press inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink">
                <Icon name="chat" size={14} /> {t('message')}
              </a>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4 border-t border-divider pt-5">
          <Stat value={formatCents(detail.valueCents, detail.currency, locale)} label={t('kpiDealValue')} />
          <Stat value={detail.stageName ?? '-'} label={t('colStage')} />
          <Stat value={detail.pipelineName ?? '-'} label={t('leadPipeline')} />
          <Stat value={detail.daysInStage != null ? String(detail.daysInStage) : '-'} label={t('colDaysInStage')} />
        </div>

        {detail.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {detail.tags.map((tag) => (
              <span key={tag.slug} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium text-ink" style={{ borderColor: `${tag.color}55` }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-5 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-72">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="mb-1 text-[12px] font-semibold uppercase tracking-[1px] text-faint">{t('contactInfo')}</div>
            <RailRow label={t('email')} value={detail.email ?? '-'} />
            <RailRow label={t('phone')} value={detail.phone ?? '-'} />
            <RailRow label={t('facetLanguage')} value={detail.language === 'es' ? t('spanish') : t('english')} />
            <RailRow label={t('owner')} value={<span className="capitalize">{detail.owner ?? '-'}</span>} />
          </div>
          <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
            <div className="mb-1 text-[12px] font-semibold uppercase tracking-[1px] text-faint">{t('leadPipeline')}</div>
            <RailRow label={t('leadPipeline')} value={detail.pipelineName ?? '-'} />
            <RailRow label={t('colStage')} value={detail.stageName ?? '-'} />
            <RailRow label={t('facetSource')} value={detail.source ?? '-'} />
            {detail.status === 'lost' && detail.lostReason && <RailRow label={t('lostReasonLabel')} value={detail.lostReason} />}
            <RailRow label={t('colCreated')} value={<span suppressHydrationWarning>{fmtDate(detail.createdAt, locale)}</span>} />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-3 text-[12px] font-semibold uppercase tracking-[1px] text-faint">{t('leadTimeline')}</div>
          {detail.timeline.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-faint">{t('noActivity')}</div>
          ) : (
            <div className="rounded-2xl border border-line bg-surface px-5 py-2">
              {detail.timeline.map((e, i) => (
                <div key={i} className="flex items-center justify-between border-b border-divider py-3 text-[13px] last:border-0">
                  <span className="text-soft">
                    {e.field}: <span className="font-medium text-ink">{e.to ?? '-'}</span>
                  </span>
                  <span className="text-faint" suppressHydrationWarning>{fmtDate(e.at, locale)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
