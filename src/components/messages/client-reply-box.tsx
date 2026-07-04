'use client';
// Compact reply composer for the coach client-detail Messages tab. Sends via the same unified action
// (in-app for claimed clients, email for unclaimed) and reports how it was delivered.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { sendClientMessageAction } from '@/lib/messages/coach-message-actions';

export function ClientReplyBox({ contactId, name, hasAccount }: { contactId: string; name: string; hasAccount: boolean }): ReactElement {
  const t = useTranslations('app.coach');
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = (): void => {
    const body = draft.trim();
    if (!body || pending) return;
    setNote(null);
    start(async () => {
      const res = await sendClientMessageAction({ contactId, body });
      if (!res.ok) {
        setNote(res.error === 'rate_limited' ? t('msgSlowDown') : t('msgSendFailed'));
        return;
      }
      setDraft('');
      setNote(res.channel === 'email' ? t('msgEmailedTo', { name }) : res.channel === 'recorded' ? t('msgSavedForJoin') : t('msgSent'));
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      {!hasAccount && <p className="mb-2 text-[11px] text-faint">{t('msgEmailNote', { name })}</p>}
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder={t('msgPlaceholder', { name })}
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2.5 text-[14px] outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={send}
          disabled={pending || !draft.trim()}
          className="tf-press rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-surface disabled:opacity-40"
        >
          {pending ? t('msgSending') : t('msgSend')}
        </button>
      </div>
      {note && <p className="mt-1.5 text-[12px] text-muted">{note}</p>}
    </div>
  );
}
