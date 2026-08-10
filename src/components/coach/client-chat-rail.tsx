'use client';

import { useEffect, useRef, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { ClientReplyBox } from '@/components/messages/client-reply-box';
import type { ClientDetail, ClientMessage } from '@/lib/coach/clients-types';

/**
 * The conversation, always on screen.
 *
 * It used to be a tab, which meant reading a check-in and answering it were on two different
 * screens. Lenus keeps the thread pinned beside every client screen, because a coach is almost
 * always looking at the data IN ORDER to say something about it.
 *
 * THE READABILITY RULES ARE BORROWED FROM THEIRS, the palette is not.
 *
 *  - The timestamp and sender sit on a centred line ABOVE a group, not squeezed into the bubble in
 *    10px type. A bubble should carry the message and nothing else.
 *  - Consecutive messages from the same person inside half an hour are one group with one heading.
 *    Stephanie sends three-paragraph welcomes as several sends; stamping each one turns a single
 *    thought into three timestamped events.
 *  - 14px with relaxed leading. The old 13px/snug was set for a narrow tab and is genuinely hard to
 *    read across a 440px rail.
 *  - A file is a card with its name, not a chip. Half of what Daniella sends IS the attachment (the
 *    2-week protocol PDF), so it cannot be smaller than the sentence introducing it.
 */
export function ClientChatRail({ detail, locale }: { detail: ClientDetail; locale: string }): ReactElement {
  const t = useTranslations('app.coach');
  const endRef = useRef<HTMLDivElement>(null);

  // Jump to the latest without animating: a smooth scroll through 61 messages is a second of flying
  // text before she can read anything.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, []);

  const stamp = (v: string): string =>
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
      new Date(v),
    );

  // Oldest first: a conversation reads downward.
  const thread = [...detail.messages].reverse();

  // Group by sender and a 30-minute window. Same rule Lenus uses, and the reason their long welcome
  // reads as one message instead of four.
  const GROUP_MS = 30 * 60 * 1000;
  const groups: ClientMessage[][] = [];
  for (const m of thread) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    const sameSender = prev && prev.isFromCoach === m.isFromCoach && prev.senderName === m.senderName;
    const close = prev && Date.parse(m.sentAt) - Date.parse(prev.sentAt) < GROUP_MS;
    if (last && sameSender && close) last.push(m);
    else groups.push([m]);
  }

  return (
    <aside className="flex h-full w-full min-w-0 flex-col border-l border-line bg-surface">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-5 py-3.5">
        <span className="text-[12px] font-semibold uppercase tracking-[1px] text-faint">
          {t('tabMessages')}
          {detail.totalMessages > 0 && <span className="ml-1.5 text-faint">({detail.totalMessages})</span>}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
        {detail.totalMessages > detail.messages.length && (
          <p className="rounded-xl bg-warm/50 px-3 py-2 text-center text-[11px] text-muted">
            {t('messagesShowingRecent', { shown: detail.messages.length, total: detail.totalMessages })}
          </p>
        )}
        {groups.length === 0 && <p className="py-10 text-center text-[13px] text-faint">{t('noMessages')}</p>}

        {groups.map((group, gi) => {
          const head = group[0];
          const who = head.isFromCoach ? (head.senderName ?? t('messageCoach')) : detail.name;
          return (
            <div key={`${head.id}-${gi}`} className="flex flex-col gap-1.5">
              <p className="text-center text-[11px] text-faint">
                {stamp(head.sentAt)} · {who}
              </p>
              {group.map((m) => (
                <div key={m.id} className={`flex ${m.isFromCoach ? 'justify-end' : 'justify-start'}`}>
                  <div className="flex max-w-[88%] flex-col gap-1.5">
                    {m.body && (
                      /* BOTH BUBBLES ARE LIGHT, which is the real lesson from Lenus. They separate
                         sender by hue (blue vs grey), not by weight. Solid black was fine for a
                         one-line reply and turned Stephanie's twelve-line welcome into a slab of
                         inverted text down the whole rail, which is unreadable and was the actual
                         complaint. Monochrome cannot use hue, so: hers filled, theirs outlined. */
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed text-ink ${
                          m.isFromCoach ? 'bg-warm' : 'border border-line bg-surface'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      </div>
                    )}
                    {m.attachments.map((a, i) =>
                      a.kind === 'image' ? (
                        <a key={i} href={a.url} target="_blank" rel="noreferrer" className="tf-press block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={a.url}
                            alt={a.name ?? ''}
                            className="max-h-64 w-full rounded-2xl object-cover"
                            loading="lazy"
                          />
                        </a>
                      ) : (
                        <a
                          key={i}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="tf-press flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2.5 hover:border-ink"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warm text-soft">
                            <Icon name="file" size={16} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-ink">
                              {a.name ?? t('messageAttachment')}
                            </span>
                            <span className="block text-[11px] text-faint">{t('messageAttachment')}</span>
                          </span>
                          <Icon name="chevronRight" size={14} />
                        </a>
                      ),
                    )}
                    {/* Attachments that exist but are not downloadable still get a marker, so nothing
                        in her history looks like it was lost in the migration. */}
                    {Array.from({ length: Math.max(0, m.attachmentCount - m.attachments.length) }).map((_, i) => (
                      <span
                        key={`ph-${i}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-warm px-2.5 py-1.5 text-[11px] text-muted"
                      >
                        <Icon name="paperclip" size={12} />
                        {t('messageAttachment')}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Composer pinned below the scroll region, so it is reachable from anywhere in a 61-message
          history without scrolling back down. */}
      <div className="shrink-0 border-t border-line px-4 py-3">
        <ClientReplyBox contactId={detail.id} name={detail.name} hasAccount={detail.hasAccount} />
      </div>
    </aside>
  );
}
