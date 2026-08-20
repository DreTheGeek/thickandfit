import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * The guided tour of the coach console: what a new coach needs to see, in the order they need it.
 *
 * TWO KINDS OF STEP, and the difference is the whole design.
 *   visit  - she opened the screen. Enough for "here is where the exercise library lives".
 *   action - she DID the thing. Assigning a program is not learned by looking at the page, and a
 *            checklist that ticks for looking teaches nothing.
 *
 * Visit steps complete themselves: CoachTourTracker maps the current path to a key and records it
 * once. Action steps are checked against real rows, so they cannot be faked by navigating.
 *
 * PER COACH, NOT PER COMPANY. This tenant arrived with 279 clients, 41 programs and 451 knowledge
 * entries already migrated, so a company-level checklist opens fully ticked and teaches nobody.
 * Progress belongs to the person learning.
 *
 * Grouped, because fourteen flat checkboxes is a wall. The groups match how the work actually
 * divides: your people, programming, talking to them, the assistant, setup.
 */

export type TourGroup = 'people' | 'programming' | 'comms' | 'assistant' | 'setup';

export type TourStepDef = {
  key: string;
  group: TourGroup;
  href: string;
  /** A visit step completes on arrival; an action step needs a real row to exist. */
  kind: 'visit' | 'action';
};

/**
 * The catalog. Order within a group is the order a coach should meet them.
 *
 * `href` doubles as the tracker's match: the tracker marks a visit step when the path starts with
 * its href, so a step and its detail pages count as the same screen.
 */
export const TOUR_STEPS: readonly TourStepDef[] = [
  // Your people, first, because everything else is in service of them.
  { key: 'clients', group: 'people', href: '/coach/clients', kind: 'visit' },
  { key: 'awaiting', group: 'people', href: '/coach/awaiting', kind: 'visit' },
  { key: 'quiet', group: 'people', href: '/coach/quiet', kind: 'visit' },

  // Programming. The library is a visit; assigning is the first real work anybody does here.
  { key: 'programs', group: 'programming', href: '/coach/programs', kind: 'visit' },
  { key: 'assign', group: 'programming', href: '/coach/awaiting', kind: 'action' },
  { key: 'exercises', group: 'programming', href: '/coach/exercises', kind: 'visit' },
  { key: 'mealPlans', group: 'programming', href: '/coach/tool/meal-plans', kind: 'visit' },

  // Talking to them.
  { key: 'inbox', group: 'comms', href: '/coach/inbox', kind: 'visit' },
  { key: 'reply', group: 'comms', href: '/coach/inbox', kind: 'action' },
  { key: 'forms', group: 'comms', href: '/coach/forms', kind: 'visit' },
  { key: 'community', group: 'comms', href: '/coach/community', kind: 'visit' },

  // The assistant, which is the part of this product nobody discovers by accident.
  { key: 'knowledge', group: 'assistant', href: '/coach/settings/knowledge', kind: 'visit' },
  { key: 'method', group: 'assistant', href: '/coach/method', kind: 'visit' },

  // Setup.
  { key: 'coaching', group: 'setup', href: '/coach/settings/coaching', kind: 'visit' },
] as const;

export type TourStep = TourStepDef & { done: boolean };

export type CoachTour = {
  steps: TourStep[];
  doneCount: number;
  total: number;
  complete: boolean;
};

/** The path a tracker should record, or null when this screen is not a tour step. */
export function stepForPath(pathname: string): string | null {
  // Longest href first, so /coach/settings/knowledge is not swallowed by a shorter /coach/settings.
  const ordered = [...TOUR_STEPS].filter((s) => s.kind === 'visit').sort((a, b) => b.href.length - a.href.length);
  const hit = ordered.find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));
  return hit?.key ?? null;
}

export async function getCoachTour(companyId: string, profileId: string): Promise<CoachTour> {
  const svc = createServiceClient();

  const [visited, assignments, coachReplies] = await Promise.all([
    svc.from('coach_checklist').select('step_key').eq('profile_id', profileId),
    // Action: has anyone been given a program by THIS coach. created_by is the column that records
    // it, so a coach cannot inherit the tick from Stephanie's own work.
    svc
      .from('plan_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('created_by', profileId),
    // Action: has this coach actually answered somebody.
    svc
      .from('client_messages')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_from_coach', true),
  ]);

  const seen = new Set(
    ((visited.data ?? []) as { step_key: string }[]).map((r) => r.step_key),
  );
  const didAssign = !assignments.error && (assignments.count ?? 0) > 0;
  const didReply = !coachReplies.error && (coachReplies.count ?? 0) > 0;

  const steps: TourStep[] = TOUR_STEPS.map((s) => ({
    ...s,
    done:
      s.kind === 'visit'
        ? seen.has(s.key)
        : s.key === 'assign'
          ? didAssign
          : s.key === 'reply'
            ? didReply
            : false,
  }));

  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, total: steps.length, complete: doneCount === steps.length };
}
