'use client';
// Per-row "Resend invite" for a teammate who never accepted. Exists because the Supabase recovery
// link expires in ONE HOUR: an invite that sat in a spam folder overnight is dead, and re-inviting
// through the form meant retyping their name and role. Confirms inline so a stray click does not
// fire an email.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { resendTeammateInviteAction } from '@/lib/admin/access-actions';

const ERRORS: Record<string, string> = {
  invalid: 'Invalid request.',
  no_company: 'No company scope on your account.',
  not_found: 'Account not found in this workspace.',
  rate_limited: 'Too many invites this hour. Wait a bit and try again.',
  email_failed: 'The email could not be sent. Check the Resend logs.',
};

export function TeamResendButton({ id, name }: { id: string; name: string }): ReactElement {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'confirm' | 'sent'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = (): void => {
    setErr(null);
    start(async () => {
      const res = await resendTeammateInviteAction(id);
      if (res.ok) {
        setState('sent');
        router.refresh();
      } else {
        setState('idle');
        setErr(ERRORS[res.error ?? ''] ?? 'Something went wrong.');
      }
    });
  };

  if (err) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-[12px] text-alert-ink">{err}</span>
        <button
          type="button"
          onClick={() => setErr(null)}
          className="tf-press text-[12px] text-faint hover:underline"
        >
          Dismiss
        </button>
      </span>
    );
  }

  if (state === 'sent') {
    return <span className="text-[12px] font-semibold text-ink">Link sent</span>;
  }

  if (state === 'confirm') {
    return (
      <span className="flex items-center gap-2">
        <span className="text-[12px] text-soft">Email {name} a new link?</span>
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className="tf-press text-[12px] font-semibold text-ink hover:underline disabled:opacity-50"
        >
          {pending ? 'Sending...' : 'Send'}
        </button>
        <button
          type="button"
          onClick={() => setState('idle')}
          className="tf-press text-[12px] text-faint hover:underline"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setState('confirm')}
      className="tf-press text-[12px] font-semibold text-muted hover:text-ink hover:underline"
    >
      Resend invite
    </button>
  );
}
