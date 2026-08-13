import 'server-only';
// Give a new member the weekly check-in the moment she finishes onboarding.
//
// WHY THIS EXISTS. The dark hero on her very first Today screen carries the app's most prominent
// control: "Start Check-in". It links to /checkin, which lists the check-in forms a coach has
// ASSIGNED to her. Nothing assigned one. So the loudest button in the product, on day one, landed a
// paying member on "No check-ins assigned yet. Your coach will add one soon."
//
// first-steps.tsx already fought this battle for the rest of the screen and its header names the
// principle: "stop making waiting the activity". It fixed three places that told her to wait. This
// was the fourth, and it survived because it is the PRIMARY call to action rather than a row in a
// list, so it did not look like part of the same problem.
//
// It is also the cheapest retention win available. The category number is that a member who does
// almost nothing in her first month has roughly an 80% chance of cancelling; a check-in is the one
// action that starts her data and gives the coach something to respond to.
import { createServiceClient } from '@/lib/supabase/service';

export type AssignDefaultResult =
  | { status: 'assigned'; formId: string }
  | { status: 'already' }
  | { status: 'no_form' }
  | { status: 'error' };

/**
 * Assign the company's standing weekly check-in to one member.
 *
 * IDEMPOTENT. form_assignments is UNIQUE(form_id, profile_id) (0005), so a repeat call is a no-op
 * rather than a duplicate row. Safe to call from a retry, a backfill, or both.
 *
 * The form is LOOKED UP, not hardcoded. Migration 0129 rebuilt her real 19-question check-in at a
 * fixed uuid, and pinning that id here would work today and break the first time the form is
 * replaced or a second company exists.
 */
export async function assignDefaultCheckin(
  companyId: string,
  profileId: string,
): Promise<AssignDefaultResult> {
  const svc = createServiceClient();

  // OLDEST published check-in wins when there is more than one, and the tie-break is deliberate.
  // The established form is the one a new member should get. A newly published one is at least as
  // likely to be a one-off (a challenge check-in, a seasonal variant) as it is to be the new
  // standard, and silently switching every new member onto it would be the worse mistake of the
  // two. When it matters, the count is logged below so the ambiguity is visible rather than assumed.
  const { data: forms, error: formErr } = await svc
    .from('forms')
    .select('id, title_en, created_at')
    .eq('company_id', companyId)
    .eq('type', 'check_in')
    .eq('status', 'published')
    .order('created_at', { ascending: true });

  if (formErr) {
    console.error('assignDefaultCheckin forms:', formErr.message);
    return { status: 'error' };
  }

  const rows = (forms ?? []) as { id: string; title_en: string | null; created_at: string }[];
  if (rows.length === 0) {
    // Not an error. A company with no published check-in yet simply has nothing to assign, and the
    // member sees the same empty state she would have seen anyway.
    return { status: 'no_form' };
  }
  if (rows.length > 1) {
    console.warn(
      `assignDefaultCheckin: ${rows.length} published check-in forms for company ${companyId}; ` +
        `assigning the oldest ("${rows[0].title_en ?? rows[0].id}")`,
    );
  }

  const formId = rows[0].id;

  // ignoreDuplicates: a member who already has it keeps the assignment she has, with its original
  // assigned_at. Overwriting would move that date and make her look newly assigned in every queue
  // that sorts by it.
  const { error, count } = await svc
    .from('form_assignments')
    .upsert(
      { company_id: companyId, form_id: formId, profile_id: profileId },
      { onConflict: 'form_id,profile_id', ignoreDuplicates: true, count: 'exact' },
    );

  if (error) {
    console.error('assignDefaultCheckin assign:', error.message);
    return { status: 'error' };
  }
  return count ? { status: 'assigned', formId } : { status: 'already' };
}
