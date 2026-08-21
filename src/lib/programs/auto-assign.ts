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
// IT IS NOW A MATCHER, and the note that used to sit here explaining why it was not is worth
// keeping in summary: an ID was chosen over a matcher because "whoever writes it has to be able to
// SEE the 40 programs", and a name-pattern algorithm written against a library nobody had checked
// would have been a guess. That reservation was right and it has been discharged. The library was
// read, and Stephanie names her seven 12-week blocks on exactly three axes - days, level, home or
// gym - which migration 0148 turned into columns so the matcher reads her taxonomy rather than a
// regex over titles. lib/programs/match-starter-shared.ts holds the rules and the reasoning.
//
// The owner's report is what forced it: "so we dont even ask a question of how many days they want
// to work out or anything. that shoud dictate what plan they get." Onboarding now asks, and the
// answer is read.
//
// STARTER_PROGRAM_ID SURVIVES AS AN OVERRIDE. Set it and every member gets that exact plan, which
// is the escape hatch for a launch week or a plan she wants everybody on. Unset, the matcher runs.
// Both are off by default in the sense that matters: with no starter candidates marked, nothing is
// assigned and the member lands in /coach/awaiting for a human, which is the promise the app makes
// anyway.
import { createServiceClient } from '@/lib/supabase/service';
import { matchStarterPlan } from '@/lib/programs/match-starter';
import { loadHealthProfile } from '@/lib/health-profile/data';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AutoAssignResult =
  | { status: 'off' }
  | { status: 'assigned'; planId: string; reason: string; compromised: boolean }
  | { status: 'no_match' }
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
  const svc = createServiceClient();

  // Already has something? Leave it, and check it BEFORE doing any matching work. Checked rather
  // than relying on the unique index, because that index is on (plan_id, profile_id): it would
  // happily add a SECOND program alongside the coach's.
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

  const override = (process.env.STARTER_PROGRAM_ID ?? '').trim();
  let planId: string;
  let reason: string;
  let compromised = false;

  if (override) {
    if (!UUID.test(override)) {
      // Loud, because a typo here means every new member silently gets nothing and the failure looks
      // exactly like the feature being switched off.
      console.error('autoAssignStarterProgram: STARTER_PROGRAM_ID is not a uuid, ignoring');
      return { status: 'bad_config', reason: 'not_a_uuid' };
    }
    planId = override;
    reason = 'STARTER_PROGRAM_ID override is set, so her answers were not used.';
  } else {
    // Her answers, read back from the profile rather than taken from the request that wrote them.
    const hp = await loadHealthProfile(profileId, companyId);
    const match = await matchStarterPlan(companyId, {
      location: hp.trainingLocation ?? null,
      experience: hp.trainingExperience ?? null,
      daysPerWeek: hp.trainingDays ?? null,
    });
    // Nothing marked as a starter candidate, or nothing she can actually do. A wrong program is
    // worse than no program: she lands in /coach/awaiting and a human writes it, which is what the
    // app promised her in the first place.
    if (!match) return { status: 'no_match' };
    planId = match.plan.id;
    reason = match.reason;
    compromised = match.compromised;
  }

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
  return { status: 'assigned', planId, reason, compromised };
}
