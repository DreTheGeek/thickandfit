// Coach community view: the same company feed members see, with the coach broadcast composer enabled
// (a broadcast pins an announcement and notifies every member). Reuses CommunityFeed over feed.ts.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { getCommunity } from '@/lib/community/feed';
import { CommunityFeed } from '@/components/community/community-feed';
import { PageHeader } from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

export default async function CoachCommunityPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.community');
  const data = await getCommunity(ctx.userId);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <CommunityFeed data={data} canBroadcast viewerId={ctx.userId} />
    </div>
  );
}
