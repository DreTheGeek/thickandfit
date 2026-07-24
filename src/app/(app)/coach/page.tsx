// Business Overview - the coach command center. Real metrics computed from the imported CRM
// (contacts / subscriptions / transactions / tags). This is Stephanie's whole business at a glance.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getBusinessOverview, type Bucket, type TagStat } from '@/lib/coach/overview';
import { RevenueChart } from '@/components/coach/revenue-chart';
import { formatCents } from '@/components/coach/money';
import { Eyebrow } from '@/components/ui/section';
import { Icon } from '@/components/ui/icons';

export const dynamic = 'force-dynamic';

type Translate = (key: string) => string;

// Known enum keys (subscription statuses + tag categories) get a real translation; any other
// data-derived key (lead stages, lost reasons, product types from the import) falls back to a
// title-cased, de-snaked version so nothing renders blank.
const STATUS_LABEL: Record<string, string> = {
  active: 'statusActive',
  past_due: 'statusPastDue',
  unpaid: 'statusUnpaid',
  canceled: 'statusCanceled',
  churned: 'statusChurned',
};
const CATEGORY_LABEL: Record<string, string> = {
  program: 'catProgram',
  tier: 'catTier',
  health: 'catHealth',
  service: 'catService',
  lifecycle: 'catLifecycle',
  language: 'catLanguage',
  special: 'catSpecial',
  custom: 'catCustom',
};

function fallbackLabel(key: string): string {
  const spaced = key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Resolve a data key to a label, preferring a translated enum value over title-casing. */
function labelFor(t: Translate, key: string): string {
  const mapped = STATUS_LABEL[key] ?? CATEGORY_LABEL[key];
  return mapped ? t(mapped) : fallbackLabel(key);
}

function BarList({ rows, accent, t }: { rows: Bucket[]; accent?: boolean; t: Translate }): ReactElement {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-[13px] text-soft">{labelFor(t, r.key)}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-warm">
            <span
              className={['block h-2.5 rounded-full', accent ? 'bg-accent' : 'bg-ink'].join(' ')}
              style={{ width: `${Math.max(4, (r.count / max) * 100)}%` }}
            />
          </span>
          <span className="w-8 shrink-0 text-right text-[13px] font-semibold">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }): ReactElement {
  return (
    <div className={`rounded-2xl bg-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${className}`}>{children}</div>
  );
}

