'use client';
// Per-row disable/enable toggle for the Team roster. Reversible counterpart to TeamRemoveButton:
// the account is preserved but the teammate can no longer sign in and their live session is
// revoked. Real guards (self, last-operator, staff-only) live server-side in setTeammateDisabledAction.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { setTeammateDisabledAction } from '@/lib/admin/access-actions';

const ERRORS: Record<string, string> = {
  self: "You can't disable your own account.",
  last_operator: 'This is the last operator. Add another operator before disabling this one.',
  not_staff: 'That account is not a staff member.',
  not_found: 'Account not found in this workspace.',
  invalid: 'Invalid request.',
  no_company: 'No company scope on your account.',
  failed: 'Could not update them. Try again.',
};

export function TeamDisableButton({
  id,
  disabled,
  isSelf,
}: {
  id: string;
  disabled: boolean;
  isSelf: boolean;
}): ReactElement | null {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // The Actions cell already renders "You" via the remove control when isSelf is true; hide this one.
  if (isSelf) return null;

  const toggle = (): void => {
    setErr(null);
    start(async () => {
      const res = await setTeammateDisabledAction({ id, disabled: !disabled });
      if (res.ok) router.refresh();
      else setErr(ERRORS[res.error ?? ''] ?? 'Something went wrong.');
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

  const label = disabled ? 'Enable' : 'Disable';
  const busyLabel = disabled ? 'Enabling...' : 'Disabling...';
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="tf-press text-[12px] font-semibold text-muted hover:text-ink hover:underline disabled:opacity-50"
      aria-pressed={disabled}
    >
      {pending ? busyLabel : label}
    </button>
  );
}
