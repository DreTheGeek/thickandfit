import type { ReactElement } from 'react';
import { requireCoach } from '@/lib/auth/guards';
import { BroadcastComposer } from '@/components/coach/broadcast-composer';

export const dynamic = 'force-dynamic';

export default async function CoachBroadcastsPage(): Promise<ReactElement> {
  await requireCoach();
  return <BroadcastComposer />;
}
