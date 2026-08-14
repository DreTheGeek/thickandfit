import 'server-only';
// Put a member into a training program the moment she finishes onboarding.
//
// THE PROBLEM THIS CLOSES. There is no automatic program assignment anywhere in this app: a plan
// reaches a member only when a coach opens the console. The member-facing copy is honest about it
// ("Steph writes your plan by hand, she will message you when it is ready") and /coach/awaiting
// exists to keep that promise visible, with OVERDUE_DAYS = 3 conceding it slips. On an ordinary week
// that is a considered trade. On a week when nobody opens the console, a woman who paid on Tuesday
// is still waiting on Friday, with 40 imported programs sitting in the library she cannot reach.
//
// SHIPPED OFF. Absent env var = off, the same way NEXT_PUBLIC_SCAN_AUTO_ACCEPT was built and shipped
// off with its flip criteria written down. Turning this on changes what a paying member receives and
// makes the hand-written promise a half-truth, so it is deliberately a decision someone makes on
// purpose, in Vercel, without a deploy.
//
// WHY AN ID AND NOT A MATCHER. The obvious design is to choose a program from her library using the
// onboarding answers (goal, experience, gym or home, days per week). That is the better product and
// it is not what this does, because whoever writes it has to be able to SEE the 40 programs to know
// which one a nervous beginner training at home should get. Guessing that from plan-name patterns
// would be inventing an algorithm against a library nobody checked. Naming one plan puts the choice
// with the person who knows the answer, and a matcher can replace this later without changing the
// call site.
import { createServiceClient } from '@/lib/supabase/service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AutoAssignResult =
  | { status: 'off' }
  | { status: 'assigned'; planId: string }
  | { status: 'already_has_program' }
  | { status: 'bad_config'; reason: string }
  | { status: 'error' };

/**
 * Assign the configured starter program, if one is configured and she has none.
 *
 * Never overrides a coach. A member who already holds ANY plan assignment is left alone: the coach
 * having chosen something is the whole point of the manual path, and stomping it would be worse than
 * the gap this closes.
 */
export async function autoAssignStarterProgram(
  companyId: string,
  profileId: string,
): Promise<AutoAssignResult> {
  const planId = (process.env.STARTER_PROGRAM_ID ?? '').trim();
  if (!planId) return { status: 'off' };
  if (!UUID.test(planId)) {
    // Loud, because a typo here means every new member silently gets nothing and the failure looks
    // exactly like the feature being switched off.
    console.error('autoAssignStarterProgram: STARTER_PROGRAM_ID is not a uuid, ignoring');
    return { status: 'bad_config', reason: 'not_a_uuid' };
  }

  const svc = createServiceClient();

  // The plan must exist AND belong to this company. The service client bypasses RLS, and the
  // tenant predicate on several policies is weaker than it looks (see
  // .planning/RLS-TENANT-BOUNDARY.md), so a mistyped id must not be able to hand a member another
  // company's programming.
  const { data: plan, error: planErr } = await svc
    .from('plans')
    .select('id')
    .eq('id', planId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (planErr) {
    console.error('autoAssignStarterProgram plan:', planErr.message);
    return { status: 'error' };
  }
  if (!plan) {
    console.error(`autoAssignStarterProgram: plan ${planId} not found in company ${companyId}`);
    return { status: 'bad_config', reason: 'plan_not_in_company' };
  }

  // Already has something? Leave it. Checked rather than relying on the unique index, because that
  // index is on (plan_id, profile_id): it would happily add a SECOND program alongside the coach's.
  const { data: existing, error: exErr } = await svc
    .from('plan_assignments')
    .select('id')
    .eq('company_id', companyId)
    .eq('profile_id', profileId)
    .limit(1);
  if (exErr) {
    console.error('autoAssignStarterProgram existing:', exErr.message);
    return { status: 'error' };
  }
  if ((existing ?? []).length > 0) return { status: 'already_has_program' };

  const { error } = await svc
    .from('plan_assignments')
    .upsert(
      { company_id: companyId, plan_id: planId, profile_id: profileId },
      { onConflict: 'plan_id,profile_id', ignoreDuplicates: true },
    );
  if (error) {
    console.error('autoAssignStarterProgram assign:', error.message);
    return { status: 'error' };
  }
  return { status: 'assigned', planId };
}
