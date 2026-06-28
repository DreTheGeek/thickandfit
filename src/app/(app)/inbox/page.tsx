// Subscriber inbox: the client's direct-message thread with their coach (human, distinct from the AI
// coach chat at /coach-chat). Live via Realtime. Entitlement-gated.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireEntitled } from '@/lib/auth/guards';
import { getThread } from '@/lib/messages/messages';
import { MessageThread } from '@/components/messages/message-thread';
import { PageTitle } from '@/components/ui/section';

export const dynamic = 'force-dynamic';

export default async function InboxPage(): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const t = await getTranslations('app.you');
  const messages = await getThread(ctx.userId);

  return (
    <div className="px-[22px] py-4">
      <PageTitle className="mb-3">{t('messages')}</PageTitle>
      <div className="flex h-[72vh] flex-col overflow-hidden rounded-2xl border border-line">
        <MessageThread clientId={ctx.userId} viewerId={ctx.userId} initialMessages={messages} />
      </div>
    </div>
  );
}
