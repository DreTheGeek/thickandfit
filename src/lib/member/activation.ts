import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * What a new member has actually done, asked of the database rather than remembered.
 *
 * THE RULE, taken verbatim from the ChairLord playbook because it is the whole design:
 *
 *   "A stored 'I did that' flag for something the database could answer is a lie waiting to happen."
 *
 * So there is no `has_logged_food` column and no localStorage key here. A step is done the moment
 * the row that proves it exists, which means it cannot drift, cannot be wrong after a support fix,
 * and cannot survive a member deleting the thing it claimed she had done.
 *
 * WHAT THIS REPLACES. FirstSteps rendered the same three numbered cards to everyone: "1. Log what
 * you eat today. 2. Take your starting point. 3. Say hi in the community." Hardcoded, with no
 * completion state at all. A member who had logged forty meals and taken her starting photos still
 * opened Activities and was told to go and do both, which reads as an app that is not paying
 * attention, on the exact screen where she came looking for the program she is waiting for.
 *
 * BOTH KEYS, always. Migrated Lenus history is keyed to contacts and native activity to profiles
 * (0070/0071), and reading only profile_id would tell one of the 256 women who moved over that she
 * has never logged a meal, on top of a wall of her own history. Every query below checks both.
 */
export type ActivationStep = {
  key: 'food' | 'baseline' | 'community';
  href: string;
  done: boolean;
};

export type Activation = {
  steps: ActivationStep[];
  doneCount: number;
  /** True once every step is done, i.e. there is nothing left to show her. */
  complete: boolean;
};

/** Does at least one row exist for this member, under either key? */
async function anyRow(table: string, profileId: string, contactId: string | null): Promise<boolean> {
  const svc = createServiceClient();
  const q = svc.from(table).select('id', { count: 'exact', head: true });
  const { count } = await (contactId
    ? q.or(`profile_id.eq.${profileId},contact_id.eq.${contactId}`)
    : q.eq('profile_id', profileId));
  return (count ?? 0) > 0;
}

export async function getActivation(profileId: string): Promise<Activation> {
  const svc = createServiceClient();

  // The contact row is how migrated history is reachable. A native signup has none, and that is a
  // normal state, not an error.
  const { data: contact } = await svc
    .from('contacts')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();
  const contactId = (contact as { id: string } | null)?.id ?? null;

  const [food, weight, photos, measurements, posts, comments] = await Promise.all([
    anyRow('food_log', profileId, contactId),
    anyRow('weight_entries', profileId, contactId),
    anyRow('progress_photos', profileId, contactId),
    anyRow('body_measurements', profileId, contactId),
    // community_posts keys the author differently and has no contact_id: nothing was migrated into
    // the feed, so there is no second key to check.
    svc
      .from('community_posts')
      .select('id', { count: 'exact', head: true })
      .eq('author_profile_id', profileId)
      .then((r) => (r.count ?? 0) > 0),
    svc
      .from('post_comments')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .then((r) => (r.count ?? 0) > 0),
  ]);

  const steps: ActivationStep[] = [
    { key: 'food', href: '/nutrition', done: food },
    // "Starting point" is satisfied by ANY of the three baseline records. Insisting on all of them
    // would leave the step open for a woman who has done the part she was willing to do, and the
    // purpose of a baseline is to exist, not to be complete.
    { key: 'baseline', href: '/progress', done: weight || photos || measurements },
    // Commenting counts. Requiring a post from a woman on day two of a fitness app, in front of
    // people she has not met, is a bar most will not clear and should not have to.
    { key: 'community', href: '/community', done: posts || comments },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, complete: doneCount === steps.length };
}
