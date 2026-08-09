'use server';

// Star / unstar an exercise for the coach who is reading the list. Personal, not company-wide:
// see 0118 for why. Every export in this file must be async ('use server' rejects anything else,
// and a single non-async export 500s every action in the module).

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';

const inputSchema = z.object({
  exerciseId: z.string().uuid(),
  isFavorite: z.boolean(),
});

export async function setExerciseFavorite(input: {
  exerciseId: string;
  isFavorite: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const { exerciseId, isFavorite } = parsed.data;

  const sb = createServiceClient();

  if (!isFavorite) {
    const { error } = await sb
      .from('exercise_favorites')
      .delete()
      .eq('profile_id', ctx.userId)
      .eq('exercise_id', exerciseId);
    if (error) {
      console.error('[setExerciseFavorite:delete]', error.message);
      return { ok: false, error: 'save_failed' };
    }
  } else {
    // upsert on the (profile, exercise) unique key: double-clicking the star must not 23505.
    const { error } = await sb
      .from('exercise_favorites')
      .upsert(
        { company_id: ctx.companyId, profile_id: ctx.userId, exercise_id: exerciseId },
        { onConflict: 'profile_id,exercise_id' },
      );
    if (error) {
      console.error('[setExerciseFavorite:upsert]', error.message);
      return { ok: false, error: 'save_failed' };
    }
  }

  // Both surfaces read the star: the list renders it, the detail page shows it in the header.
  revalidatePath('/coach/exercises');
  revalidatePath(`/coach/exercises/${exerciseId}`);
  return { ok: true };
}
