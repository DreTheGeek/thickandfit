// Coach App Health: real service probes, live data counts, automation + deploy info, and the
// system coverage checklist (action -> reaction). No fabricated status lights.
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { getSystemHealth } from '@/lib/coach/system-health';
import { PageTitle } from '@/components/ui/section';
import { HealthView } from '@/components/coach/health-view';

export const dynamic = 'force-dynamic';

export default async function CoachHealthPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  const locale = await getLocale();
  if (!ctx.companyId) return <div className="p-8 text-sm text-muted">{t('noData')}</div>;

  const health = await getSystemHealth(ctx.companyId, locale);
  const degraded = health.services.some((s) => s.status === 'down');

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:py-10">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <PageTitle>{t('appHealth')}</PageTitle>
        <span
          className={[
            'rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[1px] text-white',
            degraded ? 'bg-alert' : 'bg-accent',
          ].join(' ')}
        >
          {degraded ? t('healthDegraded') : t('healthOperational')}
        </span>
      </div>
      <p className="mb-6 text-[13px] text-faint">{t('healthCheckedLive')}</p>

      <HealthView health={health} />
    </div>
  );
}
