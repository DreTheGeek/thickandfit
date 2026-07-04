// Evals: "does quality hold on every change." Each suite (smart-scan accuracy, chat safety +
// groundedness) runs the REAL production pipeline against a labeled golden set and scores it; every
// run rolls into eval_run so this timeline shows the trend as models/prompts change. Run-now buttons
// trigger a suite on demand (the manual gate before shipping an AI change).
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { getEvals, type EvalRunRow } from '@/lib/admin/portal';
import { AdminPage, Card, Stat } from '@/components/admin/ui';
import { EvalRunner } from '@/components/admin/eval-runner';

export const dynamic = 'force-dynamic';

const SUITE_LABEL: Record<string, string> = {
  'smart-scan': 'Smart scan accuracy',
  'chat-safety': 'Chat safety & grounding',
  'plan-safety': 'Plan safety',
  insights: 'Insights',
};

function pct(score: number | null): string {
  return score == null ? '-' : `${Math.round(score * 100)}%`;
}
function tone(score: number | null): 'good' | 'warn' | 'bad' | undefined {
  if (score == null) return undefined;
  return score >= 0.9 ? 'good' : score >= 0.7 ? 'warn' : 'bad';
}

function HistoryRow({ r }: { r: EvalRunRow }): ReactElement {
  const model = (r.metrics.model as string) ?? (r.metrics.judge as string) ?? '';
  return (
    <div className="flex items-center gap-3 border-b border-line py-2 text-[12px] last:border-0">
      <span className="w-40 shrink-0 font-semibold text-ink">{SUITE_LABEL[r.suite] ?? r.suite}</span>
      <span className={`tabular-nums font-semibold ${tone(r.score) === 'bad' ? 'text-[#b4372e]' : tone(r.score) === 'good' ? 'text-[#2f8f4e]' : 'text-ink'}`}>{pct(r.score)}</span>
      <span className="text-soft">{r.passed}/{r.cases} passed</span>
      {model && <span className="hidden max-w-48 truncate text-faint sm:inline">{model}</span>}
      <span className="ml-auto tabular-nums text-faint">{new Date(r.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
    </div>
  );
}

export default async function EvalsPage(): Promise<ReactElement> {
  await requireOperator();
  const e = await getEvals(50);
  const scan = e.suites.find((s) => s.suite === 'smart-scan');
  const chat = e.suites.find((s) => s.suite === 'chat-safety');

  return (
    <AdminPage title="Evals" subtitle="Every AI change graded against a golden set before it ships. Real pipeline, real scoring, tracked over time.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card title="Smart scan accuracy" action={<EvalRunner suite="smart-scan" label="scan eval" />}>
          <Stat label="Latest pass rate" value={pct(scan?.latest?.score ?? null)} sub={scan?.latest ? `${scan.latest.passed}/${scan.latest.cases} cases · F1 ${(scan.latest.metrics.avgF1 as number) ?? '-'}` : 'never run'} tone={tone(scan?.latest?.score ?? null)} />
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            Runs the real analyzeSmartPhoto pipeline (model chain + portion step) against labeled food photos and scores food match + portion error.
            This is the moat metric: portion accuracy.
          </p>
        </Card>
        <Card title="Chat safety & grounding" action={<EvalRunner suite="chat-safety" label="chat eval" />}>
          <Stat label="Latest pass rate" value={pct(chat?.latest?.score ?? null)} sub={chat?.latest ? `${chat.latest.passed}/${chat.latest.cases} cases` : 'never run'} tone={tone(chat?.latest?.score ?? null)} />
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            Runs the real coach model + production safety clause against adversarial prompts (medical questions, restricted foods, under-eating),
            graded by a flagship LLM judge on grounding, safety, and restriction-respect.
          </p>
        </Card>
      </div>

      <Card title="Run history">
        {e.history.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-faint">
            No eval runs yet. Hit a &quot;Run&quot; button above (or POST to /api/internal/run-scan-eval / run-chat-eval from CI) to grade the current build.
          </p>
        ) : (
          e.history.map((r) => <HistoryRow key={r.id} r={r} />)
        )}
      </Card>

      <Card title="How this works">
        <ul className="list-inside list-disc space-y-1 text-[13px] leading-relaxed text-soft">
          <li><strong>Golden sets</strong> live in ai_evals / ai_eval_cases (labeled inputs + expected behavior).</li>
          <li>Each run executes the <strong>real production pipeline</strong> - no mocks - so a regression here is a regression members would hit.</li>
          <li><strong>LLM-as-judge</strong> grades the open-ended chat answers; scan uses deterministic food-match + portion-error scoring.</li>
          <li>Every run writes a summary to <strong>eval_run</strong> (this timeline) plus per-case detail to ai_eval_runs.</li>
          <li>Wire the two endpoints into CI to gate an AI change on a passing eval before it ships.</li>
        </ul>
      </Card>
    </AdminPage>
  );
}
