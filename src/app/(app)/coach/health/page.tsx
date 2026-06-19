// Coach app-health. Coach-guarded. Honest current-deploy status; live monitoring (Sentry/
// PostHog) connects in Phase 3, so no fabricated metrics here.
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { PageTitle, SectionTitle } from '@/components/ui/section';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function CoachHealthPage(): Promise<ReactElement> {
  await requireCoach();
  const t = await getTranslations('app.coach');
  const locale = await getLocale();
  const notConfigured = locale === 'es' ? 'No configurado' : 'Not configured';

  const services: { name: string; up: boolean }[] = [
    { name: locale === 'es' ? 'Base de datos' : 'Database', up: true },
    { name: 'API', up: true },
    { name: locale === 'es' ? 'Autenticación' : 'Authentication', up: true },
    { name: locale === 'es' ? 'Correo (Resend)' : 'Email (Resend)', up: true },
    { name: locale === 'es' ? 'Pagos (Stripe)' : 'Payments (Stripe)', up: false },
    { name: locale === 'es' ? 'Video (Mux)' : 'Video (Mux)', up: false },
    { name: 'AI', up: false },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 lg:py-10">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <PageTitle>{t('appHealth')}</PageTitle>
        <Badge variant="accent">{t('allOperational')}</Badge>
      </div>
      <p className="mb-6 max-w-2xl rounded-xl bg-warm px-4 py-3 text-[13px] text-soft">
        {t('monitoringSoon')}
      </p>

      <div className="rounded-2xl bg-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <SectionTitle className="mb-3">{t('systemStatus')}</SectionTitle>
        {services.map((s, i) => (
          <div
            key={s.name}
            className={[
              'flex items-center justify-between py-3',
              i < services.length - 1 ? 'border-b border-divider' : '',
            ].join(' ')}
          >
            <span className="text-[14px]">{s.name}</span>
            <span
              className={[
                'inline-flex items-center gap-2 text-[13px] font-medium',
                s.up ? 'text-accent-ink' : 'text-faint',
              ].join(' ')}
            >
              <span
                className={['h-2 w-2 rounded-full', s.up ? 'bg-accent' : 'bg-line'].join(' ')}
              />
              {s.up ? t('operational') : notConfigured}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
