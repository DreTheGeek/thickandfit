import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { allQuestions } from '@/lib/coach/interview-bank';

/**
 * What her assistant knows, what it has been doing, and what is still waiting on her.
 *
 * WHY THIS PAGE EXISTS. All of this was already being recorded: 977 traces, 451 knowledge pieces,
 * a cron log going back months. It lived under /admin, which she does not use, so from her side the
 * system was a black box that either answered well or did not, with no way to tell why.
 *
 * WHAT IT IS NOT. This is not a model monitor and it does not describe itself as one. Everything
 * here is phrased as HER method: what it has learned from her, what it did with it, what it still
 * needs from her. The brand rule is that the product never refers to itself as artificial, and the
 * honest framing agrees with the brand one, because the interesting fact is not that a model ran.
 * It is that 365 of her own movement cues are searchable and 78 questions are still unanswered.
 */

export type MethodActivity = { feature: string; runs: number; failures: number; lastAt: string | null };

export type MethodStatus = {
  /** Everything indexed and retrievable, by source. */
  knowledgePieces: number;
  knowledgeSources: number;
  /** Indexed but with no vector: stored and permanently unfindable. Should be zero. */
  notSearchable: number;
  movementsWithCues: number;
  protocolRules: number;
  memberRecords: number;
  /** Interview progress: the single biggest thing still waiting on her. */
  interviewAnswered: number;
  interviewTotal: number;
  /** Last 30 days of real work, newest first. */
  activity: MethodActivity[];
  /** Failures worth her attention, not every transient blip. */
  recentFailures: number;
};

export async function getMethodStatus(companyId: string): Promise<MethodStatus> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [kn, unsearchable, cues, rules, memories, answers, traces] = await Promise.all([
    sb.from('coach_knowledge').select('title').eq('company_id', companyId).limit(5000),
    sb
      .from('coach_knowledge')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .is('embedding', null),
    sb
      .from('exercises')
      .select('id', { count: 'exact', head: true })
      .eq('is_coach_authored', true)
      .not('cues_en', 'is', null),
    sb.from('protocol_rules').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    sb.from('member_memory').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    sb.from('coach_interview_answers').select('question_key').eq('company_id', companyId).limit(500),
    sb.from('ai_trace').select('feature, status, ts').gte('ts', since).limit(5000),
  ]);

  const titles = new Set(((kn.data ?? []) as { title: string | null }[]).map((r) => r.title ?? '').filter(Boolean));

  // One row per capability, with its failure count beside it rather than in a separate list. A
  // failure is only meaningful next to how often the thing ran.
  const byFeature = new Map<string, MethodActivity>();
  for (const row of (traces.data ?? []) as { feature: string | null; status: string | null; ts: string }[]) {
    const key = row.feature ?? 'other';
    const cur = byFeature.get(key) ?? { feature: key, runs: 0, failures: 0, lastAt: null };
    cur.runs += 1;
    // notConfigured is a missing key, not a fault: it means the capability was never switched on,
    // and counting it as a failure would show red for something nobody asked to run.
    if (row.status !== 'ok' && row.status !== 'notConfigured') cur.failures += 1;
    if (!cur.lastAt || row.ts > cur.lastAt) cur.lastAt = row.ts;
    byFeature.set(key, cur);
  }
  const activity = [...byFeature.values()].sort((a, b) => b.runs - a.runs);

  const totalQuestions = allQuestions().length;

  return {
    knowledgePieces: (kn.data ?? []).length,
    knowledgeSources: titles.size,
    notSearchable: unsearchable.count ?? 0,
    movementsWithCues: cues.count ?? 0,
    protocolRules: rules.count ?? 0,
    memberRecords: memories.count ?? 0,
    interviewAnswered: (answers.data ?? []).length,
    interviewTotal: totalQuestions,
    activity,
    recentFailures: activity.reduce((n, a) => n + a.failures, 0),
  };
}
