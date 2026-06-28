// Subscriber progress-photos screen (PRD-24, subscriber side). The client captures their own
// photos going forward; coaches see imported Lenus photos in the client Files tab separately.
import type { ReactElement } from 'react';
import { requireEntitled } from '@/lib/auth/guards';
import { listPhotosAction } from '@/lib/progress-photos/actions';
import { getLegacySnapshot } from '@/lib/legacy/snapshot';
import { ProgressPhotosScreen } from '@/components/progress/progress-photos-screen';
import { LegacySnapshotCard } from '@/components/legacy/legacy-snapshot-card';

export const dynamic = 'force-dynamic';

export default async function ProgressPage(): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const photos = await listPhotosAction();
  // Claimed legacy clients see a read-only "journey so far" card above their gallery. Returns null
  // (renders nothing) for everyone else.
  const snapshot = ctx.companyId ? await getLegacySnapshot(ctx.userId, ctx.companyId) : null;

  return (
    <>
      {snapshot ? (
        <div className="mx-auto max-w-lg px-[22px] pt-6">
          <LegacySnapshotCard snapshot={snapshot} />
        </div>
      ) : null}
      <ProgressPhotosScreen initialPhotos={photos} profileId={ctx.userId} />
    </>
  );
}
