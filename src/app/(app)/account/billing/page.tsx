// /account/billing — honest billing. Always shows status, the NEXT charge (amount + date),
// the card last4, and a one-tap cancel (with optional reason) or reactivate. No dark patterns.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/guards';
import { Icon } from '@/components/ui/icons';
import { PageTitle } from '@/components/ui/section';
import { Card } from '@/components/ui/card';
import { BillingActions } from '@/components/billing/billing-actions';
import {
  getSubscriptionForProfile,
  getPaymentsForProfile,
  isActiveStatus,
} from '@/lib/billing/subscriptions';

export const dynamic = 'force-dynamic';

function formatMoney(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US', {
    style: 'currency',
    currency: (currency || 'usd').toUpperCase(),
  }).format(cents / 100);
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

export default async function BillingPage(): Promise<ReactElement> {
  const ctx = await requireAuth();
  const locale = await getLocale();
  const t = await getTranslations('app.billing');

  const sub = await getSubscriptionForProfile(ctx.userId);
  const payments = await getPaymentsForProfile(ctx.userId);

  const active = isActiveStatus(sub?.status);
  const cancelling = active && Boolean(sub?.cancel_at_period_end);
  const mode: 'none' | 'active' | 'cancelling' = !active
    ? 'none'
    : cancelling
      ? 'cancelling'
      : 'active';

  const statusLabel = sub ? t(`status.${sub.status}` as never) : t('status.none');

  return (
    <div className="px-[22px] pb-7 pt-3">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/account" aria-label={t('back')} className="tf-press text-faint">
          <Icon name="arrowLeft" size={20} />
        </Link>
        <PageTitle>{t('title')}</PageTitle>
      </div>

      {/* Status + next charge card */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] uppercase tracking-[2px] text-faint">{t('plan')}</span>
          <span
            className={[
              'text-[12px] font-semibold uppercase tracking-[1.5px]',
              active ? 'text-accent' : 'text-muted',
            ].join(' ')}
          >
            {statusLabel}
          </span>
        </div>

        {sub && active ? (
          <div className="mt-4 space-y-2">
            {/* The honest core: next charge is ALWAYS visible. */}
            {cancelling ? (
              <p className="text-[15px] text-soft">
                {t('endsOn', { date: formatDate(sub.current_period_end, locale) })}
              </p>
            ) : (
              <p className="text-[15px] text-ink">
                {t('nextCharge', {
                  amount: formatMoney(sub.price_cents, sub.currency, locale),
                  date: formatDate(sub.current_period_end, locale),
                })}
              </p>
            )}
            {sub.card_last4 ? (
              <p className="text-[13px] text-muted">
                {t('cardOnFile', {
                  brand: sub.card_brand ?? t('card'),
                  last4: sub.card_last4,
                })}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-[15px] text-soft">{t('noActivePlan')}</p>
        )}

        <BillingActions mode={mode} />
      </Card>

      {/* Payment history */}
      {payments.length > 0 ? (
        <div className="mt-7">
          <h2 className="mb-3 text-[12px] uppercase tracking-[2px] text-faint">{t('history')}</h2>
          <div className="space-y-px overflow-hidden rounded-2xl bg-surface">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="text-[14px] text-ink">
                    {formatMoney(p.amount_cents, p.currency, locale)}
                  </p>
                  <p className="text-[12px] text-muted">
                    {formatDate(p.paid_at ?? p.created_at, locale)}
                  </p>
                </div>
                <span
                  className={[
                    'text-[11px] font-semibold uppercase tracking-[1.5px]',
                    p.status === 'succeeded'
                      ? 'text-accent'
                      : p.status === 'failed'
                        ? 'text-alert'
                        : 'text-muted',
                  ].join(' ')}
                >
                  {t(`payment.${p.status}` as never)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Standing subscription terms: auto-renewal summary + cancel + refund policy. Always visible,
          not just at the consent moment (ROSCA + California ARL: retained, accessible terms). */}
      <div className="mt-7 border-t border-divider pt-5">
        <h2 className="mb-3 text-[12px] uppercase tracking-[2px] text-faint">
          {t('subscriptionTerms')}
        </h2>
        <p className="text-[12px] leading-relaxed text-soft">{t('autoRenewSummary')}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-soft">{t('cancelPolicy')}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-soft">{t('refundPolicy')}</p>
      </div>

      <p className="mt-6 text-center text-[12px] leading-relaxed text-faint">{t('honestNote')}</p>
    </div>
  );
}
