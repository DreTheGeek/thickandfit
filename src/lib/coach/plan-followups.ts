import 'server-only';
// Plans that are about to run out, so the coach hears about it before the member does.
//
// WHAT THIS CLOSES. On 2026-08-13 Stephanie asked for it directly: "she needs the ability of putting
// a reminder, hey it's about to be the 12 week mark, let's make sure we update Shaleesa's program...
// that way we give ourselves a week in advance notice to handle those." The answer on the call was
// "reminders and notifications are our jam, I believe that's built."
//
// It was not. Every generator in src/lib/notifications/generators.ts fires at a MEMBER. Nothing in
// this app had ever addressed a notification to the coach, and nothing computed when a plan ends.
// The failure mode is the one she described from Lenus: a 12-week program quietly expires, nobody
// notices, and a paying client trains week 13 of a plan that finished.
//
// THE DATA WAS ALREADY HERE, which is why this file is small. plans.weeks is real per plan — the
// Lenus importer derives it from her own plan names rather than defaulting (17 of her 40 are 6-week,
// 9 are 8-week, 14 are 12-week; scripts/import-lenus-programs.mjs). plan_assignments.assigned_at is
// the start. Expiry is arithmetic, not a new column.
//
// THE WINDOW IS HERS, not a constant. coach_settings.training_followup and meal_plan_followup have
// existed since migration 0115 with a control on /coach/settings, and settings-actions.ts says out
// loud that "Follow-ups are CONFIGURED here and nothing in the app schedules one yet". Her "a week
// in advance" is `one_week`. 'none' means she wants no reminder and is honoured as a real answer:
// quietly substituting a default would put messages on her console she never asked for.
import { createServiceClient } from '@/lib/supabase/service';
import { readCoachSettings } from '@/lib/coach/settings';
import { followUpDays } from '@/lib/coach/settings-shared';
import { planEndsOn, daysUntil, isInFollowUpWindow } from '@/lib/coach/plan-followups-shared';

export type ExpiringPlanItem = {
  kind: 'training' | 'meal';
  /** Stable per row, and the dedupe key for the coach's notification. */
  id: string;
  contactId: string | null;
  profileId: string | null;
  memberName: string;
  planName: string;
  /** ISO day the plan runs out. In the past means it already has. */
  endsOn: string;
  /** Negative once it has expired, which is the number that should raise a pulse. */
  daysLeft: number;
};

export type ExpiringPlans = {
  items: ExpiringPlanItem[];
  /** Null when the coach has follow-ups switched off, so the page can say so instead of "all clear". */
  trainingWindowDays: number | null;
  mealWindowDays: number | null;
};

const DAY = 86_400_000;

type AssignmentRow = {
  id: string;
  profile_id: string;
  assigned_at: string;
  plans: { name_en: string; weeks: number } | { name_en: string; weeks: number }[] | null;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

/**
 * Plans inside the coach's follow-up window, soonest to expire first.
 *
 * INCLUDES ALREADY-EXPIRED ONES, deliberately. A queue that drops a plan the moment it lapses is a
 * queue that hides exactly the cases that went wrong, and the woman training week 13 of a finished
 * 12-week program is the reason this exists.
 */
export async function listExpiringPlans(
  companyId: string,
  at: Date = new Date(),
): Promise<ExpiringPlans> {
  const settings = await readCoachSettings(companyId);
  const trainingWindowDays = followUpDays(settings.trainingFollowup);
  const mealWindowDays = followUpDays(settings.mealPlanFollowup);
  const empty: ExpiringPlans = { items: [], trainingWindowDays, mealWindowDays };
  if (trainingWindowDays === null && mealWindowDays === null) return empty;

  const svc = createServiceClient();
  const items: ExpiringPlanItem[] = [];

  if (trainingWindowDays !== null) {
    const { data, error } = await svc
      .from('plan_assignments')
      .select('id, profile_id, assigned_at, plans!inner ( name_en, weeks ), profiles ( full_name )')
      .eq('company_id', companyId)
      .limit(5000);
    if (error) {
      console.error('listExpiringPlans training:', error.message);
    } else {
      for (const raw of (data ?? []) as unknown as AssignmentRow[]) {
        const plan = one(raw.plans);
        if (!plan) continue;
        // Null when the duration is corrupt; planEndsOn refuses to guess a date rather than putting
        // a wrong one on a queue the coach acts on.
        const endsOn = planEndsOn(raw.assigned_at, Number(plan.weeks));
        if (!endsOn) continue;
        const daysLeft = daysUntil(endsOn, at);
        if (!isInFollowUpWindow(daysLeft, trainingWindowDays)) continue;
        items.push({
          kind: 'training',
          id: raw.id,
          contactId: null,
          profileId: raw.profile_id,
          memberName: (one(raw.profiles)?.full_name ?? '').trim() || 'Member',
          planName: plan.name_en,
          endsOn,
          daysLeft,
        });
      }
    }
  }

  if (mealWindowDays !== null) {
    // Meal plans have no duration of their own: nothing in meal_plans says how long one lasts. The
    // follow-up is measured from when it was SENT, which is what meal_plan_sent_at records and what
    // the Lenus setting always meant ("nudge me N after the plan goes out"), rather than an expiry
    // this app cannot compute.
    const { data, error } = await svc
      .from('client_subscriptions')
      .select('id, contact_id, meal_plan_sent_at, contacts ( first_name, last_name, profile_id )')
      .eq('company_id', companyId)
      .not('meal_plan_sent_at', 'is', null)
      .limit(5000);
    if (error) {
      console.error('listExpiringPlans meal:', error.message);
    } else {
      type MealRow = {
        id: string;
        contact_id: string;
        meal_plan_sent_at: string;
        contacts:
          | { first_name: string | null; last_name: string | null; profile_id: string | null }
          | { first_name: string | null; last_name: string | null; profile_id: string | null }[]
          | null;
      };
      for (const raw of (data ?? []) as unknown as MealRow[]) {
        const dueOn = new Date(Date.parse(raw.meal_plan_sent_at) + mealWindowDays * DAY)
          .toISOString()
          .slice(0, 10);
        const daysLeft = daysUntil(dueOn, at);
        // The meal window is already baked into dueOn, so this asks only "has it come due yet".
        if (daysLeft > 0) continue;
        const c = one(raw.contacts);
        const name = `${c?.first_name ?? ''} ${c?.last_name ?? ''}`.trim();
        items.push({
          kind: 'meal',
          id: raw.id,
          contactId: raw.contact_id,
          profileId: c?.profile_id ?? null,
          memberName: name || 'Member',
          planName: 'Meal plan',
          endsOn: dueOn,
          daysLeft,
        });
      }
    }
  }

  // Soonest first, and the already-expired ones sort to the top because their daysLeft is negative.
  items.sort((a, b) => a.daysLeft - b.daysLeft);
  return { items, trainingWindowDays, mealWindowDays };
}

/** For the attention chip. Counts the same set the page shows, so the two cannot disagree. */
export async function countExpiringPlans(companyId: string): Promise<number> {
  return (await listExpiringPlans(companyId)).items.length;
}
