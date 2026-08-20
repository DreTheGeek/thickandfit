// Subscriber community feed (Phase 2). The living community that beats the dead Lenus/Alive feeds:
// a composer, reactions, comments, a highlighted coach broadcast, and an active challenge with a
// leaderboard. Company-scoped via RLS; coaches can post broadcasts.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireEntitled } from '@/lib/auth/guards';
import { COACH_ROLES } from '@/lib/auth/session';
import { getCommunity } from '@/lib/community/feed';
import { PortalScreen, PortalHeader } from '@/components/portal/portal-chrome';
import { CommunityFeed } from '@/components/community/community-feed';

export const dynamic = 'force-dynamic';

export default async function CommunityPage(): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const t = await getTranslations('app.community');
  const data = await getCommunity(ctx.userId);
  const canBroadcast = COACH_ROLES.includes(ctx.role);

  return (
    // PortalHeader, not PageHeader. PageHeader is a 44-56px title over an ink keyline, which is
    // marketing scale: on a 390px phone it spent a fifth of the viewport before the first post.
    // It stays where it belongs, on the public site and the coach console.
    <PortalScreen>
      <PortalHeader title={t('title')} sub={t('subtitle')} />
      <CommunityFeed data={data} canBroadcast={canBroadcast} viewerId={ctx.userId} />
    </PortalScreen>
  );
}
