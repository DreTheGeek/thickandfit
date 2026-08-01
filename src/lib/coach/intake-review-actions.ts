'use server';
// Server action for the intake review queue. Coach-gated, and it does exactly one thing: clear the
// review flag once a human has read the note. It cannot edit or delete the note or the extraction.
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { markIntakeReviewed } from '@/lib/coach/intake-review';

export async function markIntakeReviewedAction(profileId: string): Promise<{ ok: boolean }> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false };
  if (typeof profileId !== 'string' || profileId.length < 10) return { ok: false };
  const ok = await markIntakeReviewed(ctx.companyId, profileId);
  // The queue is a server component, so the list has to be re-fetched for the row to disappear.
  if (ok) revalidatePath('/coach/intake');
  return { ok };
}
