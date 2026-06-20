'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { saveChain, saveChainSchema, CONTEXTS } from '@/lib/substitutions/engine';

const ActionInput = z.object({
  exerciseId: z.string().uuid(),
  context: z.enum(CONTEXTS),
  items: saveChainSchema.shape.items,
});

export type SaveChainResult = { ok: boolean; saved?: number; error?: string };

/**
 * Persist one context's ordered substitution chain for an exercise. Company scope is pinned
 * from the authenticated coach context, never trusted from the client. Macros-free, RBAC-gated.
 */
export async function saveSubstitutionChainAction(input: unknown): Promise<SaveChainResult> {
  const parsed = ActionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  // Guard against an exercise being listed as its own substitute.
  if (parsed.data.items.some((it) => it.substitute_exercise_id === parsed.data.exerciseId)) {
    return { ok: false, error: 'self_reference' };
  }

  try {
    const result = await saveChain(ctx.companyId, parsed.data.exerciseId, {
      context: parsed.data.context,
      items: parsed.data.items,
    });
    revalidatePath(`/coach/exercises/${parsed.data.exerciseId}`);
    return { ok: true, saved: result.saved };
  } catch (err) {
    console.error('saveSubstitutionChainAction:', err instanceof Error ? err.message : String(err));
    return { ok: false, error: 'save_failed' };
  }
}
