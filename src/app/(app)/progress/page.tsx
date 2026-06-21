// Subscriber progress-photos screen (PRD-24, subscriber side). The client captures their own
// photos going forward; coaches see imported Lenus photos in the client Files tab separately.
import type { ReactElement } from 'react';
import { requireAuth } from '@/lib/auth/guards';
import { listPhotosAction } from '@/lib/progress-photos/actions';
import { ProgressPhotosScreen } from '@/components/progress/progress-photos-screen';

export const dynamic = 'force-dynamic';

export default async function ProgressPage(): Promise<ReactElement> {
  const ctx = await requireAuth();
  const photos = await listPhotosAction();
  return <ProgressPhotosScreen initialPhotos={photos} profileId={ctx.userId} />;
}
