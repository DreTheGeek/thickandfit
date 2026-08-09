'use client';

// The Spanish gate, made visible.
//
// The protocol is Stephanie's copy in her voice, so a translation is a DRAFT until she signs it off.
// This banner is what makes that state impossible to miss on the screen where she reviews it, and the
// button is the only way the state changes. `canApprove` is false for an assistant coach: the server
// action enforces the same rule with requireApprover, and this just stops the button appearing to
// someone who cannot use it.
import { useState, useTransition, type ReactElement } from 'react';
import { COACH_COPY } from '@/lib/protocols/copy';
import { setProtocolSpanishStatusAction } from '@/lib/protocols/actions';
import type { ProtocolEsStatus } from '@/lib/protocols/types';

const TONE: Record<ProtocolEsStatus, string> = {
  // Pending amber for the draft: it is an unfinished piece of work, not a fault.
  draft: 'bg-pending text-pending-ink',
  missing: 'bg-alert text-alert-ink',
  // Approved is a functional success signal, which is the only thing green is allowed to be here.
  approved: 'bg-accent text-white',
};

export function SpanishStatus({
  protocolId,
  esStatus,
  canApprove,
}: {
  protocolId: string;
  esStatus: ProtocolEsStatus;
  canApprove: boolean;
}): ReactElement {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const title =
    esStatus === 'approved'
      ? COACH_COPY.esApprovedTitle
      : esStatus === 'draft'
        ? COACH_COPY.esDraftTitle
        : COACH_COPY.esMissingTitle;
  const body =
    esStatus === 'approved'
      ? COACH_COPY.esApprovedBody
      : esStatus === 'draft'
        ? COACH_COPY.esDraftBody
        : COACH_COPY.esMissingBody;

  function move(next: ProtocolEsStatus): void {
    setError(null);
    start(async () => {
      const res = await setProtocolSpanishStatusAction({ protocolId, esStatus: next });
      if (!res.ok) setError(COACH_COPY.assignErrorFailed);
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={[
              'inline-flex items-center rounded-full px-3 py-[5px] text-[11px] font-semibold uppercase leading-none tracking-[1px]',
              TONE[esStatus],
            ].join(' ')}
          >
            {title}
          </span>
          <p className="mt-2.5 max-w-[62ch] text-[13px] leading-relaxed text-muted">{body}</p>
        </div>
        {canApprove && esStatus !== 'missing' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => move(esStatus === 'approved' ? 'draft' : 'approved')}
            className="tf-press shrink-0 rounded-full border border-ink px-4 py-2 text-[12px] font-semibold text-ink disabled:opacity-50"
          >
            {esStatus === 'approved' ? COACH_COPY.esUnapproveCta : COACH_COPY.esApproveCta}
          </button>
        )}
      </div>
      {error != null && <p className="mt-3 text-[12px] text-alert-ink">{error}</p>}
    </section>
  );
}
