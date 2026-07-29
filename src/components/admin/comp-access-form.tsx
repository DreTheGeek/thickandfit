'use client';
// Comp-access controls: single grant by email, bulk-comp the legacy cohort, and per-row revoke.
// Bulk and revoke both ask twice because they move real entitlement.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import {
  grantCompAccessAction,
  revokeCompAccessAction,
  bulkCompLegacyAction,
} from '@/lib/admin/comp-access-actions';

const ERRORS: Record<string, string> = {
  invalid: 'Enter a valid email and a day count between 1 and 3650.',
  no_company: 'No company scope on your account.',
  not_found: 'No member in this company has that email.',
  rate_limited: 'Too many grants right now. Wait a bit and try again.',
  failed: 'Could not apply the change. Try again.',
};

export function CompAccessForm(): ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [days, setDays] = useState('180');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [pending, start] = useTransition();

  const grant = (): void => {
    if (pending || !email.trim()) return;
    setMsg(null);
    start(async () => {
      const res = await grantCompAccessAction({ email: email.trim(), days: Number(days) || 180 });
      if (res.ok) {
        setMsg({ ok: true, text: `Comped ${email.trim()} for ${days} days.` });
        setEmail('');
        router.refresh();
      } else {
        setMsg({ ok: false, text: ERRORS[res.error ?? ''] ?? 'Something went wrong.' });
      }
    });
  };

  const bulk = (): void => {
    setMsg(null);
    start(async () => {
      const res = await bulkCompLegacyAction(Number(days) || 180);
      setConfirmBulk(false);
      if (res.ok) {
        setMsg({
          ok: true,
          text:
            res.granted === 0
              ? 'No legacy clients needed comping - everyone already has native billing or access.'
              : `Comped ${res.granted} legacy client${res.granted === 1 ? '' : 's'} for ${days} days.`,
        });
        router.refresh();
      } else {
        setMsg({ ok: false, text: ERRORS[res.error ?? ''] ?? 'Something went wrong.' });
      }
    });
  };

  const inputCls =
    'w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-[14px] text-ink outline-none focus:border-ink';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted">Member email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="member@example.com"
            autoComplete="off"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted">Days</span>
          <input
            type="number"
            min={1}
            max={3650}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      {msg && (
        <p className={`text-[13px] font-medium ${msg.ok ? 'text-[#1F7A46]' : 'text-alert-ink'}`}>{msg.text}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={grant}
          disabled={pending || !email.trim()}
          className="tf-press rounded-xl bg-ink px-5 py-2.5 text-[14px] font-semibold text-surface disabled:opacity-40"
        >
          {pending ? 'Working...' : 'Grant access'}
        </button>

        {confirmBulk ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-muted">Comp every legacy client for {days} days?</span>
            <button
              type="button"
              onClick={bulk}
              disabled={pending}
              className="tf-press text-[13px] font-semibold text-ink hover:underline disabled:opacity-50"
            >
              {pending ? 'Working...' : 'Yes, comp them'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmBulk(false)}
              disabled={pending}
              className="tf-press text-[13px] text-faint hover:underline disabled:opacity-50"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmBulk(true)}
            disabled={pending}
            className="tf-press rounded-xl border border-line px-5 py-2.5 text-[14px] font-semibold text-ink disabled:opacity-40"
          >
            Bulk-comp legacy clients
          </button>
        )}
      </div>
    </div>
  );
}

export function RevokeCompButton({ profileId, email }: { profileId: string; email: string }): ReactElement {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const revoke = (): void => {
    start(async () => {
      await revokeCompAccessAction(profileId);
      setConfirming(false);
      router.refresh();
    });
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="tf-press text-[12px] font-semibold text-alert-ink hover:underline"
      >
        Revoke
      </button>
    );
  }

  return (
    <span className="flex items-center justify-end gap-2 whitespace-nowrap">
      <span className="text-[12px] text-muted">Revoke {email}?</span>
      <button
        type="button"
        onClick={revoke}
        disabled={pending}
        className="tf-press text-[12px] font-semibold text-alert-ink hover:underline disabled:opacity-50"
      >
        {pending ? 'Working...' : 'Yes'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="tf-press text-[12px] text-faint hover:underline disabled:opacity-50"
      >
        Cancel
      </button>
    </span>
  );
}
