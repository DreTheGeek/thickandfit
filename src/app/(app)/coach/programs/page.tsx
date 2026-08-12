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

type PlanRow = { id: string; name_en: string; weeks: number; is_template: boolean; days: number };

export default async function CoachProgramsPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');

  let plans: PlanRow[] = [];
  if (ctx.companyId) {
    const supabase = createServiceClient();
    // The DAY COUNT is what she reads first. Her Lenus library listed every program as "5 ITEMS" or
    // "7 ITEMS", because that is how you tell a 3-day split from a 5-day one at a glance, and the
    // name does not always say it. Sorted by name rather than updated_at: the import stamped all 40
    // within the same minute, so recency ordering scrambled a library whose names are already
    // deliberately sequential (Month 1, Month 2, Month 3).
    const [{ data }, { data: sessionRows }] = await Promise.all([
      supabase
        .from('plans')
        .select('id, name_en, weeks, is_template')
        .eq('company_id', ctx.companyId)
        .order('name_en', { ascending: true }),
      supabase.from('sessions').select('plan_id').eq('company_id', ctx.companyId),
    ]);
    const dayCount = new Map<string, number>();
    for (const s of (sessionRows ?? []) as { plan_id: string | null }[]) {
      if (s.plan_id) dayCount.set(s.plan_id, (dayCount.get(s.plan_id) ?? 0) + 1);
    }
    plans = ((data ?? []) as Omit<PlanRow, 'days'>[]).map((p) => ({ ...p, days: dayCount.get(p.id) ?? 0 }));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <PageTitle>{t('programs')}</PageTitle>
        <ButtonLink href="/coach/programs/new" size="sm" className="shrink-0">
          {t('newProgram')}
        </ButtonLink>
      </div>
      {plans.length === 0 ? (
        <p className="text-sm text-muted">{t('noPrograms')}</p>
      ) : (
        // Tiles, not full-width rows. A program row carries a name and a duration, so stretched
        // across a 1600px screen it put the two ends a monitor apart with nothing in between. Same
        // card grid the exercise library uses.
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {plans.map((p) => (
            <Link
              key={p.id}
              href={`/coach/programs/${p.id}`}
              className="tf-press flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 hover:border-ink"
            >
              <span className="min-w-0 truncate font-medium">{p.name_en}</span>
              <span className="flex shrink-0 items-center gap-2 text-[12px] text-faint">
                {p.days > 0 && <span className="text-muted">{t('planDays', { n: p.days })}</span>}
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
