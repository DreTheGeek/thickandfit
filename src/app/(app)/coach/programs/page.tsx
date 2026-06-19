// Coach programs list. Coach-guarded. Links to the builder; "New Program" creates one.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { PageTitle } from '@/components/ui/section';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icons';

export const dynamic = 'force-dynamic';

type PlanRow = { id: string; name_en: string; weeks: number; is_template: boolean };

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
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 lg:py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <PageTitle>{t('programs')}</PageTitle>
        <ButtonLink href="/coach/programs/new" size="sm" className="shrink-0">
          {t('newProgram')}
        </ButtonLink>
      </div>
      {plans.length === 0 ? (
        <p className="text-sm text-muted">{t('noPrograms')}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {plans.map((p, i) => (
            <Link
              key={p.id}
              href={`/coach/programs/${p.id}`}
              className={[
                'tf-press flex items-center justify-between px-4 py-3.5',
                i < plans.length - 1 ? 'border-b border-divider' : '',
              ].join(' ')}
            >
              <span className="font-medium">{p.name_en}</span>
              <span className="flex items-center gap-2 text-[12px] text-faint">
                {p.weeks}w
                {p.is_template && <Badge variant="inactive">{t('template')}</Badge>}
                <Icon name="chevronRight" size={16} className="text-line" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
