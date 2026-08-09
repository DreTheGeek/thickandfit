// Coach inbox: contact-centric threads (migrated conversation archive + live in-app messages) on the
// left, the selected conversation + composer on the right. Works for every client, whether or not
// they have joined the app (unclaimed clients are messaged by email). "New message" opens the picker.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { Icon } from '@/components/ui/icons';
import { getInboxThreads, getContactThread, getClientPickerList } from '@/lib/messages/inbox';
import { CoachConversation } from '@/components/messages/coach-conversation';
import { NewMessagePicker } from '@/components/messages/new-message-picker';

export const dynamic = 'force-dynamic';

function fmtWhen(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}

export default async function CoachInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; new?: string }>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  // Named `common`, not `t`: the thread list below already binds `t` to each thread in its map.
  const common = await getTranslations('app.common');
  const sp = await searchParams;
  const threads = ctx.companyId ? await getInboxThreads(ctx.companyId) : [];
  // Two different questions. `selected` is which thread to render, and on a desktop it falls back
  // to the newest so the pane is never empty. `opened` is whether the coach actually chose one,
  // which is what decides the phone layout: defaulting to the first thread there would mean the
  // inbox never shows its own list.
  const opened = Boolean(sp.c || sp.new);
  const selected = sp.c ?? threads[0]?.contactId ?? null;
  const thread = selected && ctx.companyId ? await getContactThread(ctx.companyId, selected) : null;

  return (
    // data-coach-bleed: this is a three-pane mail client that owns the viewport, so it opts out of
    // the coach container's max-width and gutters (see .tf-coach-page in globals.css).
    <div data-coach-bleed className="flex h-[calc(100dvh-3.5rem)] min-h-[480px]">
      {/* One pane at a time below lg. Side by side, a 288px list left the conversation 100px on a
          390px phone, which rendered "Test" as "Tes / t" and pushed the composer off screen. From
          lg both panes show, and the list earns width on a big screen: at w-72 every name and
          preview was clipped mid-word while 1300px of empty message pane sat next to it. */}
      <aside
        className={[
          'w-full shrink-0 flex-col overflow-hidden border-line lg:flex lg:w-72 lg:border-r xl:w-80 2xl:w-96',
          opened ? 'hidden' : 'flex',
        ].join(' ')}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">Inbox</span>
          <Link
            href="/coach/inbox?new=1"
            className="tf-press rounded-full bg-ink px-3 py-1 text-[11px] font-semibold text-surface"
          >
            + New
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <p className="p-4 text-[13px] text-faint">No conversations yet. Hit + New to message a client.</p>
          ) : (
            threads.map((t) => (
              <Link
                key={t.contactId}
                href={`/coach/inbox?c=${t.contactId}`}
                className={['block border-b border-divider px-4 py-3', t.contactId === selected ? 'bg-surface' : 'hover:bg-warm/40'].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-medium text-ink">{t.name}</span>
                  <span className="shrink-0 text-[10px] text-faint">{fmtWhen(t.lastAt)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {!t.hasAccount && <span className="shrink-0 rounded-full bg-warm px-1.5 py-px text-[9px] font-semibold uppercase text-soft">email</span>}
                  <p className="truncate text-[12px] text-faint">{t.lastBody}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </aside>
      <main className={['min-w-0 flex-1 flex-col overflow-hidden lg:flex', opened ? 'flex' : 'hidden'].join(' ')}>
        {/* Phone-only way back to the list, since the list is hidden while a thread is open. */}
        <Link
          href="/coach/inbox"
          className="tf-press flex items-center gap-1.5 border-b border-line px-4 py-2.5 text-[13px] font-semibold text-muted lg:hidden"
        >
          <Icon name="arrowLeft" size={15} /> {common('back')}
        </Link>
        <div className="min-h-0 flex-1 overflow-hidden">
        {sp.new ? (
          <NewMessagePicker clients={ctx.companyId ? await getClientPickerList(ctx.companyId) : []} />
        ) : thread ? (
          <CoachConversation contactId={selected as string} name={thread.name} hasAccount={thread.hasAccount} initialMessages={thread.messages} />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-faint">Select a conversation, or hit + New.</div>
        )}
        </div>
      </main>
    </div>
  );
}
