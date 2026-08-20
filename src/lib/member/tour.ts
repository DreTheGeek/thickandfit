import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { resolveMemberTier, includesNutrition, type MemberTier } from '@/lib/billing/member-tier';

/**
 * What this app can do for her, said once, in the order she needs it.
 *
 * THE COMPLAINT THIS ANSWERS, verbatim: "the app never told me about the features either. I don't
 * know what to use or how. As a new person, this sucks." That is a fair description. She lands on
 * Today, sees six nav tabs and a wall of numbers, and nothing anywhere says what any of it is for.
 *
 * NOT A CAROUSEL. A five-slide intro is skipped, and if it is not skipped it is forgotten by the
 * time she needs any of it. This is a checklist of real first actions, each linking to the screen
 * that does the thing, each ticking when she has actually done it. Doing them IS the tour.
 *
 * TIER-AWARE, on the same rule as the welcome message. A training-only member is never told to log
 * her food: nobody is reading it for her, and promising otherwise is the thing the tier boundary
 * exists to prevent.
 *
 * It disappears for good once every step is done, so the app stops explaining itself to somebody
 * who has demonstrably learned it.
 */

export type MemberStep = {
  key: 'workout' | 'food' | 'weight' | 'photos' | 'coach' | 'community';
  href: string;
  done: boolean;
};

export type MemberTour = {
  steps: MemberStep[];
  doneCount: number;
  total: number;
  complete: boolean;
  tier: MemberTier;
};

export async function getMemberTour(companyId: string, profileId: string): Promise<MemberTour> {
  const svc = createServiceClient();
  const tier = await resolveMemberTier(companyId, profileId);
  const nutrition = includesNutrition(tier);

  const has = async (table: string): Promise<boolean> => {
    const { count, error } = await svc
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId);
    // Fail to NOT-done. A step that cannot be read should keep pointing somewhere useful rather
    // than quietly tick itself.
    return !error && (count ?? 0) > 0;
  };

  const [trained, ate, weighed, photographed, messaged, posted] = await Promise.all([
    has('workout_logs'),
    has('food_log'),
    has('weight_entries'),
    has('progress_photos'),
    // A message SHE sent, not the welcome she received. Reading a greeting is not using the thread.
    svc
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', profileId)
      .eq('sender_id', profileId)
      .then((r) => !r.error && (r.count ?? 0) > 0),
    svc
      .from('community_posts')
      .select('id', { count: 'exact', head: true })
      .eq('author_profile_id', profileId)
      .then((r) => !r.error && (r.count ?? 0) > 0),
  ]);

  const steps: MemberStep[] = [
    // First, because it is what she joined for and it is already waiting for her.
    { key: 'workout', href: '/workouts', done: trained },
    // Only where somebody is actually reading it.
    ...(nutrition ? [{ key: 'food' as const, href: '/nutrition', done: ate }] : []),
    { key: 'weight', href: '/you', done: weighed },
    { key: 'photos', href: '/progress?tab=gallery', done: photographed },
    { key: 'coach', href: '/inbox', done: messaged },
    { key: 'community', href: '/community', done: posted },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, total: steps.length, complete: doneCount === steps.length, tier };
}
