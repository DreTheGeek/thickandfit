'use client';
// Run-now button for an eval suite. Calls the operator server action, shows a live status, and lets
// the page revalidate so the new run appears on the timeline. Heavy (real AI calls) - disabled while
// running so it can't double-fire.
import { useState, useTransition, type ReactElement } from 'react';
import { runEvalAction } from '@/lib/admin/eval-actions';

export function EvalRunner({ suite, label }: { suite: 'smart-scan' | 'chat-safety'; label: string }): ReactElement {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(): void {
    setMsg('Running (real AI calls, may take up to a minute)...');
    start(async () => {
      const r = await runEvalAction({ suite });
      if (!r.ok) {
        setMsg(`Failed: ${r.error ?? r.status ?? 'unknown'}${r.status === 'noCases' ? ' - no golden cases seeded' : ''}${r.status === 'notConfigured' ? ' - OPENROUTER_API_KEY not set' : ''}`);
        return;
      }
      setMsg(`Done: ${r.passed}/${r.cases} passed (${Math.round((r.score ?? 0) * 100)}%).`);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="tf-press rounded-lg bg-ink px-3 py-1.5 text-[12px] font-semibold text-surface disabled:opacity-50"
      >
        {pending ? 'Running...' : `Run ${label}`}
      </button>
      {msg && <p className="text-[11px] text-soft">{msg}</p>}
    </div>
  );
}
