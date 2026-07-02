// Coach Interview server layer: read the saved answers, and (re)compose a section's answered Q&A into a
// coach_knowledge document so the AI coach + meal-plan generator ground in Stephanie's real method. This
// is the "translate" step - her answers become the retrievable knowledge the app already runs on.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { ingestKnowledge } from '@/lib/coach-ai/knowledge';
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
// section => delete-then-ingest keeps the knowledge base in sync as she edits her answers.
export async function syncSectionToKnowledge(
  companyId: string,
  userId: string,
  sectionKey: string,
  answers: Record<string, string>,
): Promise<{ embedded: number } | null> {
  const section = sectionByKey(sectionKey);
  if (!section) return null;
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
  await sb.from('coach_knowledge').delete().eq('company_id', companyId).eq('title', title);
  if (text.length < 60) return { embedded: 0 }; // nothing meaningful answered in this section yet
  const res = await ingestKnowledge(companyId, userId, title, text);
  return { embedded: res.embedded };
}
