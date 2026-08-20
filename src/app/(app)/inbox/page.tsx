// Subscriber inbox: the client's direct-message thread with their coach (human, distinct from the AI
// coach chat at /coach-chat). Live via Realtime. Entitlement-gated.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireAuthOrPaused } from '@/lib/auth/guards';
import { getThread } from '@/lib/messages/messages';
import { getRecentPRs } from '@/lib/workout/recent-prs';
import { MessageThread } from '@/components/messages/message-thread';
import { PortalScreen, PortalHeader } from '@/components/portal/portal-chrome';
import { CoachTabs } from '@/components/portal/coach-tabs';
import { CoachHead } from '@/components/portal/coach-head';
import { CoachActions } from '@/components/portal/coach-actions';

export const dynamic = 'force-dynamic';

export default async function InboxPage(): Promise<ReactElement> {
  const ctx = await requireAuthOrPaused();
  const t = await getTranslations('app.you');
  const tn = await getTranslations('app.nav');
  const [messages, prs] = await Promise.all([
    getThread(ctx.userId),
    // Read from set_logs and drawn into the timeline, not stored as messages: the coach console
    // reads the same table, so a PR row would land in Stephanie's inbox as something to read.
    ctx.companyId ? getRecentPRs(ctx.companyId, ctx.userId) : Promise.resolve([]),
  ]);

  return (
    <PortalScreen>
      {/* One Coach screen with two tabs, per the handoff. The nav already treats /inbox and
          /coach-chat as one destination; this makes that visible to the member instead of leaving
          her to discover that the coach she can reach has two different front doors. */}
      <PortalHeader title={tn('coach')} />
      <CoachHead />
      <CoachTabs />
      <CoachActions />
      <div className="flex h-[68vh] flex-col overflow-hidden rounded-2xl border border-line">
        <MessageThread clientId={ctx.userId} viewerId={ctx.userId} initialMessages={messages} prs={prs} />
      </div>
      <p className="mt-2.5 text-[11px] text-faint">{t('coachHumanNote')}</p>
    </PortalScreen>
  );
}
