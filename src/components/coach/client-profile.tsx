'use client';

import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icons';
import { StatusPill } from '@/components/coach/status-pill';
import { ClientDetailTabs } from '@/components/coach/client-detail-tabs';
import { formatCents } from '@/components/coach/money';
import type { ClientDetail } from '@/lib/coach/clients-types';

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

function planLabel(t: (k: string) => string, p: string | null): string {
  if (p === 'personalCoaching') return t('planPersonalCoaching');
  if (p === 'bootcamp') return t('planBootcamp');
  if (p === 'basic') return t('planBasic');
  return '-';
}

export function ClientProfile({
  detail,
  locale,
  backHref = '/coach/clients',
}: {
  detail: ClientDetail;
  locale: string;
  backHref?: string;
}): ReactElement {
  const t = useTranslations('app.coach');
  const cur = detail.currency;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-7 sm:px-8">
      <Link href={backHref} className="tf-press mb-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink">
        <Icon name="arrowLeft" size={15} /> {t('backToClients')}
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar initials={detail.initials} size={64} />
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="tf-display text-[28px] leading-none">{detail.name}</h1>
                <StatusPill status={detail.status} health={detail.billingHealth} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-faint">
                {detail.email && <span>{detail.email}</span>}
                {detail.phone && <span>{detail.phone}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {detail.email && (
              <a
                href={`mailto:${detail.email}`}
                className="tf-press inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink"
              >
                <Icon name="send" size={14} /> {t('email')}
              </a>
            )}
            {detail.phone && (
              <a
                href={`tel:${detail.phone}`}
                className="tf-press inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink"
              >
                <Icon name="chat" size={14} /> {t('message')}
              </a>
            )}
          </div>
        </div>

        {/* Stat strip */}
        <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4 border-t border-divider pt-5">
          <Stat value={formatCents(detail.priceCents, cur, locale)} label={t('kpiMrr')} />
          <Stat value={formatCents(detail.lifetimeCents, cur, locale)} label={t('lifetimePaid')} />
          <Stat value={planLabel(t, detail.productType)} label={t('colPlan')} />
          <Stat value={detail.tenureDays != null ? String(detail.tenureDays) : '-'} label={t('tenureDays')} />
        </div>

        {detail.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {detail.tags.map((tag) => (
              <span
                key={tag.slug}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium text-ink"
                style={{ borderColor: `${tag.color}55` }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
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
            <div className="mb-1 text-[12px] font-semibold uppercase tracking-[1px] text-faint">{t('sourceDetails')}</div>
            <RailRow label={t('sourceLabel')} value={<span className="capitalize">{detail.source ?? '-'}</span>} />
            {detail.isLegacy && <RailRow label={t('legacy')} value={detail.legacySource ?? 'lenus'} />}
            {detail.wasLead && <RailRow label={t('navLeads')} value={t('yes')} />}
            {detail.lenusId && <RailRow label="Lenus ID" value={<span className="font-mono text-[11px]">{detail.lenusId}</span>} />}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <ClientDetailTabs detail={detail} locale={locale} />
        </div>
      </div>
    </div>
  );
}
