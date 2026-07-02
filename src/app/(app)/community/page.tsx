// Subscriber community feed (Phase 2). The living community that beats the dead Lenus/Alive feeds:
// a composer, reactions, comments, a highlighted coach broadcast, and an active challenge with a
// leaderboard. Company-scoped via RLS; coaches can post broadcasts.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireEntitled } from '@/lib/auth/guards';
import { COACH_ROLES } from '@/lib/auth/session';
import { getCommunity } from '@/lib/community/feed';
import { PageHeader } from '@/components/ui/page-header';
import { CommunityFeed } from '@/components/community/community-feed';

export const dynamic = 'force-dynamic';

export default async function CommunityPage(): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const t = await getTranslations('app.community');
  const data = await getCommunity(ctx.userId);
  const canBroadcast = COACH_ROLES.includes(ctx.role);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <CommunityFeed data={data} canBroadcast={canBroadcast} viewerId={ctx.userId} />
    </div>
  );
}
