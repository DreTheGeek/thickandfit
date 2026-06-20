'use client';

import { useState, type ReactElement, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { UnderlineTabs, type TabOption } from '@/components/ui/tabs';
import { Icon } from '@/components/ui/icons';
import { MacroRing } from '@/components/coach/macro-ring';
import { RecipeImage } from '@/components/coach/recipe-image';
import { formatCents } from '@/components/coach/money';
import type { ClientDetail } from '@/lib/coach/clients-types';

type Tab = 'overview' | 'billing' | 'payments' | 'nutrition' | 'files' | 'engagement' | 'tags';

function fmtDate(value: string | null, locale: string): string {
  if (!value) return '-';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

function fmtBytes(b: number | null): string {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function Row({ label, value }: { label: string; value: ReactNode }): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-divider py-2.5 last:border-0">
      <span className="text-[13px] text-faint">{label}</span>
      <span className="text-right text-[13px] font-medium text-ink">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-2">
      <div className="-mx-5 mb-1 border-b border-divider px-5 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[1px] text-faint">{title}</div>
      {children}
    </div>
  );
}

export function ClientDetailTabs({ detail, locale }: { detail: ClientDetail; locale: string }): ReactElement {
  const t = useTranslations('app.coach');
  const [tab, setTab] = useState<Tab>('overview');
  const cur = detail.currency;
  const mp = detail.mealPlan;
  const photos = detail.files.filter((f) => f.category === 'progress_photos');
  const docs = detail.files.filter((f) => f.category !== 'progress_photos');

  const options: TabOption<Tab>[] = [
    { value: 'overview', label: t('tabOverview') },
    { value: 'billing', label: t('tabBilling') },
    { value: 'payments', label: t('tabPayments') },
    { value: 'nutrition', label: t('tabNutrition') },
    { value: 'files', label: detail.files.length > 0 ? `${t('tabFiles')} (${detail.files.length})` : t('tabFiles') },
    { value: 'engagement', label: t('tabEngagement') },
    { value: 'tags', label: t('tabTags') },
  ];

  const mealPlanCard = (full: boolean): ReactElement | null => {
    if (!mp) {
      return full ? <p className="rounded-2xl border border-line bg-surface py-12 text-center text-sm text-faint">{t('noMealPlanAssigned')}</p> : null;
    }
    return (
      <Link href={`/coach/tool/meal-plans/${mp.id}`} className="tf-press block rounded-2xl border border-line bg-surface p-5 hover:border-ink">
        <div className="flex items-center gap-4">
          <MacroRing proteinG={mp.proteinG ?? 0} carbG={mp.carbG ?? 0} fatG={mp.fatG ?? 0} kcal={mp.calorieGoal ?? 0} size={72} />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">{t('assignedMealPlan')}</div>
            <div className="truncate font-display text-[18px] leading-tight">{mp.name}</div>
            <div className="mt-1 text-[12px] text-muted">
              {mp.calorieGoal != null && <span>{mp.calorieGoal} kcal · </span>}
              {Math.round(mp.proteinG ?? 0)}p / {Math.round(mp.carbG ?? 0)}c / {Math.round(mp.fatG ?? 0)}f
            </div>
          </div>
          <Icon name="chevronRight" size={18} className="shrink-0 text-line" />
        </div>
      </Link>
    );
  };

  const planDelivery = (detail.mealPlanSentAt || detail.workoutPlanSentAt) && (
    <Section title={t('planDelivery')}>
      <Row label={t('mealPlanSent')} value={fmtDate(detail.mealPlanSentAt, locale)} />
      <Row label={t('workoutPlanSent')} value={fmtDate(detail.workoutPlanSentAt, locale)} />
    </Section>
  );

  const fullBilling = (
    <Section title={t('tabBilling')}>
      <Row
        label={t('grandfatheredPrice')}
        value={
          <span className="flex items-center justify-end gap-2">
            {formatCents(detail.priceCents, cur, locale)}
            {detail.isLegacy && detail.priceCents != null && (
              <span className="rounded-full bg-warm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[1px] text-muted">{t('grandfatheredMarker')}</span>
            )}
          </span>
        }
      />
      <Row label={t('billingHealthLabel')} value={detail.billingHealth ?? t('healthLegacy')} />
      <Row label={t('autoRenew')} value={detail.isAutoRenew == null ? '-' : detail.isAutoRenew ? t('yes') : t('no')} />
      <Row label={t('nextBilling')} value={fmtDate(detail.nextBillingDate, locale)} />
      <Row label={t('nextAmount')} value={formatCents(detail.nextAmountCents, cur, locale)} />
      <Row label={t('lastCharge')} value={fmtDate(detail.lastChargeDate, locale)} />
      <Row label={t('totalCharges')} value={detail.numCharges ?? '-'} />
      <Row label={t('lifetimePaid')} value={formatCents(detail.lifetimeCents, cur, locale, 2)} />
      <Row label={t('startedAt')} value={fmtDate(detail.startedAt, locale)} />
      <Row label={t('endedAt')} value={fmtDate(detail.endedAt, locale)} />
    </Section>
  );

  return (
    <div>
      <UnderlineTabs options={options} value={tab} onChange={setTab} className="mb-5" />

      {tab === 'overview' && (
        <div className="flex flex-col gap-4">
          <Section title={t('membership')}>
            <Row label={t('facetStatus')} value={<span className="capitalize">{detail.status ?? '-'}</span>} />
            <Row label={t('nextBilling')} value={fmtDate(detail.nextBillingDate, locale)} />
            <Row label={t('nextAmount')} value={formatCents(detail.nextAmountCents, cur, locale)} />
            <Row label={t('lastCharge')} value={fmtDate(detail.lastChargeDate, locale)} />
            <Row label={t('autoRenew')} value={detail.isAutoRenew == null ? '-' : detail.isAutoRenew ? t('yes') : t('no')} />
          </Section>
          {planDelivery}
          {mealPlanCard(false)}
          {detail.ledger.length > 0 && (
            <Section title={t('tabPayments')}>
              {detail.ledger.slice(0, 4).map((e, i) => (
                <div key={i} className="flex items-center justify-between border-b border-divider py-2 text-[13px] last:border-0">
                  <span className="text-soft">{fmtDate(e.date, locale)}</span>
                  <span className="capitalize text-faint">{e.category ?? '-'}</span>
                  <span className="font-medium tabular-nums">{formatCents(e.grossCents, e.currency, locale, 2)}</span>
                </div>
              ))}
            </Section>
          )}
        </div>
      )}

      {tab === 'billing' && fullBilling}

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

      {tab === 'nutrition' && (
        <div className="flex flex-col gap-4">
          {mealPlanCard(true)}
          {planDelivery}
        </div>
      )}

      {tab === 'files' &&
        (detail.files.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface py-12 text-center text-sm text-faint">{t('noFiles')}</p>
        ) : (
          <div className="flex flex-col gap-6">
            {photos.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[1px] text-faint">
                  {t('progressPhotos')} · {photos.length}
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {photos.slice(0, 60).map((f, i) => (
                    <a
                      key={i}
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tf-press relative aspect-square overflow-hidden rounded-xl border border-line bg-warm"
                    >
                      <RecipeImage src={f.url} alt="" icon="camera" sizes="200px" />
                    </a>
                  ))}
                </div>
                {photos.length > 60 && <div className="mt-2 text-[12px] text-faint">{t('plusMore', { n: photos.length - 60 })}</div>}
              </div>
            )}
            {docs.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[1px] text-faint">
                  {t('documents')} · {docs.length}
                </div>
                <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                  {docs.map((f, i) => (
                    <a
                      key={i}
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tf-press flex items-center justify-between gap-3 border-b border-divider px-4 py-3 last:border-0 hover:bg-warm/50"
                    >
                      <span className="truncate text-[13px] capitalize">{(f.category ?? 'file').replace(/_/g, ' ')}</span>
                      <span className="shrink-0 text-[12px] text-faint">{fmtBytes(f.bytes)}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

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
