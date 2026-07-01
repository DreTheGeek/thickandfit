// Subscriber progress screen (PRD-24). Three tabs: Gallery (own photos), Body (weight trend,
// weekly recap, measurements), Compare (before/after). Coaches see imported Lenus photos in the
// client Files tab separately.
import type { ReactElement } from 'react';
import { requireEntitled } from '@/lib/auth/guards';
import { listPhotosAction } from '@/lib/progress-photos/actions';
import { getLegacySnapshot } from '@/lib/legacy/snapshot';
import { getBodyStats } from '@/lib/body/stats';
import { getProfileTimezone } from '@/lib/datetime/profile-timezone';
import { ProgressPhotosScreen } from '@/components/progress/progress-photos-screen';
import { LegacySnapshotCard } from '@/components/legacy/legacy-snapshot-card';

export const dynamic = 'force-dynamic';

type Tab = 'gallery' | 'body' | 'compare';

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const sp = await searchParams;
  const initialTab: Tab = sp.tab === 'body' || sp.tab === 'compare' ? sp.tab : 'gallery';
  const tz = await getProfileTimezone(ctx.userId);

  const [photos, body, snapshot] = await Promise.all([
    listPhotosAction(),
    getBodyStats(ctx.userId, tz),
    // Claimed legacy clients see a read-only "journey so far" card; null for everyone else.
    ctx.companyId ? getLegacySnapshot(ctx.userId, ctx.companyId) : Promise.resolve(null),
  ]);

  return (
    <>
      {snapshot ? (
        <div className="mx-auto max-w-lg px-[22px] pt-6">
          <LegacySnapshotCard snapshot={snapshot} />
        </div>
      ) : null}
      <ProgressPhotosScreen
        initialPhotos={photos}
        profileId={ctx.userId}
        body={body}
        initialTab={initialTab}
      />
    </>
  );
}
