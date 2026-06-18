// Substitution engine. Ordered, context-scoped chains with reason tags; graceful fallback.
import 'server-only';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';

export const CONTEXTS = ['gym', 'bodyweight', 'bands', 'freeweights', 'machines'] as const;
const REASONS = ['knee_pain', 'machine_unavailable', 'make_easier', 'make_harder', 'equipment_swap'] as const;

export const saveChainSchema = z.object({
  context: z.enum(CONTEXTS),
  items: z.array(
    z.object({
      substitute_exercise_id: z.string().uuid(),
      reason_tag: z.enum(REASONS).optional(),
    }),
  ),
});
export type SaveChainInput = z.infer<typeof saveChainSchema>;

export async function saveChain(companyId: string, exerciseId: string, input: SaveChainInput) {
  const supabase = createServiceClient();
  await supabase
    .from('exercise_substitutions')
    .delete()
    .eq('company_id', companyId)
    .eq('exercise_id', exerciseId)
    .eq('context', input.context);

  if (input.items.length) {
    const rows = input.items.map((it, i) => ({
      company_id: companyId,
      exercise_id: exerciseId,
      substitute_exercise_id: it.substitute_exercise_id,
      context: input.context,
      reason_tag: it.reason_tag ?? null,
      sort_order: i,
    }));
    await supabase.from('exercise_substitutions').insert(rows);
  }
  return { saved: input.items.length };
}

export async function resolveSubstitutions(companyId: string, exerciseId: string, context: string) {
  const supabase = createServiceClient();
  const { data: subs } = await supabase
    .from('exercise_substitutions')
    .select('sort_order, reason_tag, substitute_exercise_id')
    .eq('company_id', companyId)
    .eq('exercise_id', exerciseId)
    .eq('context', context)
    .order('sort_order', { ascending: true });

  if (!subs || subs.length === 0) {
    const { data: original } = await supabase
      .from('exercises')
      .select('id, name_en, name_es, muscle_group, equipment')
      .eq('id', exerciseId)
      .maybeSingle();
    return {
      fallback: true,
      note: 'No substitutes curated for this context. Use the original.',
      original,
      substitutes: [] as unknown[],
    };
  }

  const ids = subs.map((s) => s.substitute_exercise_id);
  const { data: exs } = await supabase
    .from('exercises')
    .select('id, name_en, name_es, muscle_group, equipment')
    .in('id', ids);
  const byId = new Map((exs ?? []).map((e) => [e.id, e]));

  return {
    fallback: false,
    substitutes: subs.map((s) => ({
      sort_order: s.sort_order,
      reason_tag: s.reason_tag,
      exercise: byId.get(s.substitute_exercise_id) ?? null,
    })),
  };
}
