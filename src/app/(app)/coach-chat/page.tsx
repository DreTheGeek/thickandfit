// Subscriber AI coach chat. RSC loads the persisted history (RLS-scoped via the service client
// inside fetchHistory, after this page authorizes the member), then hands it to the streaming
// client UI. Mobile-first, matches the subscriber design surface.
import type { ReactElement } from 'react';
import { requireEntitled } from '@/lib/auth/guards';
import { fetchHistory, isConfigured } from '@/lib/coach-ai/chat';
import { CoachChat } from '@/components/coach-ai/coach-chat';
import { getTranslations } from 'next-intl/server';
import { PortalScreen, PortalHeader } from '@/components/portal/portal-chrome';
import { CoachTabs } from '@/components/portal/coach-tabs';

export const dynamic = 'force-dynamic';

export default async function CoachChatPage(): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const history = await fetchHistory(ctx.userId);
  const tn = await getTranslations('app.nav');

  // Same header and same tabs as /inbox, so the two routes read as one screen with two threads
  // rather than as two unrelated places that happen to share a nav tab.
  return (
    <PortalScreen>
      <PortalHeader title={tn('coach')} />
      <CoachTabs />
      <CoachChat initialMessages={history} configured={isConfigured()} />
    </PortalScreen>
  );
}
