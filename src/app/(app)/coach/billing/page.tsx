// Coach Billing & Renewals: MRR, who renews in the next 30 days, who is failed/overdue, and a
// per-client renewal table sorted with failures first. Reuses the imported CRM billing data.
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { getBillingRenewals } from '@/lib/coach/billing-renewals';
import { PageTitle } from '@/components/ui/section';

export const dynamic = 'force-dynamic';

function money(cents: number | null, currency: string): string {
  if (cents == null) return '-';
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `$${Math.round(cents / 100)}`;
  }
}
function fmtDate(d: string | null, locale: string): string {
  if (!d) return '-';
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(d));
}

export default async function CoachBillingPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const locale = await getLocale();
  const t = await getTranslations('app.coach');
  const data = ctx.companyId
    ? await getBillingRenewals(ctx.companyId)
    : { mrrCents: 0, renewSoon: 0, failedOverdue: 0, rows: [] };

  return (
    <div className="px-[22px] py-6">
      <PageTitle className="mb-5">{t('billingTitle')}</PageTitle>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-ink p-4 text-bg">
          <div className="text-[11px] uppercase tracking-[2px] opacity-70">{t('billingMrr')}</div>
          <div className="tf-display mt-1 text-[24px]">{money(data.mrrCents, 'usd')}</div>
        </div>
        <div className="rounded-2xl border border-line p-4">
          <div className="text-[11px] uppercase tracking-[2px] text-faint">{t('billingRenewSoon')}</div>
          <div className="tf-display mt-1 text-[24px] text-ink">{data.renewSoon}</div>
        </div>
        <div className="rounded-2xl border border-line p-4">
          <div className="text-[11px] uppercase tracking-[2px] text-faint">{t('billingFailedOverdue')}</div>
          <div className="tf-display mt-1 text-[24px] text-red-600">{data.failedOverdue}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line">
        <div className="grid grid-cols-[1fr_5rem_6rem_6rem] gap-3 border-b border-line bg-surface px-4 py-2 text-[11px] font-semibold uppercase tracking-[1px] text-faint">
          <span>{t('colClient')}</span>
          <span className="text-right">{t('billingColPrice')}</span>
          <span className="text-right">{t('nextBilling')}</span>
          <span className="text-right">{t('colStatus')}</span>
        </div>
        {data.rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-faint">{t('billingNoSubs')}</div>
        ) : (
          data.rows.map((r) => (
            <div
              key={r.contactId}
              className="grid grid-cols-[1fr_5rem_6rem_6rem] items-center gap-3 border-b border-divider px-4 py-2.5 text-[13px] last:border-0"
            >
              <span className="truncate font-medium text-ink">{r.name}</span>
              <span className="text-right tabular-nums text-soft">{money(r.priceCents, r.currency)}</span>
              <span className="text-right tabular-nums text-faint">{fmtDate(r.nextBillingDate, locale)}</span>
              <span
                className={[
                  'text-right',
                  r.flag === 'failed'
                    ? 'font-semibold text-red-600'
                    : r.flag === 'soon'
                      ? 'text-ink'
                      : 'text-faint',
                ].join(' ')}
              >
                {r.flag === 'failed' ? t('billingFailed') : r.flag === 'soon' ? t('billingScheduled') : (r.status ?? '-')}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
