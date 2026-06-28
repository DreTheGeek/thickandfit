// Coach inbox: client threads on the left, the selected conversation on the right (live via Realtime).
import type { ReactElement } from 'react';
import Link from 'next/link';
import { requireCoach } from '@/lib/auth/guards';
import { getThreads, getThread } from '@/lib/messages/messages';
import { markThreadReadAction } from '@/lib/messages/message-actions';
import { MessageThread } from '@/components/messages/message-thread';

export const dynamic = 'force-dynamic';

export default async function CoachInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  const sp = await searchParams;
  // Opening a client's thread clears its unread badge (mark their messages read before we read the
  // thread list, so the count reflects the now-read state on this same render).
  if (sp.c) await markThreadReadAction(sp.c);
  const threads = ctx.companyId ? await getThreads(ctx.companyId) : [];
  const selected = sp.c ?? threads[0]?.clientId ?? null;
  const messages = selected ? await getThread(selected) : [];

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-[480px]">
      <aside className="w-72 shrink-0 overflow-y-auto border-r border-line">
        <div className="border-b border-line px-4 py-3 text-[11px] font-semibold uppercase tracking-[2px] text-faint">
          Inbox
        </div>
        {threads.length === 0 ? (
          <p className="p-4 text-[13px] text-faint">No conversations yet.</p>
        ) : (
          threads.map((t) => (
            <Link
              key={t.clientId}
              href={`/coach/inbox?c=${t.clientId}`}
              className={[
                'block border-b border-divider px-4 py-3',
                t.clientId === selected ? 'bg-surface' : 'hover:bg-warm/40',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[14px] font-medium text-ink">{t.name}</span>
                {t.unread > 0 ? (
                  <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">
                    {t.unread}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-[12px] text-faint">{t.lastBody}</p>
            </Link>
          ))
        )}
      </aside>
      <main className="flex-1">
        {selected ? (
          <MessageThread clientId={selected} viewerId={ctx.userId} initialMessages={messages} />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-faint">
            Select a conversation.
          </div>
        )}
      </main>
    </div>
  );
}
