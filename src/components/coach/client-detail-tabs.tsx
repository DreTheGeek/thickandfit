'use client';

import { useState, type ReactElement, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { UnderlineTabs, type TabOption } from '@/components/ui/tabs';
import { formatCents } from '@/components/coach/money';
import type { ClientDetail } from '@/lib/coach/clients-types';

type Tab = 'overview' | 'billing' | 'payments' | 'engagement' | 'tags';

function fmtDate(value: string | null, locale: string): string {
  if (!value) return '-';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

function Row({ label, value }: { label: string; value: ReactNode }): ReactElement {
  return (
    <div className="flex items-center justify-between border-b border-divider py-2.5 last:border-0">
      <span className="text-[13px] text-faint">{label}</span>
      <span className="text-[13px] font-medium text-ink">{value}</span>
    </div>
  );
}

export function ClientDetailTabs({ detail, locale }: { detail: ClientDetail; locale: string }): ReactElement {
  const t = useTranslations('app.coach');
  const [tab, setTab] = useState<Tab>('overview');
  const cur = detail.currency;

  const options: TabOption<Tab>[] = [
    { value: 'overview', label: t('tabOverview') },
    { value: 'billing', label: t('tabBilling') },
    { value: 'payments', label: t('tabPayments') },
    { value: 'engagement', label: t('tabEngagement') },
    { value: 'tags', label: t('tabTags') },
  ];

  const billingRows = (
    <div className="rounded-2xl border border-line bg-surface px-5 py-2">
      <Row
        label={t('grandfatheredPrice')}
        value={
          <span className="flex items-center gap-2">
            {formatCents(detail.priceCents, cur, locale)}
            {detail.isLegacy && detail.priceCents != null && (
              <span className="rounded-full bg-warm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[1px] text-muted">
                {t('grandfatheredMarker')}
              </span>
            )}
          </span>
        }
      />
      <Row label={t('billingHealthLabel')} value={detail.billingHealth ?? t('healthLegacy')} />
      <Row label={t('autoRenew')} value={detail.isAutoRenew == null ? '-' : detail.isAutoRenew ? t('yes') : t('no')} />
      <Row label={t('nextBilling')} value={fmtDate(detail.nextBillingDate, locale)} />
      <Row label={t('nextAmount')} value={formatCents(detail.nextAmountCents, cur, locale)} />
      <Row label={t('lifetimePaid')} value={formatCents(detail.lifetimeCents, cur, locale, 2)} />
      <Row label={t('startedAt')} value={fmtDate(detail.startedAt, locale)} />
      <Row label={t('endedAt')} value={fmtDate(detail.endedAt, locale)} />
    </div>
  );

  return (
    <div>
      <UnderlineTabs options={options} value={tab} onChange={setTab} className="mb-5" />

      {tab === 'overview' && (
        <div className="flex flex-col gap-4">
          {billingRows}
          {detail.ledger.length > 0 && (
            <div className="rounded-2xl border border-line bg-surface px-5 py-4">
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-[1px] text-faint">{t('tabPayments')}</div>
              {detail.ledger.slice(0, 4).map((e, i) => (
                <div key={i} className="flex items-center justify-between border-b border-divider py-2 text-[13px] last:border-0">
                  <span className="text-soft">{fmtDate(e.date, locale)}</span>
                  <span className="capitalize text-faint">{e.category ?? '-'}</span>
                  <span className="font-medium tabular-nums">{formatCents(e.grossCents, e.currency, locale, 2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'billing' && billingRows}

      {tab === 'payments' && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {detail.ledger.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-faint">{t('noTransactions')}</p>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line bg-warm/40 text-left text-[10px] uppercase tracking-[1px] text-faint">
                  <th className="px-4 py-2.5 font-semibold">{t('ledgerDate')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('ledgerCategory')}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{t('ledgerGross')}</th>
                  <th className="hidden px-4 py-2.5 text-right font-semibold sm:table-cell">{t('ledgerCoach')}</th>
                  <th className="hidden px-4 py-2.5 text-right font-semibold md:table-cell">{t('ledgerTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {detail.ledger.map((e, i) => (
                  <tr key={i} className="border-b border-divider last:border-0">
                    <td className="px-4 py-2.5 text-soft">{fmtDate(e.date, locale)}</td>
                    <td className="px-4 py-2.5 capitalize">
                      <span className={e.category === 'refund' ? 'text-alert-ink' : 'text-soft'}>{e.category ?? '-'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatCents(e.grossCents, e.currency, locale, 2)}</td>
                    <td className="hidden px-4 py-2.5 text-right tabular-nums text-soft sm:table-cell">{formatCents(e.coachCents, e.currency, locale, 2)}</td>
                    <td className="hidden px-4 py-2.5 text-right tabular-nums text-faint md:table-cell">{formatCents(e.runningCents, e.currency, locale, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'engagement' &&
        (detail.snapshot ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: t('engMealPlans'), value: detail.snapshot.mealPlans },
              { label: t('engCheckins'), value: detail.snapshot.checkins },
              { label: t('engWorkouts'), value: detail.snapshot.workouts },
              { label: t('engMeasurements'), value: detail.snapshot.measurements },
              { label: t('engMessages'), value: detail.snapshot.messages },
              { label: t('engHealthAssessment'), value: detail.snapshot.healthAssessment },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-line bg-surface p-4">
                <div className="font-display text-[26px] leading-none">{s.value ?? 0}</div>
                <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-faint">{s.label}</div>
              </div>
            ))}
            {detail.snapshot.weightGoal && (
              <div className="col-span-2 rounded-2xl border border-line bg-surface p-4 sm:col-span-3">
                <span className="text-[13px] text-faint">{t('engWeightGoal')}: </span>
                <span className="text-[13px] font-medium capitalize">{detail.snapshot.weightGoal}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-faint">{t('noData')}</p>
        ))}

      {tab === 'tags' && (
        <div className="rounded-2xl border border-line bg-surface p-5">
          {detail.tags.length === 0 ? (
            <p className="py-8 text-center text-sm text-faint">{t('noTags')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {detail.tags.map((tag) => (
                <span
                  key={tag.slug}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium text-ink"
                  style={{ borderColor: `${tag.color}55` }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
