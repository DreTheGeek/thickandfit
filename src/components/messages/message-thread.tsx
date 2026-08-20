'use client';

import { useEffect, useRef, useState, useTransition, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { createClient } from '@/lib/supabase/client';
import { sendMessageAction } from '@/lib/messages/message-actions';
import type { ThreadMessage } from '@/lib/messages/messages';

// Date context for the thread: which calendar day a message belongs to (divider grouping)
// and a short time for each bubble.
//
// BOTH ARE TIMEZONE-DEPENDENT, so both are rendered with suppressHydrationWarning. toLocaleTimeString
// has no timezone argument here, which is correct (she should see her own clock), but it means the
// server renders 16:56 in the lambda's UTC and the browser renders 11:56 AM in hers. React saw two
// different strings and threw #418 on every visit to /inbox, discarding the server HTML and
// re-rendering the whole thread on the client.
//
// suppressHydrationWarning is the intended answer for exactly this: text that is SUPPOSED to differ
// between server and client. The alternative, rendering the timestamps only after mount, flashes
// blank on the one screen where the timing of a message is the point. The day divider gets the same
// treatment for the same reason: it compares against `new Date()`, so a message sent at 9pm local
// can be "Today" on her clock and yesterday on the server's.
/**
 * Which day a message groups under. UTC, and that is the whole point.
 *
 * This was `new Date(iso).toDateString()`, which is LOCAL, so the server (UTC) and the browser (her
 * timezone) could disagree about whether two messages fall on the same day. That decides whether a
 * divider ELEMENT exists, so the server HTML and the client tree had different structure and React
 * threw #418 with an HTML mismatch, discarding the server render.
 *
 * suppressHydrationWarning cannot help here: it covers text and attributes, not a node that exists
 * on one side and not the other. The key has to be deterministic instead. The visible LABEL stays
 * local, which is what she should read, and carries the suppression.
 *
 * Cost: a message sent late at night groups under the next UTC day. That is a few hours of edge, and
 * the alternative is re-rendering the whole thread on every load.
 */
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}
function dayLabel(iso: string, locale: string, todayLabel: string, yesterdayLabel: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return todayLabel;
  if (d.toDateString() === yesterday.toDateString()) return yesterdayLabel;
  return d.toLocaleDateString(locale === 'es' ? 'es-US' : 'en-US', {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  });
}
function timeLabel(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale === 'es' ? 'es-US' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Shared chat thread, used by the subscriber /messages and the coach /coach/inbox. Live via a
// Supabase Realtime INSERT subscription on this client's thread; sends echo back over the same
// channel, so we never optimistically duplicate. Unique channel topic per mount avoids reusing an
// already-subscribed channel on remount.
export type ThreadPR = {
  exerciseId: string;
  name: string;
  weight: number;
  reps: number;
  bodyweight: boolean;
  achievedAt: string;
};

export function MessageThread({
  clientId,
  viewerId,
  initialMessages,
  prs = [],
}: {
  clientId: string;
  viewerId: string;
  initialMessages: ThreadMessage[];
  /**
   * Recent personal records, rendered INTO the timeline by date. The handoff embeds this card in
   * the coach thread and the obvious build is a `messages` row, which would be wrong twice: the
   * coach console reads that table, so every PR would land in Stephanie's inbox as something to
   * read, and a row in a conversation is a thing somebody said. These are read from set_logs and
   * drawn here, so the card is a fact about her training rather than a message nobody sent.
   */
  prs?: ThreadPR[];
}): ReactElement {
  const t = useTranslations('app.messages');
  const locale = useLocale();
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel(`messages:${clientId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` },
        (payload) => {
          const m = payload.new as { id: string; sender_id: string; body: string; created_at: string };
          setMessages((prev) =>
            prev.some((x) => x.id === m.id)
              ? prev
              : [...prev, { id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at }],
          );
        },
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [clientId]);

  function send(): void {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    start(async () => {
      const res = await sendMessageAction(clientId, body);
      if (!res.ok) setDraft(body);
    });
  }

  // One timeline, ordered by time. A PR that landed on Tuesday belongs under Tuesday's divider,
  // not pinned above or below the conversation.
  type Item =
    | { kind: 'msg'; at: string; msg: ThreadMessage }
    | { kind: 'pr'; at: string; pr: ThreadPR };
  const items: Item[] = [
    ...messages.map((m): Item => ({ kind: 'msg', at: m.createdAt, msg: m })),
    ...prs.map((p): Item => ({ kind: 'pr', at: p.achievedAt, pr: p })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {items.length === 0 ? (
          <p className="pt-8 text-center text-[13px] text-faint">{t('noMessages')}</p>
        ) : (
          items.map((item, i) => {
            const newDay = i === 0 || dayKey(item.at) !== dayKey(items[i - 1].at);
            const dayDivider = newDay ? (
              <div className="flex items-center gap-3 py-2">
                <div className="h-px flex-1 bg-divider" />
                <span
                  suppressHydrationWarning
                  className="text-[11px] font-medium uppercase tracking-[1px] text-faint"
                >
                  {dayLabel(item.at, locale, t('today'), t('yesterday'))}
                </span>
                <div className="h-px flex-1 bg-divider" />
              </div>
            ) : null;

            if (item.kind === 'pr') {
              const p = item.pr;
              return (
                <div key={`pr-${p.exerciseId}-${p.achievedAt}`}>
                  {dayDivider}
                  {/* The handoff's `.workout-context` card with its PR badge. Deliberately NOT a
                      chat bubble: it is not something either of them said. */}
                  <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3">
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-warm text-faint">
                      <Icon name="dumbbell" size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[13px]">{p.name}</strong>
                      <small className="block text-faint">
                        {p.bodyweight ? t('prReps', { reps: p.reps }) : t('prSet', { weight: p.weight, reps: p.reps })}
                      </small>
                    </span>
                    <span className="flex-none rounded-full bg-accent px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.5px] text-accent-ink">
                      {t('prBadge')}
                    </span>
                  </div>
                </div>
              );
            }

            const m = item.msg;
            const mine = m.senderId === viewerId;
            return (
              <div key={m.id}>
                {dayDivider}
                <div className={mine ? 'flex flex-col items-end' : 'flex flex-col items-start'}>
                  <div
                    className={[
                      'max-w-[75%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug',
                      mine ? 'bg-ink text-bg' : 'bg-surface text-ink',
                    ].join(' ')}
                  >
                    {m.body}
                  </div>
                  <span suppressHydrationWarning className="mt-0.5 px-1 text-[10px] text-faint">
                    {timeLabel(m.createdAt, locale)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <div className="flex items-center gap-2 border-t border-line p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder={t('messagePlaceholder')}
          aria-label={t('messagePlaceholder')}
          className="flex-1 rounded-full border border-line bg-bg px-4 py-2.5 text-[14px] outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={send}
          disabled={pending || !draft.trim()}
          className="tf-press rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-bg disabled:opacity-40"
        >
          {t('send')}
        </button>
      </div>
    </div>
  );
}
