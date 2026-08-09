'use server';

// Coach Knowledge Base actions: ingest a pasted document (chunk -> embed -> store) and delete a
// source. Mirrors the canonical server-action shape (challenge-actions.ts): Zod + requireCoach +
// write + revalidatePath. requireCoach authorizes the company before any write; the libs use the
// service client. Graceful: ingest stores chunks with embedding null when unkeyed (never throws).
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import {
  ingestKnowledge,
  deleteKnowledgeSource,
  reembedMissing,
  type ReembedResult,
} from '@/lib/coach-ai/knowledge';

export type KnowledgeActionResult =
  | { ok: true; chunks: number; embedded: number }
  | { ok: false; error: string };

const IngestInput = z.object({
  title: z.string().trim().min(2).max(120),
  text: z.string().trim().min(20).max(100_000),
});

export async function ingestKnowledgeAction(input: unknown): Promise<KnowledgeActionResult> {
  const parsed = IngestInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const result = await ingestKnowledge(ctx.companyId, ctx.userId, parsed.data.title, parsed.data.text);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/coach/settings/knowledge');
  return { ok: true, chunks: result.chunks, embedded: result.embedded };
}

// Repair path for chunks stored without a vector. Those rows are invisible to retrieval and look
// identical to good ones in the list, so without this the only fix is re-pasting every document.
export type ReembedActionResult = ({ ok: true } & ReembedResult) | { ok: false; error: string };

export async function reembedKnowledgeAction(): Promise<ReembedActionResult> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const res = await reembedMissing(ctx.companyId);
  revalidatePath('/coach/settings/knowledge');
  return { ok: true, ...res };
}

const DeleteInput = z.object({ sourceId: z.string().uuid() });

export async function deleteKnowledgeAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = DeleteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const ok = await deleteKnowledgeSource(ctx.companyId, parsed.data.sourceId);
  if (!ok) return { ok: false, error: 'failed' };

  revalidatePath('/coach/settings/knowledge');
  return { ok: true };
}
