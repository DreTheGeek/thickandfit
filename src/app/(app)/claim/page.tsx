// Legacy-claim landing (WP13). A freshly-invited legacy client arrives here via
// /auth/callback?next=/claim after setting their password. The ClaimFlow client component runs the
// claim + photo import on mount and shows the outcome. Auth required (not entitlement: an invited
// legacy client has not subscribed yet, so requireEntitled would bounce them to /checkout).
import type { ReactElement } from 'react';
import { requireAuth } from '@/lib/auth/guards';
import { ClaimFlow } from '@/components/legacy/claim-flow';

export const dynamic = 'force-dynamic';

export default async function ClaimPage(): Promise<ReactElement> {
  await requireAuth();
  return <ClaimFlow />;
}
