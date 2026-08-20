// Substitution engine. Ordered, context-scoped chains with reason tags; graceful fallback.
import 'server-only';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { demoUrls } from '@/lib/exercises/demo-url';

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
      // Resolves a COMMITTED exercise by id. NEVER add .is('archived_at', null) here:
      // curation (0105) must not erase history, and filtering this fails SILENTLY as an
      // untitled card with no demo rather than throwing.
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
    .select('id, name_en, name_es, muscle_group, equipment, demo_storage_path')
    .in('id', ids);

  // The substitute carries its OWN demo. Without this the player swapped the name and kept the
  // previous movement's video, which is worse than showing none: she would be watching a demo of
  // the exercise she just swapped away from, at the moment she is least sure what to do.
  //
  // Signed here rather than shipping the path, for the same reason the workout page does it: the
  // bucket is private and a path in a JSON response is an index of the library.
  const signed = await demoUrls(
    (exs ?? [])
      .map((e) => (e as { demo_storage_path?: string | null }).demo_storage_path)
      .filter((p): p is string => typeof p === 'string' && p.length > 0),
  );
  const byId = new Map(
    (exs ?? []).map((e) => {
      const { demo_storage_path: path, ...rest } = e as typeof e & { demo_storage_path?: string | null };
      return [e.id, { ...rest, demoUrl: (path && signed.get(path)) || null }];
    }),
  );

  return {
    fallback: false,
    substitutes: subs.map((s) => ({
      sort_order: s.sort_order,
      reason_tag: s.reason_tag,
      exercise: byId.get(s.substitute_exercise_id) ?? null,
    })),
  };
}
