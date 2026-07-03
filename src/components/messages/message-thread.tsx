'use client';

import { useEffect, useRef, useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { sendMessageAction } from '@/lib/messages/message-actions';
import type { ThreadMessage } from '@/lib/messages/messages';

// Shared chat thread, used by the subscriber /messages and the coach /coach/inbox. Live via a
// Supabase Realtime INSERT subscription on this client's thread; sends echo back over the same
// channel, so we never optimistically duplicate. Unique channel topic per mount avoids reusing an
// already-subscribed channel on remount.
export function MessageThread({
  clientId,
  viewerId,
  initialMessages,
}: {
  clientId: string;
  viewerId: string;
  initialMessages: ThreadMessage[];
}): ReactElement {
  const t = useTranslations('app.messages');
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="pt-8 text-center text-[13px] text-faint">{t('noMessages')}</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === viewerId;
            return (
              <div key={m.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={[
                    'max-w-[75%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug',
                    mine ? 'bg-ink text-bg' : 'bg-surface text-ink',
                  ].join(' ')}
                >
                  {m.body}
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
