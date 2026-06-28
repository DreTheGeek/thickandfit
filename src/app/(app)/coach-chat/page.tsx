// Subscriber AI coach chat. RSC loads the persisted history (RLS-scoped via the service client
// inside fetchHistory, after this page authorizes the member), then hands it to the streaming
// client UI. Mobile-first, matches the subscriber design surface.
import type { ReactElement } from 'react';
import { requireEntitled } from '@/lib/auth/guards';
import { fetchHistory, isConfigured } from '@/lib/coach-ai/chat';
import { CoachChat } from '@/components/coach-ai/coach-chat';

export const dynamic = 'force-dynamic';

export default async function CoachChatPage(): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const history = await fetchHistory(ctx.userId);

  return <CoachChat initialMessages={history} configured={isConfigured()} />;
}
