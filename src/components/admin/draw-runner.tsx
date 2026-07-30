'use client';
// Draw controls. Running a draw produces a publicly-announced winner, so the confirm is typed
// ("DRAW") rather than a single click - the same bar the broadcast composer will use. Verify and
// void are lighter: verify is read-only, void asks for a reason.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { runDrawAction, voidDrawAction, verifyDrawAction } from '@/lib/admin/waitlist-draw-actions';
// From draw-types (client-safe), never from waitlist-draw (server-only: node:crypto + service client).
import { DRAW_LABELS, type DrawKind, type VerifyResult } from '@/lib/admin/draw-types';

const KINDS: DrawKind[] = ['early_bird', 'main', 'founding_final', 'bonus'];

export function DrawRunner({ eligibleNow }: { eligibleNow: number }): ReactElement {
  const router = useRouter();
  const [kind, setKind] = useState<DrawKind>('early_bird');
  const [confirmedOnly, setConfirmedOnly] = useState(true);
  const [convertedOnly, setConvertedOnly] = useState(false);
  const [excludeTest, setExcludeTest] = useState(true);
  const [typed, setTyped] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  // founding_final is by definition converted-only; keep the two controls consistent so an operator
  // cannot accidentally run a "founding" draw over the whole list.
  const onKindChange = (k: DrawKind): void => {
    setKind(k);
    if (k === 'founding_final') setConvertedOnly(true);
  };

  const run = (): void => {
    setMsg(null);
    start(async () => {
      const res = await runDrawAction({ kind, confirmedOnly, convertedOnly, excludeTestAddresses: excludeTest });
      setTyped('');
      if (res.ok) {
        setMsg({
          ok: true,
          text: `Winner: ${res.winnerName ?? res.winnerEmail ?? 'unknown'} (${res.winnerEmail ?? 'no email'}) from ${res.entrantCount} entrants / ${res.totalEntries} entries.`,
        });
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  };

  const armed = typed.trim().toUpperCase() === 'DRAW';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted">Which drawing</span>
          <select
            value={kind}
            onChange={(e) => onKindChange(e.target.value as DrawKind)}
            className="rounded-xl border border-line bg-surface px-4 py-2.5 text-[14px] text-ink outline-none focus:border-ink"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>{DRAW_LABELS[k]}</option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2 pt-1">
          <span className="text-[12px] font-medium text-muted">Eligibility</span>
          <Toggle label="Confirmed email only" checked={confirmedOnly} onChange={setConfirmedOnly} />
          <Toggle
            label="Founding members only (converted)"
            checked={convertedOnly}
            onChange={setConvertedOnly}
            disabled={kind === 'founding_final'}
          />
          <Toggle label="Exclude staff + test addresses" checked={excludeTest} onChange={setExcludeTest} />
        </div>
      </div>

      <p className="text-[12px] text-faint">
        {eligibleNow} lead{eligibleNow === 1 ? '' : 's'} match the default filters right now. The pool is frozen
        and hashed at draw time, so the result stays recomputable from its own record.
      </p>

      {msg && (
        <p
          className={`rounded-md border px-4 py-3 text-[13px] ${
            msg.ok ? 'border-line bg-surface text-ink' : 'border-alert-ink/40 bg-alert-bg text-alert-ink'
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted">Type DRAW to confirm</span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="DRAW"
            autoComplete="off"
            className="w-40 rounded-xl border border-line bg-surface px-4 py-2.5 text-[14px] uppercase tracking-[1px] text-ink outline-none focus:border-ink"
          />
        </label>
        <button
          type="button"
          onClick={run}
          disabled={pending || !armed}
          className="tf-press rounded-xl bg-ink px-5 py-2.5 text-[14px] font-semibold text-surface disabled:opacity-40"
        >
          {pending ? 'Drawing...' : 'Run drawing'}
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}): ReactElement {
  return (
    <label className={`flex items-center gap-2 text-[13px] ${disabled ? 'text-faint' : 'text-ink'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}

export function DrawRowActions({
  drawId,
  isVoided,
}: {
  drawId: string;
  isVoided: boolean;
}): ReactElement {
  const router = useRouter();
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();

  const doVerify = (): void => {
    setVerify(null);
    start(async () => setVerify(await verifyDrawAction(drawId)));
  };

  const doVoid = (): void => {
    start(async () => {
      const res = await voidDrawAction({ drawId, reason: reason.trim() });
      setVoiding(false);
      setReason('');
      if (res.ok) router.refresh();
      else setVerify({ ok: false, reason: res.error ?? 'Could not void.' });
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={doVerify}
          disabled={pending}
          className="tf-press text-[12px] font-semibold text-ink hover:underline disabled:opacity-50"
        >
          {pending ? 'Working...' : 'Verify'}
        </button>
        {!isVoided && !voiding && (
          <button
            type="button"
            onClick={() => setVoiding(true)}
            disabled={pending}
            className="tf-press text-[12px] font-semibold text-alert-ink hover:underline disabled:opacity-50"
          >
            Void
          </button>
        )}
      </div>

      {voiding && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required)"
            className="w-48 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] text-ink outline-none focus:border-ink"
          />
          <button
            type="button"
            onClick={doVoid}
            disabled={pending || reason.trim().length < 3}
            className="tf-press text-[12px] font-semibold text-alert-ink hover:underline disabled:opacity-40"
          >
            Confirm void
          </button>
          <button
            type="button"
            onClick={() => { setVoiding(false); setReason(''); }}
            className="tf-press text-[12px] text-faint hover:underline"
          >
            Cancel
          </button>
        </div>
      )}

      {verify && (
        <p
          className={`max-w-sm text-right text-[11px] leading-snug ${
            verify.ok && verify.matches && verify.poolHashMatches ? 'text-[#1F7A46]' : 'text-alert-ink'
          }`}
        >
          {verify.ok
            ? verify.matches && verify.poolHashMatches
              ? 'Verified: pool hash intact and the seed reproduces the recorded winner.'
              : `MISMATCH - winner recompute ${verify.matches ? 'ok' : 'FAILED'}, pool hash ${verify.poolHashMatches ? 'ok' : 'FAILED'}.`
            : verify.reason}
        </p>
      )}
    </div>
  );
}
