'use client';
// Coach-side conversation: the merged migrated + live thread for one client, with a composer that
// sends in-app (claimed clients) or by email (unclaimed migrated clients). Optimistically appends the
// sent message and reports how it was delivered.
import { useEffect, useRef, useState, useTransition, type ReactElement } from 'react';
import { sendClientMessageAction } from '@/lib/messages/coach-message-actions';
import type { InboxMessage } from '@/lib/messages/inbox';

function fmt(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
}

export function CoachConversation({
  contactId,
  name,
  hasAccount,
  initialMessages,
}: {
  contactId: string;
  name: string;
  hasAccount: boolean;
  initialMessages: InboxMessage[];
}): ReactElement {
  const [messages, setMessages] = useState<InboxMessage[]>(initialMessages);
  // Reset-on-prop-change, React's documented pattern, instead of setState inside an effect.
  //
  // Switching to another client must discard the previous thread. Doing that in an effect meant the
  // component first PAINTED the old client's messages under the new client's name, then re-rendered
  // with the right ones: a visible flash of one member's conversation in another's thread, in a coach
  // inbox that carries 12k migrated messages. Adjusting during render swaps them before anything is
  // shown, and is what react-hooks was flagging.
  const [renderedContactId, setRenderedContactId] = useState(contactId);
  if (contactId !== renderedContactId) {
    setRenderedContactId(contactId);
    setMessages(initialMessages);
  }
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const send = (): void => {
    const body = draft.trim();
    if (!body || pending) return;
    setDraft('');
    setNote(null);
    const optimistic: InboxMessage = {
      id: 'opt_' + body.length + '_' + messages.length,
      fromCoach: true,
      senderName: 'You',
      body,
      at: new Date(0).toISOString(),
      channel: hasAccount ? 'live' : 'archive',
    };
    setMessages((prev) => [...prev, { ...optimistic, at: nowLabel() }]);
    start(async () => {
      const res = await sendClientMessageAction({ contactId, body });
      if (!res.ok) {
        setNote(res.error === 'rate_limited' ? 'Slow down a moment and try again.' : 'Could not send. Try again.');
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setDraft(body);
        return;
      }
      setNote(res.channel === 'email' ? `Emailed to ${name} (not in the app yet).` : res.channel === 'recorded' ? 'Saved. They will see it when they join.' : null);
    });
  };

  return (
    <div className="flex h-full flex-col">
      {!hasAccount && (
        <div className="border-b border-line bg-warm/50 px-4 py-2 text-[12px] text-muted">
          {name} hasn&apos;t joined the app yet. Your messages are emailed to them and saved here.
        </div>
      )}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="pt-8 text-center text-[13px] text-faint">No messages yet. Say hello.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.fromCoach ? 'flex justify-end' : 'flex justify-start'}>
              <div className={['max-w-[75%] rounded-2xl px-3.5 py-2', m.fromCoach ? 'bg-ink text-surface' : 'bg-surface text-ink'].join(' ')}>
                <div className={['mb-0.5 flex items-center gap-2 text-[10px]', m.fromCoach ? 'text-surface/70' : 'text-faint'].join(' ')}>
                  <span className="font-semibold">{m.fromCoach ? m.senderName || 'Coach' : name}</span>
                  <span>{fmt(m.at)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-[14px] leading-snug">{m.body}</p>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      {note && <p className="px-4 pb-1 text-[12px] text-muted">{note}</p>}
      <div className="flex items-center gap-2 border-t border-line p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder={`Message ${name}...`}
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2.5 text-[14px] outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={send}
          disabled={pending || !draft.trim()}
          className="tf-press rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-surface disabled:opacity-40"
        >
          {pending ? 'Sending' : 'Send'}
        </button>
      </div>
    </div>
  );
}

function nowLabel(): string {
  // Client-local timestamp for the optimistic bubble (server value replaces it on refresh).
  return new Date().toISOString();
}
