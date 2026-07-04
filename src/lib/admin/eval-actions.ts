'use server';
// Operator eval triggers. Runs a suite on demand from the admin Evals page (the "run on every change"
// button). Heavy: real AI calls. Operator-gated; results roll into eval_run for the timeline.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireOperator } from '@/lib/auth/guards';
import { runSmartScanEval } from '@/lib/ai/eval/run-scan-eval';
import { runChatEval } from '@/lib/ai/eval/run-chat-eval';

export type RunEvalResult = { ok: boolean; suite: string; cases?: number; passed?: number; score?: number; status?: string; error?: string };

const Input = z.object({ suite: z.enum(['smart-scan', 'chat-safety']) });

export async function runEvalAction(input: unknown): Promise<RunEvalResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, suite: 'unknown', error: 'invalid suite' };
  await requireOperator();
  const suite = parsed.data.suite;

  if (suite === 'chat-safety') {
    const r = await runChatEval();
    revalidatePath('/admin/evals');
    if (r.status !== 'ok') return { ok: false, suite, status: r.status, error: r.status };
    return { ok: true, suite, cases: r.cases, passed: r.passed, score: r.score };
  }

  const r = await runSmartScanEval();
  revalidatePath('/admin/evals');
  if (r.status !== 'ok') return { ok: false, suite, status: r.status, error: r.status };
  return { ok: true, suite, cases: r.current.cases, passed: r.current.passed, score: r.current.cases ? r.current.passed / r.current.cases : 0 };
}
