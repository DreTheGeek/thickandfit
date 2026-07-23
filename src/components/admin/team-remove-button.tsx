'use client';
// Per-row remove control for the Team roster. Two-step (Remove -> Yes/No) so an operator cannot delete
// a teammate with one stray click. The account is deleted server-side by removeTeammateAction, which
// enforces the real guards (self, last-operator, staff-only); this is only the confirm + refresh.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { removeTeammateAction } from '@/lib/admin/access-actions';

const ERRORS: Record<string, string> = {
  self: "You can't remove your own account.",
  last_operator: 'This is the last operator. Add another operator before removing this one.',
  not_staff: 'That account is not a staff member.',
  not_found: 'Account not found in this workspace.',
  invalid: 'Invalid request.',
  no_company: 'No company scope on your account.',
  failed: 'Could not remove them. Try again.',
};

export function TeamRemoveButton({
  id,
  name,
  isSelf,
}: {
  id: string;
  name: string;
  isSelf: boolean;
}): ReactElement {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (isSelf) {
    return <span className="text-[12px] text-faint">You</span>;
  }

  const remove = (): void => {
    setErr(null);
    start(async () => {
      const res = await removeTeammateAction(id);
      if (res.ok) {
        router.refresh();
      } else {
        setErr(ERRORS[res.error ?? ''] ?? 'Something went wrong.');
        setConfirming(false);
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

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="tf-press text-[12px] font-semibold text-alert-ink hover:underline"
      >
        Remove
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-[12px] text-muted">Remove {name}?</span>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="tf-press text-[12px] font-semibold text-alert-ink hover:underline disabled:opacity-50"
      >
        {pending ? 'Removing...' : 'Yes, remove'}
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
