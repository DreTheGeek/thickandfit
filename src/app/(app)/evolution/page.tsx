// Evolution timeline (retention surface). People quit because they do not notice change, so this
// replays her own record back to her as a transformation story. Every entry is derived from a row
// she actually created: no scheduled milestones, no encouraging fictions. See
// src/lib/evolution/types.ts for the contract.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireEntitled } from '@/lib/auth/guards';
import { getEvolution } from '@/lib/evolution/timeline';
import { prefersGentleFraming } from '@/lib/health-profile/screening';
import { PortalScreen, PortalHeader } from '@/components/portal/portal-chrome';
import { EvolutionTimeline } from '@/components/evolution/evolution-timeline';

export const dynamic = 'force-dynamic';

export default async function EvolutionPage(): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const t = await getTranslations('app.evolution');
  const [data, gentle] = await Promise.all([
    getEvolution(ctx.userId, ctx.companyId),
    ctx.companyId ? prefersGentleFraming(ctx.userId, ctx.companyId) : Promise.resolve(false),
  ]);

  return (
    <PortalScreen>
      <div className="mb-[18px]">
        <PortalHeader title={t('title')} />
      </div>
      <EvolutionTimeline data={data} gentle={gentle} />
    </PortalScreen>
  );
}
