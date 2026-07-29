'use client';
// The Aug-4 protection harness UI. Two buttons, one result panel.
//
// Run seeds a throwaway lead through the REAL submitSignup path, then asserts the suppression
// contract step by step (signup does not auto-confirm, confirm flips confirmed_at, conversion
// flips converted_at). Cleanup deletes every qa-*@test.local row. Both are operator-gated server
// actions; this component only renders state.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { runSuppressionQaAction, cleanupSuppressionQaAction } from '@/lib/admin/suppression-qa-actions';
import type { QaResult, CleanupResult } from '@/lib/admin/suppression-qa';

export function SuppressionQaRunner(): ReactElement {
  const router = useRouter();
  const [result, setResult] = useState<QaResult | null>(null);
  const [cleanup, setCleanup] = useState<CleanupResult | null>(null);
  const [pending, start] = useTransition();

  const run = (): void => {
    setCleanup(null);
    start(async () => {
      const r = await runSuppressionQaAction();
      setResult(r);
      router.refresh();
    });
  };

  const doCleanup = (): void => {
    setResult(null);
    start(async () => {
      const r = await cleanupSuppressionQaAction();
      setCleanup(r);
      router.refresh();
    });
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="tf-press rounded-xl bg-ink px-5 py-2.5 text-[14px] font-semibold text-surface disabled:opacity-40"
        >
          {pending ? 'Running...' : 'Run test signup'}
        </button>
        <button
          type="button"
          onClick={doCleanup}
          disabled={pending}
          className="tf-press rounded-xl border border-line px-5 py-2.5 text-[14px] font-semibold text-ink disabled:opacity-40"
        >
          Clean up test rows
        </button>
      </div>

      {cleanup && (
        <p className="mt-4 rounded-md border border-line bg-surface px-4 py-3 text-[13px] text-ink">
          {cleanup.error
            ? `Cleanup failed: ${cleanup.error}`
            : `Deleted ${cleanup.deleted} test row${cleanup.deleted === 1 ? '' : 's'}.`}
        </p>
      )}

      {result && (
        <div className="mt-5">
          <div
            className={[
              'mb-3 inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[1.5px]',
              result.overall === 'pass' ? 'bg-[#DFF2E4] text-[#1F7A46]' : 'bg-alert-bg text-alert-ink',
            ].join(' ')}
          >
            {result.overall === 'pass' ? 'All checks passed' : 'Check failed'}
          </div>
          {result.email && (
            <p className="mb-3 text-[12px] text-faint">
              Seeded {result.email}
              {result.leadId ? ` (${result.leadId.slice(0, 8)}...)` : ''}
            </p>
          )}
          <ol className="flex flex-col gap-1.5">
            {result.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-md border border-line bg-surface px-3 py-2">
                <span
                  aria-hidden="true"
                  className={[
                    'mt-[3px] shrink-0 text-[13px] font-bold',
                    s.ok ? 'text-[#1F7A46]' : 'text-alert-ink',
                  ].join(' ')}
                >
                  {s.ok ? '✓' : '✗'}
                </span>
                <span className="min-w-0">
                  <span className="text-[13px] font-semibold text-ink">{s.name}</span>
                  <span className="ml-2 text-[12px] text-muted">{s.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
