import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import {
  chooseStarterPlan,
  type MemberTrainingAnswers,
  type StarterCandidate,
  type StarterMatch,
} from '@/lib/programs/match-starter-shared';

export type { MemberTrainingAnswers, StarterCandidate, StarterMatch } from '@/lib/programs/match-starter-shared';
export { chooseStarterPlan } from '@/lib/programs/match-starter-shared';

/** The starter pool: what she has marked as safe to hand a stranger. */
export async function starterCandidates(companyId: string): Promise<StarterCandidate[]> {
  const { data, error } = await createServiceClient()
    .from('plans')
    .select('id, name_en, days_per_week, level, location')
    .eq('company_id', companyId)
    .eq('is_starter_candidate', true)
    .is('archived_at', null);
  if (error) {
    console.error('starterCandidates:', error.message);
    return [];
  }
  return (data ?? []) as StarterCandidate[];
}

/** The whole job: read her answers, read the pool, pick one. Null means a human should write it. */
export async function matchStarterPlan(
  companyId: string,
  answers: MemberTrainingAnswers,
): Promise<StarterMatch | null> {
  const pool = await starterCandidates(companyId);
  if (pool.length === 0) return null;
  return chooseStarterPlan(pool, answers);
}