export default async function CoachOverviewPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  const locale = await getLocale();
  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(
    new Date(),
  );

  const supabase = await createClient();
  const { data: me } = await supabase.from('profiles').select('full_name').eq('id', ctx.userId).maybeSingle();
  const firstName = (me?.full_name ?? '').trim().split(/\s+/)[0] || 'Coach';

  if (!ctx.companyId) {
    return <div className="p-8 text-sm text-muted">{t('emptyOverview')}</div>;
  }
  const money = (cents: number): string => formatCents(cents, 'USD', locale, 0);
  const o = await getBusinessOverview(ctx.companyId);
  const revenuePoints = o.revenueByMonth.map((m) => ({
    label: m.label,
    gross: Math.round(m.grossCents / 100),
    coach: Math.round(m.coachCents / 100),
  }));

  const kpis = [
    { label: t('kpiMrr'), value: money(o.mrrCents), sub: t('perMonth'), dark: true, warn: false },
    {
      label: t('kpiActiveMembers'),
      value: o.activeClients,
      sub: `${o.payingCurrent} ${t('kpiPayingCurrent').toLowerCase()}`,
      dark: false,
      warn: false,
    },
    {
      label: t('kpiTotalClients'),
      value: o.totalClients,
      sub: `${o.convertedFromLeads} ${t('kpiConverted').toLowerCase()}`,
      dark: false,
      warn: false,
    },
    {
      label: t('kpiLifetimeRev'),
      value: money(o.lifetimeGrossCents),
      sub: `${money(o.lifetimeCoachCents)} ${t('kpiCoachTake').toLowerCase()}`,
      dark: false,
      warn: false,
    },
    {
      label: t('kpiOpenLeads'),
      value: o.openLeads,
      sub: `${o.winRatePct}% ${t('kpiWinRate').toLowerCase()}`,
      dark: false,
      warn: false,
    },
    {
      label: t('kpiAtRisk'),
      value: o.atRisk,
      sub: `${o.churned} ${t('churnedWord')}`,
      dark: false,
      warn: true,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 lg:py-10">
      <Eyebrow>{t('overviewTitle')}</Eyebrow>
      <h1 className="tf-display mt-1 text-[34px]">{t('welcomeBack', { name: firstName })}</h1>
      <p className="mb-7 mt-1 text-sm text-faint">{dateLabel}</p>

      {/* Hero KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={[
              'rounded-2xl p-5',
              k.dark ? 'bg-ink text-bg' : 'bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
            ].join(' ')}
          >
            <div
              className={[
                'text-[10px] font-semibold uppercase tracking-[1px]',
                k.dark ? 'text-bg/55' : k.warn && Number(k.value) > 0 ? 'text-accent' : 'text-faint',
              ].join(' ')}
            >
              {k.label}
            </div>
            <div className="mt-1.5 font-display text-[28px] leading-none">{k.value}</div>
            <div className={['mt-1 text-[11px]', k.dark ? 'text-bg/45' : 'text-faint'].join(' ')}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue trend + pipeline */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-[20px]">{t('secRevenueTrend')}</h2>
            <div className="flex items-center gap-4 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-ink" />
                {t('legendGross')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent" />
                {t('legendCoach')}
              </span>
            </div>
          </div>
          {revenuePoints.length > 0 ? (
            <RevenueChart data={revenuePoints} />
          ) : (
            <p className="py-12 text-center text-sm text-faint">{t('emptyOverview')}</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-display text-[20px]">{t('secPipeline')}</h2>
          {o.pipeline.length > 0 ? (
            <BarList rows={o.pipeline} accent t={t} />
          ) : (
            <p className="py-8 text-center text-sm text-faint">{t('emptyOverview')}</p>
          )}
          <Link
            href="/coach/leads"
            className="tf-press mt-5 flex items-center justify-center gap-1.5 rounded-full border border-line py-2.5 text-[12px] font-semibold uppercase tracking-[1px] text-muted hover:border-ink hover:text-ink"
          >
            {t('navLeads')} <Icon name="chevronRight" size={14} />
          </Link>
        </Card>
      </div>

      {/* Status + product */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-display text-[20px]">{t('secClientStatus')}</h2>
          {o.statusBreakdown.length > 0 ? (
            <BarList rows={o.statusBreakdown} t={t} />
          ) : (
            <p className="py-8 text-center text-sm text-faint">{t('emptyOverview')}</p>
          )}
        </Card>
        <Card>
          <h2 className="mb-4 font-display text-[20px]">{t('secByProduct')}</h2>
          {o.productBreakdown.length > 0 ? (
            <BarList rows={o.productBreakdown} accent t={t} />
          ) : (
            <p className="py-8 text-center text-sm text-faint">{t('emptyOverview')}</p>
          )}
        </Card>
      </div>

      {/* Segments & tags */}
      <Card className="mb-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[20px]">{t('secSegments')}</h2>
          <Link href="/coach/clients" className="text-[12px] font-semibold text-muted hover:text-ink">
            {t('viewClients')}
          </Link>
        </div>
        <div className="flex flex-col gap-4">
          {o.tagGroups.map((g) => (
            <div key={g.category}>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-faint">
                {labelFor(t, g.category)}
              </div>
              <div className="flex flex-wrap gap-2">
                {g.tags.map((tag: TagStat) => (
                  <span
                    key={tag.slug}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium text-ink"
                    style={{ borderColor: `${tag.color}55` }}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.label}
                    <span className="text-[12px] font-semibold text-faint">{tag.count}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Lost reasons */}
      {o.lostReasons.length > 0 && (
        <Card>
          <h2 className="mb-4 font-display text-[20px]">{t('secLostReasons')}</h2>
          <BarList rows={o.lostReasons} t={t} />
        </Card>
      )}
    </div>
  );
}
