'use client';

import { useEffect, useRef, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { ClientReplyBox } from '@/components/messages/client-reply-box';
import type { ClientDetail } from '@/lib/coach/clients-types';

/**
 * The conversation, always on screen.
 *
 * It used to be a tab, which meant reading a check-in and answering it were on two different
 * screens: click Messages, read, click back, forget half of it. Lenus keeps the thread pinned to
 * the right of every client screen and that is the right call, because a coach is almost always
 * looking at the data IN ORDER to say something about it.
 *
 * Newest at the bottom and scrolled there on open, which is what every chat client does and what
 * the tab version got wrong by rendering newest-first.
 */
export function ClientChatRail({ detail, locale }: { detail: ClientDetail; locale: string }): ReactElement {
  const t = useTranslations('app.coach');
  const endRef = useRef<HTMLDivElement>(null);

  // Jump to the latest without animating: a smooth scroll through 61 messages is a second of
  // flying text before she can read anything.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, []);

  const fmt = (v: string): string =>
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
      new Date(v),
    );

  // Oldest first: a conversation reads downward.
  const thread = [...detail.messages].reverse();

  return (
    <aside className="flex h-full w-full min-w-0 flex-col border-l border-line bg-surface">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-3">
        <span className="text-[12px] font-semibold uppercase tracking-[1px] text-faint">
          {t('tabMessages')}
          {detail.totalMessages > 0 && <span className="ml-1.5 text-faint">({detail.totalMessages})</span>}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4">
        {detail.totalMessages > detail.messages.length && (
          <p className="rounded-xl bg-warm/40 px-3 py-2 text-center text-[11px] text-muted">
            {t('messagesShowingRecent', { shown: detail.messages.length, total: detail.totalMessages })}
          </p>
        )}
        {thread.length === 0 && <p className="py-10 text-center text-[13px] text-faint">{t('noMessages')}</p>}
        {thread.map((m) => (
          <div key={m.id} className={`flex ${m.isFromCoach ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[86%] rounded-2xl px-3.5 py-2 ${m.isFromCoach ? 'bg-ink text-surface' : 'bg-warm text-ink'}`}
            >
              <div
                className={`mb-0.5 flex items-center gap-2 text-[10px] ${m.isFromCoach ? 'text-surface/70' : 'text-faint'}`}
              >
                <span className="font-semibold">{m.isFromCoach ? (m.senderName ?? t('messageCoach')) : detail.name}</span>
                <span>{fmt(m.sentAt)}</span>
              </div>
              {m.body && <p className="whitespace-pre-wrap break-words text-[13px] leading-snug">{m.body}</p>}
              {(m.attachments.length > 0 || m.attachmentCount > 0) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {m.attachments.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" className="tf-press block">
                      {a.kind === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.url} alt={a.name ?? ''} className="h-24 w-24 rounded-lg object-cover" loading="lazy" />
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-black/10 px-2 py-1 text-[11px]">
                          <Icon name="download" className="h-3 w-3" />
                          {a.name ?? t('messageAttachment')}
                        </span>
                      )}
                    </a>
                  ))}
                  {/* Attachments that exist but are not downloadable still get a marker, so nothing
                      in her history looks like it was lost in the migration. */}
                  {Array.from({ length: Math.max(0, m.attachmentCount - m.attachments.length) }).map((_, i) => (
                    <span
                      key={`ph-${i}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-black/10 px-2 py-1 text-[11px] opacity-70"
                    >
                      <Icon name="paperclip" className="h-3 w-3" />
                      {t('messageAttachment')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Composer pinned to the bottom, out of the scroll region, so it is reachable from anywhere
          in a 61-message history without scrolling back down. */}
      <div className="shrink-0 border-t border-line px-4 py-3">
        <ClientReplyBox contactId={detail.id} name={detail.name} hasAccount={detail.hasAccount} />
      </div>
    </aside>
  );
}
