// Coach programs list. Coach-guarded. The full builder layers on /api/programs.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

type PlanRow = {
  id: string;
  name_en: string;
  weeks: number;
  is_template: boolean;
  updated_at: string;
};

export default async function CoachProgramsPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');

  let plans: PlanRow[] = [];
  if (ctx.companyId) {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('plans')
      .select('id, name_en, weeks, is_template, updated_at')
      .eq('company_id', ctx.companyId)
      .order('updated_at', { ascending: false });
    plans = (data ?? []) as PlanRow[];
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-10">
      <PageHeader title={t('programs')} />
      {plans.length === 0 ? (
        <p className="text-sm text-muted">{t('noPrograms')}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          {plans.map((p, i) => (
            <div
              key={p.id}
              className={[
                'flex items-center justify-between bg-surface px-4 py-3.5',
                i < plans.length - 1 ? 'border-b border-divider' : '',
              ].join(' ')}
            >
              <span className="font-medium">{p.name_en}</span>
              <span className="flex items-center gap-2 text-[12px] text-faint">
                {p.weeks}w
                {p.is_template && <Badge variant="inactive">{t('template')}</Badge>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
