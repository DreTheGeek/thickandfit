'use client';
// Per-row moderation controls. Three verbs, two of them destructive-adjacent, so both ask twice.
// Dismiss is single-click because it changes nothing a member can see.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import {
  dismissReportAction,
  deletePostAction,
  muteMemberAction,
} from '@/lib/admin/community-mod-actions';

const MUTE_DAYS = 7;

const ERRORS: Record<string, string> = {
  invalid: 'Invalid request.',
  blocked: 'Blocked (rate limit or missing company scope).',
  not_found: 'That item is no longer in your queue.',
  failed: 'Could not apply the change. Try again.',
};

type Pending = 'delete' | 'mute' | null;

export function ReportActions({
  reportId,
  postId,
  reportedProfileId,
  authorName,
}: {
  reportId: string;
  postId: string;
  reportedProfileId: string | null;
  authorName: string;
}): ReactElement {
  const router = useRouter();
  const [confirming, setConfirming] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>): void => {
    setError(null);
    start(async () => {
      const res = await fn();
      setConfirming(null);
      if (res.ok) router.refresh();
      else setError(ERRORS[res.error ?? ''] ?? 'Something went wrong.');
    });
  };

  if (error) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-[12px] text-alert-ink">{error}</span>
        <button type="button" onClick={() => setError(null)} className="tf-press text-[12px] text-faint hover:underline">
          Dismiss
        </button>
      </span>
    );
  }

  if (confirming === 'delete') {
    return (
      <ConfirmRow
        label="Delete this post?"
        confirmLabel="Yes, delete"
        pending={pending}
        onConfirm={() => run(() => deletePostAction(postId))}
        onCancel={() => setConfirming(null)}
      />
    );
  }

  if (confirming === 'mute') {
    return (
      <ConfirmRow
        label={`Mute ${authorName} for ${MUTE_DAYS} days?`}
        confirmLabel="Yes, mute"
        pending={pending}
        onConfirm={() =>
          run(() =>
            reportedProfileId
              ? muteMemberAction({ profileId: reportedProfileId, days: MUTE_DAYS })
              : Promise.resolve({ ok: false, error: 'not_found' }),
          )
        }
        onCancel={() => setConfirming(null)}
      />
    );
  }

  return (
    <span className="flex flex-wrap items-center justify-end gap-3">
      <button
        type="button"
        onClick={() => setConfirming('delete')}
        disabled={pending}
        className="tf-press text-[12px] font-semibold text-alert-ink hover:underline disabled:opacity-50"
      >
        Delete post
      </button>
      {reportedProfileId && (
        <button
          type="button"
          onClick={() => setConfirming('mute')}
          disabled={pending}
          className="tf-press text-[12px] font-semibold text-ink hover:underline disabled:opacity-50"
        >
          Mute {MUTE_DAYS}d
        </button>
      )}
      <button
        type="button"
        onClick={() => run(() => dismissReportAction(reportId))}
        disabled={pending}
        className="tf-press text-[12px] text-faint hover:underline disabled:opacity-50"
      >
        {pending ? 'Working...' : 'Dismiss'}
      </button>
    </span>
  );
}

function ConfirmRow({
  label,
  confirmLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  label: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}): ReactElement {
  return (
    <span className="flex flex-wrap items-center justify-end gap-2 whitespace-nowrap">
      <span className="text-[12px] text-muted">{label}</span>
      <button
        type="button"
        onClick={onConfirm}
        disabled={pending}
        className="tf-press text-[12px] font-semibold text-alert-ink hover:underline disabled:opacity-50"
      >
        {pending ? 'Working...' : confirmLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="tf-press text-[12px] text-faint hover:underline disabled:opacity-50"
      >
        Cancel
      </button>
    </span>
  );
}
