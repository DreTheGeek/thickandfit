// The rota: who is standing in while a coach is away.
//
// Members assigned to the away coach move to whoever is covering, automatically, for exactly the
// dates set here — see coverage-shared.ts for the resolution rules, including what happens when two
// coaches cover each other by mistake.
//
// WHY THIS PAGE EXISTS SEPARATELY from /coach/settings: settings are how the product behaves for
// everybody and change rarely; this is a rota entry someone makes the week before a holiday and
// cancels when plans change. Burying an absence three levels into a settings tree is how a coach
// leaves without recording one.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { notFound } from 'next/navigation';
import { PageTitle } from '@/components/ui/section';
import { Card } from '@/components/ui/card';
import { listAssignableCoaches, listCoverage } from '@/lib/coach/coverage';
import { createServiceClient } from '@/lib/supabase/service';
import { CoverageManager, type CoverageRow } from '@/components/coach/coverage-manager';

export const dynamic = 'force-dynamic';

export default async function CoachCoveragePage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  if (!ctx.companyId) notFound();
  const t = await getTranslations('app.coach');
  const today = new Date().toISOString().slice(0, 10);

  const svc = createServiceClient();
  const [coaches, coverages, { data: raw }] = await Promise.all([
    listAssignableCoaches(ctx.companyId),
    listCoverage(ctx.companyId),
    // listCoverage drops the id (the resolver has no use for it) and this page needs it to cancel a
    // row. Read once more rather than widening the resolver's type for a UI concern.
    svc
      .from('coach_coverage')
      .select('id, coach_id, covering_coach_id, starts_on, ends_on, note')
      .eq('company_id', ctx.companyId)
      .gte('ends_on', today)
      .order('starts_on', { ascending: true })
      .limit(500),
  ]);

  const nameById = new Map(coaches.map((c) => [c.id, c.name]));
  const rows: CoverageRow[] = (
    (raw ?? []) as {
      id: string;
      coach_id: string;
      covering_coach_id: string;
      starts_on: string;
      ends_on: string;
      note: string | null;
    }[]
  ).map((r) => ({
    id: r.id,
    awayName: nameById.get(r.coach_id) ?? 'Coach',
    coveringName: nameById.get(r.covering_coach_id) ?? 'Coach',
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    note: r.note,
    // Computed on the server: a client component deciding "is this live" from its own clock would
    // disagree with the resolver the queues use, and the two answers must be the same one.
    active: r.starts_on <= today && today <= r.ends_on,
  }));

  return (
    <div className="px-[22px] pb-7 pt-3">
      <PageTitle className="mb-2">{t('coverageTitle')}</PageTitle>
      <p className="mb-5 max-w-prose text-[14px] leading-relaxed text-muted">{t('coverageLead')}</p>
      <Card className="p-5">
        <CoverageManager coaches={coaches} rows={rows} coveragesLoaded={coverages.length} />
      </Card>
    </div>
  );
}
