'use client';

import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icons';
import { StatusPill } from '@/components/coach/status-pill';
import { ClientDetailTabs } from '@/components/coach/client-detail-tabs';
import { ClientChatRail } from '@/components/coach/client-chat-rail';
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
    /* data-coach-bleed: like the inbox, this owns the viewport. It is not a document on a page, it
       is a workspace with a live conversation pinned beside it, so it opts out of the coach
       container's 1720px ceiling and gutters (see .tf-coach-page in globals.css). Before this the
       page sat in a centred column and left roughly a third of a wide screen empty while the
       conversation was hidden behind a tab. */
    <div data-coach-bleed className="flex h-[calc(100dvh-3.5rem)] min-h-[560px]">
      <div className="min-w-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
      <Link href={backHref} className="tf-press mb-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink">
        <Icon name="arrowLeft" size={15} /> {t('backToClients')}
      </Link>

      {/* Header. Three zones (identity, stats, actions) that sit on ONE row from 2xl up, so a wide
          screen reads the whole summary without scrolling. Below that they stack, which is why the
          stat strip carries its divider only at the narrow sizes where it is genuinely a new row.
          The breakpoint is 2xl and not xl on purpose: the three zones need roughly 1100px of card
          interior, and at xl (1280 viewport, minus the 256px nav) there are only ~900, which
          squeezed the name onto two lines and broke the email address mid-word. */}
      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-center 2xl:justify-between 2xl:gap-10">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar initials={detail.initials} size={64} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="tf-display text-[28px] leading-none">{detail.name}</h1>
                <StatusPill status={detail.status} health={detail.billingHealth} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-faint">
                {detail.email && <span>{detail.email}</span>}
                {detail.phone && <span>{detail.phone}</span>}
              </div>
            </div>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 border-t border-divider pt-5 sm:grid-cols-4 2xl:shrink-0 2xl:border-t-0 2xl:pt-0">
            <Stat value={formatCents(detail.priceCents, cur, locale)} label={t('kpiMrr')} />
            <Stat value={formatCents(detail.lifetimeCents, cur, locale)} label={t('lifetimePaid')} />
            <Stat value={planLabel(t, detail.productType)} label={t('colPlan')} />
            <Stat value={detail.tenureDays != null ? String(detail.tenureDays) : '-'} label={t('tenureDays')} />
          </div>

          <div className="flex flex-wrap gap-2 2xl:shrink-0">
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

        {detail.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-divider pt-4">
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

      {/* Body: rail beside the content from lg up. The rail is fixed-width because its rows are
          label/value pairs that gain nothing from extra width; every pixel past it belongs to the
          tab panel, which is what actually has content to lay out. */}
      <div className="mt-5 flex flex-col gap-5 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-[300px] xl:w-[320px]">
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
            {detail.lenusId && <RailRow label={t('lenusId')} value={<span className="font-mono text-[11px]">{detail.lenusId}</span>} />}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <ClientDetailTabs detail={detail} locale={locale} />
        </div>
      </div>
      </div>

      {/* The conversation, pinned. Hidden below xl, where there is not enough width for two
          columns and a chat panel; on those sizes the Messages tab is still in the tab row, so
          nothing becomes unreachable on a laptop or a phone. */}
      <div className="hidden w-[380px] shrink-0 xl:block 2xl:w-[440px]">
        <ClientChatRail detail={detail} locale={locale} />
      </div>
    </div>
  );
}
