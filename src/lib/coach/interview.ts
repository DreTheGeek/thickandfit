// Coach Interview server layer: read the saved answers, and (re)compose a section's answered Q&A into a
// coach_knowledge document so the AI coach + meal-plan generator ground in Stephanie's real method. This
// is the "translate" step - her answers become the retrievable knowledge the app already runs on.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { ingestKnowledge } from '@/lib/coach-ai/knowledge';
import { aiConfigured } from '@/lib/ai/client';
import { answerToText, isAnswered, sectionByKey } from '@/lib/coach/interview-bank';

export async function getInterviewAnswers(companyId: string): Promise<Record<string, string>> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('coach_interview_answers')
    .select('question_key, answer')
    .eq('company_id', companyId);
  const map: Record<string, string> = {};
  for (const r of (data ?? []) as { question_key: string; answer: string | null }[]) {
    if (r.answer != null) map[r.question_key] = r.answer;
  }
  return map;
}

// Compose one section's answered questions into a knowledge doc + (re)ingest it. Stable title per
// section, so a re-save replaces that section's document and the knowledge base stays in sync as she
// edits her answers.
//
// ORDER MATTERS, and it used to be wrong. This deleted the section's existing document BEFORE
// re-ingesting, so any failure downstream (a database error on the insert, an embeddings outage)
// destroyed the section she had already trained and left nothing in its place. It is now
// insert-then-delete with a rollback: the previous document is only removed once a REPLACEMENT is on
// disk and retrievable. Worst case is a duplicate document for a moment, never an empty one.
export type SyncSectionResult =
  | { ok: true; chunks: number; embedded: number; cleared: boolean }
  | { ok: false; error: string };

export async function syncSectionToKnowledge(
  companyId: string,
  userId: string,
  sectionKey: string,
  answers: Record<string, string>,
): Promise<SyncSectionResult> {
  const section = sectionByKey(sectionKey);
  if (!section) return { ok: false, error: 'bad_section' };
  const title = `Coach interview: ${section.label}`;

  const lines: string[] = [`Stephanie's coaching method - ${section.label}.`, section.description, ''];
  for (const q of section.questions) {
    const raw = answers[q.key];
    if (!isAnswered(raw)) continue;
    lines.push(`Q: ${q.prompt}`);
    lines.push(`Stephanie: ${answerToText(q, raw)}`);
    lines.push('');
  }
  const text = lines.join('\n').trim();

  const sb = createServiceClient();

  // Nothing meaningful answered (or she cleared the section): remove the stale document. This is the
  // one deletion that is intended, because leaving it would keep teaching the coach answers she has
  // just erased.
  if (text.length < 60) {
    const { error } = await sb
      .from('coach_knowledge')
      .delete()
      .eq('company_id', companyId)
      .eq('title', title);
    if (error) {
      console.error('syncSectionToKnowledge clear:', error.message);
      return { ok: false, error: 'clear_failed' };
    }
    return { ok: true, chunks: 0, embedded: 0, cleared: true };
  }

  // 1. Write the replacement first. Her existing document is still intact at this point.
  const res = await ingestKnowledge(companyId, userId, title, text);
  if (!res.ok) return { ok: false, error: res.error };

  // 2. A document with zero embeddings is invisible to match_coach_knowledge, so swapping a
  //    retrievable document for an unretrievable one is destruction with extra steps. When the key
  //    IS configured, zero embeddings means the embeddings endpoint failed: roll the new rows back
  //    and keep what she had. When the key is absent, null embeddings are the expected state for
  //    both documents, so the replace is honest and proceeds.
  if (aiConfigured() && res.embedded === 0) {
    const { error } = await sb
      .from('coach_knowledge')
      .delete()
      .eq('company_id', companyId)
      .eq('source_id', res.sourceId);
    if (error) console.error('syncSectionToKnowledge rollback:', error.message);
    return { ok: false, error: 'embed_failed' };
  }

  // 3. Only now retire the previous document(s) for this section.
  const { error: delErr } = await sb
    .from('coach_knowledge')
    .delete()
    .eq('company_id', companyId)
    .eq('title', title)
    .neq('source_id', res.sourceId);
  // A failure here leaves a stale duplicate, which degrades retrieval but loses nothing. The save
  // still succeeded, so it is logged rather than reported as a failed save.
  if (delErr) console.error('syncSectionToKnowledge retire-old:', delErr.message);

  return { ok: true, chunks: res.chunks, embedded: res.embedded, cleared: false };
}
