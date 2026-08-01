import 'server-only';
// The intake review queue: members whose free-text note said something a human should read before a
// plan is built for them.
//
// The flag is set by the onboarding extractor, biased toward TRUE (pregnancy, recent surgery, chest
// pain, fainting, ED history, named medications). That bias only pays off if the flag actually
// reaches a person, which is what this file is for. A boolean column nobody looks at is worse than no
// flag at all, because it creates the belief that someone is checking.
//
// Read-only aggregation plus one write: mark reviewed. Nothing here changes a member's health data.
import { createServiceClient } from '@/lib/supabase/service';

export type IntakeReviewItem = {
  profileId: string;
  name: string;
  email: string | null;
  /** What she actually wrote. THE RECORD, shown in full, never the model's paraphrase alone. */
  notes: string;
  /** The extractor's read. Advisory: shown BESIDE her words, never instead of them. */
  summary: string | null;
  reviewReason: string | null;
  injuries: string[];
  conditions: string[];
  safety: string[];
  avoidFoods: string[];
  constraints: string[];
  createdAt: string | null;
};

type Row = {
  profile_id: string;
  intake_notes: string | null;
  intake_extraction: {
    summary?: string;
    reviewReason?: string | null;
    injuries?: string[];
    conditions?: string[];
    safety?: string[];
    avoidFoods?: string[];
    constraints?: string[];
  } | null;
  created_at: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

/**
 * Everyone still awaiting a look. Oldest first: a note that has waited three days is more urgent
 * than one from this morning, and newest-first queues quietly starve the bottom.
 */
export async function listIntakeReviews(companyId: string): Promise<IntakeReviewItem[]> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('client_intake')
    .select('profile_id, intake_notes, intake_extraction, created_at, profiles(full_name, email)')
    .eq('company_id', companyId)
    .eq('needs_coach_review', true)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) {
    console.error('listIntakeReviews:', error.message);
    return [];
  }
  return ((data ?? []) as unknown as Row[])
    // A flag with no text behind it is not reviewable, and showing an empty card would train the
    // coach to dismiss the queue.
    .filter((r) => (r.intake_notes ?? '').trim().length > 0)
    .map((r) => {
      const x = r.intake_extraction ?? {};
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return {
        profileId: r.profile_id,
        name: (p?.full_name ?? '').trim() || 'Member',
        email: p?.email ?? null,
        notes: (r.intake_notes ?? '').trim(),
        summary: x.summary?.trim() || null,
        reviewReason: x.reviewReason?.trim() || null,
        injuries: x.injuries ?? [],
        conditions: x.conditions ?? [],
        safety: x.safety ?? [],
        avoidFoods: x.avoidFoods ?? [],
        constraints: x.constraints ?? [],
        createdAt: r.created_at,
      };
    });
}

export async function countIntakeReviews(companyId: string): Promise<number> {
  const svc = createServiceClient();
  const { count, error } = await svc
    .from('client_intake')
    .select('profile_id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('needs_coach_review', true);
  if (error) {
    console.error('countIntakeReviews:', error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Clear the flag once a human has read it.
 *
 * Clears ONLY needs_coach_review. The note and the extraction stay on the row forever: they are part
 * of the member's intake and the coach will want them again at week six, long after the review itself
 * is a memory.
 */
export async function markIntakeReviewed(companyId: string, profileId: string): Promise<boolean> {
  const svc = createServiceClient();
  const { error } = await svc
    .from('client_intake')
    .update({ needs_coach_review: false })
    .eq('company_id', companyId)
    .eq('profile_id', profileId);
  if (error) {
    console.error('markIntakeReviewed:', error.message);
    return false;
  }
  return true;
}
