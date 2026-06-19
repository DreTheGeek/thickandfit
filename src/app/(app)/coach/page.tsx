// Coach overview: KPI snapshot + quick links. Coach-guarded.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Eyebrow } from '@/components/ui/section';

export const dynamic = 'force-dynamic';

export default async function CoachOverviewPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  const cid = ctx.companyId;

  let subs = 0;
  let progs = 0;
  let forms = 0;
  if (cid) {
    const supabase = createServiceClient();
    const [s, p, f] = await Promise.all([
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', cid)
        .in('role', ['subscriber', 'free']),
      supabase.from('plans').select('id', { count: 'exact', head: true }).eq('company_id', cid),
      supabase.from('forms').select('id', { count: 'exact', head: true }).eq('company_id', cid),
    ]);
    subs = s.count ?? 0;
    progs = p.count ?? 0;
    forms = f.count ?? 0;
  }

  const kpis: { label: string; value: number; href: string }[] = [
    { label: t('kpiSubscribers'), value: subs, href: '/coach/subscribers' },
    { label: t('kpiPrograms'), value: progs, href: '/coach/programs' },
    { label: t('kpiForms'), value: forms, href: '/coach/forms' },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <PageHeader title={t('overview')} />
      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="tf-press">
            <Card className="p-6">
              <Eyebrow>{k.label}</Eyebrow>
              <div className="mt-3 font-display text-[48px] leading-none">{k.value}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
