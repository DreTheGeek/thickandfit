'use client';

// Subscriber AI coach chat UI. Message list + composer + streaming render.
// POSTs to /api/coach-ai/chat and reads the streamed text reply progressively. History is
// hydrated from coach_messages by the page. Degrades gracefully when the coach is not configured.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from 'react';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icons';

type ChatRole = 'user' | 'assistant';

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type InitialMessage = { id: string; role: ChatRole; content: string; createdAt: string };

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function CoachChat({
  initialMessages,
  configured,
}: {
  initialMessages: InitialMessage[];
  configured: boolean;
}): ReactElement {
  const t = useTranslations('app.coachChat');
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages.map((m) => ({ id: m.id, role: m.role, content: m.content })),
  );
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [notConfigured, setNotConfigured] = useState(!configured);

  const listEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToEnd = useCallback((): void => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages, scrollToEnd]);

  async function send(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = { id: uid(), role: 'user', content: trimmed };
    const assistantId = uid();
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/coach-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });

      const contentType = res.headers.get('content-type') ?? '';

      // Not-configured (or any JSON) response: show the message in the assistant bubble.
      if (contentType.includes('application/json')) {
        const json = (await res.json()) as { status?: string; message?: string; error?: string };
        if (json.status === 'notConfigured') setNotConfigured(true);
        const fallback = json.message ?? json.error ?? t('error');
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: fallback } : m)),
        );
        return;
      }

      if (!res.ok || !res.body) {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: t('error') } : m)),
        );
        return;
      }

      // Stream the assistant reply, appending text deltas as they arrive.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      let streaming = true;
      while (streaming) {
        const { done, value } = await reader.read();
        if (done) {
          streaming = false;
          break;
        }
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)),
        );
      }
      if (!acc.trim()) {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: t('error') } : m)),
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: t('error') } : m)),
      );
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    void send(input);
  }

  const showEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex flex-none items-center gap-3 border-b border-line px-5 py-4">
        <Avatar size={38} tone="warm" />
        <div className="min-w-0">
          <h1 className="tf-display text-[19px] leading-none">{t('title')}</h1>
          <p className="mt-1 text-[11px] text-faint">
            {notConfigured ? t('statusOffline') : t('statusOnline')}
          </p>
        </div>
      </header>

      {/* Messages */}
      <div className="tf-scroll flex-1 space-y-3 px-4 py-5">
        {notConfigured && (
          <div className="mx-auto max-w-[80%] rounded-2xl bg-surface px-4 py-3 text-center text-[13px] text-muted shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            {t('notConfigured')}
          </div>
        )}

        {showEmpty && !notConfigured && (
          <div className="flex flex-col items-center gap-2 px-6 pt-10 text-center">
            <Icon name="sparkles" size={28} className="text-accent" />
            <p className="text-[15px] font-semibold text-ink">{t('emptyTitle')}</p>
            <p className="max-w-[260px] text-[13px] text-faint">{t('emptyBody')}</p>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} thinkingLabel={t('thinking')} />
        ))}
        <div ref={listEndRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        className="flex flex-none items-end gap-2 border-t border-line bg-surface px-3.5 py-3"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          rows={1}
          maxLength={2000}
          disabled={sending}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="tf-scroll max-h-28 min-h-[42px] flex-1 resize-none rounded-2xl border border-line bg-bg px-4 py-2.5 text-[15px] outline-none focus:border-ink disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={sending || input.trim() === ''}
          aria-label={t('send')}
          className="tf-press flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-ink text-bg disabled:opacity-40"
        >
          <Icon name="send" size={18} />
        </button>
      </form>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  thinkingLabel,
}: {
  role: ChatRole;
  content: string;
  thinkingLabel: string;
}): ReactElement {
  const isUser = role === 'user';
  return (
    <div className={['flex', isUser ? 'justify-end' : 'justify-start'].join(' ')}>
      <div
        className={[
          'max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed',
          isUser
            ? 'bg-ink text-bg'
            : 'bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]',
        ].join(' ')}
      >
        {content || (
          <span className="inline-flex items-center gap-1 text-faint">
            <span className="animate-pulse">{thinkingLabel}</span>
          </span>
        )}
      </div>
    </div>
  );
}
