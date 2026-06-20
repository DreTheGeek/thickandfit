'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export type FavoriteResult = { ok: boolean; isFavorite?: boolean; error?: string };

const RecipeId = z.string().uuid();

// Toggle the caller's favorite for a recipe. Profile-scoped via RLS (profile_id = auth.uid()),
// so the user-session client is used (not the service client). Idempotent on the unique
// (profile_id, recipe_id) constraint.
export async function toggleRecipeFavoriteAction(recipeId: unknown): Promise<FavoriteResult> {
  const parsed = RecipeId.safeParse(recipeId);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const sb = await createClient();

  const { data: existing, error: readErr } = await sb
    .from('recipe_favorites')
    .select('id')
    .eq('profile_id', ctx.userId)
    .eq('recipe_id', parsed.data)
    .maybeSingle();
  if (readErr) {
    console.error('toggleRecipeFavoriteAction read:', readErr.message);
    return { ok: false, error: 'read_failed' };
  }

  if (existing) {
    const { error } = await sb.from('recipe_favorites').delete().eq('id', (existing as { id: string }).id);
    if (error) {
      console.error('toggleRecipeFavoriteAction delete:', error.message);
      return { ok: false, error: 'delete_failed' };
    }
    revalidatePath('/coach/tool/recipes');
    revalidatePath(`/coach/tool/recipes/${parsed.data}`);
    return { ok: true, isFavorite: false };
  }

  const { error } = await sb.from('recipe_favorites').insert({
    company_id: ctx.companyId,
    profile_id: ctx.userId,
    recipe_id: parsed.data,
  });
  if (error) {
    console.error('toggleRecipeFavoriteAction insert:', error.message);
    return { ok: false, error: 'insert_failed' };
  }
  revalidatePath('/coach/tool/recipes');
  revalidatePath(`/coach/tool/recipes/${parsed.data}`);
  return { ok: true, isFavorite: true };
}
