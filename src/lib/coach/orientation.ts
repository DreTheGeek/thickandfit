import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * What a coach opening this console for the first time needs to know.
 *
 * THE PROBLEM THIS SOLVES. /coach opens on six KPI tiles: MRR, active members, total clients,
 * lifetime revenue, open leads, at risk. For Stephanie, who knows her own numbers, that is the right
 * screen. For a coach on her first morning it is a wall of somebody else's figures with no
 * indication of what she is supposed to DO, and the nav offers forty destinations with no priority
 * between them. There was no tour, no intro, and no first-run state of any kind.
 *
 * DRIVEN BY STATE, NOT BY A TOUR. A product tour is a slideshow that ages badly and gets skipped.
 * This is the member-side FirstSteps pattern turned around: name the few things that are actually
 * true of this console right now, link to each, and disappear as they get done. A coach who has
 * already assigned a program does not need to be told where programs live.
 *
 * The counts come from the same tables the rest of the console reads, so the card cannot claim work
 * the screen beside it disagrees about.
 */

export type OrientationStep = {
  key: 'clients' | 'awaiting' | 'programs' | 'knowledge';
  href: string;
  /** Done means she has genuinely done the thing, not that she dismissed a tooltip about it. */
  done: boolean;
  /** A live number where one is meaningful, so a step says how much is waiting rather than that it is. */
  count: number;
};

export type CoachOrientation = {
  steps: OrientationStep[];
  doneCount: number;
  /** Nothing left worth saying, so the console stops explaining itself. */
  complete: boolean;
};

export async function getCoachOrientation(companyId: string): Promise<CoachOrientation> {
  const svc = createServiceClient();

  // Fail to zero everywhere. A first-run card that throws would take down the console it exists to
  // explain, which is the worst possible trade.
  const [clients, awaiting, programs, knowledge, assignments] = await Promise.all([
    svc.from('contacts').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('type', 'client'),
    svc
      .from('onboarding_responses')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .not('completed_at', 'is', null),
    svc.from('plans').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
    svc.from('coach_knowledge').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    svc.from('plan_assignments').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
  ]);

  const n = (r: { count: number | null; error: unknown }): number => (r.error ? 0 : (r.count ?? 0));

  const steps: OrientationStep[] = [
    // Where the people are. The most useful single fact on day one.
    { key: 'clients', href: '/coach/clients', done: n(clients) > 0, count: n(clients) },
    // Who is waiting on a program. This is the queue that keeps the promise made at checkout, so it
    // is the first real WORK anybody does in here. Done once ANY program has been assigned.
    { key: 'awaiting', href: '/coach/awaiting', done: n(assignments) > 0, count: n(awaiting) },
    // Her library. A coach cannot assign what she has never looked at.
    { key: 'programs', href: '/coach/programs', done: n(programs) > 0, count: n(programs) },
    // What the assistant knows, in her voice. Ships empty and is easy never to find.
    { key: 'knowledge', href: '/coach/settings/knowledge', done: n(knowledge) > 0, count: n(knowledge) },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, complete: doneCount === steps.length };
}
