'use server';

// Save a section of the Coach Interview: upsert the answers (coach-only, company-scoped), then re-sync
// that section into coach_knowledge so the AI immediately grounds in her updated method. Fillable by
// any coach role - Stephanie or her assistant Dani.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { getInterviewAnswers, syncSectionToKnowledge } from '@/lib/coach/interview';
import { sectionByKey } from '@/lib/coach/interview-bank';

const Input = z.object({
  sectionKey: z.string().trim().min(1).max(40),
  answers: z.record(z.string().max(80), z.string().max(4000)),
});

// Two things happen on save and they fail independently, so the result says which. `answersSaved`
// tells her whether her typing survived: the answers row is the durable record and the knowledge
// document is derived from it, so a training failure never means she has to retype anything.
export type SaveInterviewResult =
  | { ok: true; chunks: number; embedded: number }
  | { ok: false; error: string; answersSaved: boolean };

export async function saveInterviewSectionAction(input: unknown): Promise<SaveInterviewResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid', answersSaved: false };
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company', answersSaved: false };
  const companyId = ctx.companyId;

  const section = sectionByKey(parsed.data.sectionKey);
  if (!section) return { ok: false, error: 'bad_section', answersSaved: false };

  // Only accept keys that belong to this section (never trust arbitrary keys).
  const valid = new Set(section.questions.map((q) => q.key));
  const rows = Object.entries(parsed.data.answers)
    .filter(([k]) => valid.has(k))
    .map(([question_key, answer]) => ({
      company_id: companyId,
      section: section.key,
      question_key,
      answer: answer ?? null,
      answered_by: ctx.userId,
    }));

  const sb = createServiceClient();
  if (rows.length > 0) {
    const { error } = await sb.from('coach_interview_answers').upsert(rows, { onConflict: 'company_id,question_key' });
    if (error) {
      console.error('saveInterviewSectionAction:', error.message);
      return { ok: false, error: 'save_failed', answersSaved: false };
    }
  }

  // Re-sync the whole section into the knowledge base using ALL its current answers. A failure here
  // is REPORTED, not swallowed: this used to return { ok: true } unconditionally, so a section that
  // failed to train showed "Saved, your coach learned this" over a knowledge base that had just lost
  // that section.
  const all = await getInterviewAnswers(companyId);
  const res = await syncSectionToKnowledge(companyId, ctx.userId, section.key, all);
  revalidatePath('/coach/settings/knowledge/interview');
  revalidatePath('/coach/settings/knowledge');
  if (!res.ok) return { ok: false, error: res.error, answersSaved: true };
  return { ok: true, chunks: res.chunks, embedded: res.embedded };
}
