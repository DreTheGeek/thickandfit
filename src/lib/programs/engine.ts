// Program builder engine: nested plan -> sessions -> session_exercises, templates, assignment.
import 'server-only';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';

const exerciseSchema = z.object({
  exercise_id: z.string().uuid(),
  format: z.enum(['straight', 'circuit', 'superset']).default('straight'),
  sets: z.number().int().optional(),
  reps: z.number().int().optional(),
  time_sec: z.number().int().optional(),
  weight: z.number().optional(),
  rest_sec: z.number().int().optional(),
  rounds: z.number().int().optional(),
  notes: z.string().optional(),
});
const sessionSchema = z.object({ day_label: z.string().min(1), exercises: z.array(exerciseSchema) });

export const saveProgramSchema = z.object({
  id: z.string().uuid().optional(),
  name_en: z.string().min(1),
  name_es: z.string().optional(),
  weeks: z.number().int().min(1).max(52).default(4),
  sessions: z.array(sessionSchema),
});
export type SaveProgramInput = z.infer<typeof saveProgramSchema>;

export async function saveProgram(companyId: string, createdBy: string, input: SaveProgramInput) {
  const supabase = createServiceClient();
  let planId = input.id;

  if (planId) {
    await supabase
      .from('plans')
      .update({ name_en: input.name_en, name_es: input.name_es ?? null, weeks: input.weeks })
      .eq('id', planId)
      .eq('company_id', companyId);
  } else {
    const { data } = await supabase
      .from('plans')
      .insert({ company_id: companyId, name_en: input.name_en, name_es: input.name_es ?? null, weeks: input.weeks, created_by: createdBy })
      .select('id')
      .single();
    planId = data?.id;
  }
  if (!planId) throw new Error('Save failed');

  await supabase.from('sessions').delete().eq('plan_id', planId).eq('company_id', companyId);
  for (let si = 0; si < input.sessions.length; si++) {
    const s = input.sessions[si];
    const { data: sess } = await supabase
      .from('sessions')
      .insert({ company_id: companyId, plan_id: planId, day_label: s.day_label, sort_order: si })
      .select('id')
      .single();
    if (sess && s.exercises.length) {
      const rows = s.exercises.map((e, ei) => ({
        company_id: companyId,
        session_id: sess.id,
        exercise_id: e.exercise_id,
        format: e.format,
        sets: e.sets ?? null,
        reps: e.reps ?? null,
        time_sec: e.time_sec ?? null,
        weight: e.weight ?? null,
        rest_sec: e.rest_sec ?? null,
        rounds: e.rounds ?? null,
        notes: e.notes ?? null,
        sort_order: ei,
      }));
      await supabase.from('session_exercises').insert(rows);
    }
  }
  return { planId };
}

export async function getProgram(companyId: string, planId: string) {
  const supabase = createServiceClient();
  const { data: plan } = await supabase
    .from('plans')
    .select('id, name_en, name_es, weeks, is_template')
    .eq('id', planId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!plan) return null;

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, day_label, sort_order')
    .eq('plan_id', planId)
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true });

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const bySession = new Map<string, unknown[]>();
  if (sessionIds.length) {
    const { data: exs } = await supabase
      .from('session_exercises')
      .select('session_id, exercise_id, format, sets, reps, reps_min, reps_max, time_sec, weight, rest_sec, rounds, notes, sort_order, group_key, group_kind, is_amrap')
      .in('session_id', sessionIds)
      .order('sort_order', { ascending: true });
    for (const e of exs ?? []) {
      if (!bySession.has(e.session_id)) bySession.set(e.session_id, []);
      bySession.get(e.session_id)!.push(e);
    }
  }
  return {
    plan,
    sessions: (sessions ?? []).map((s) => ({ ...s, exercises: bySession.get(s.id) ?? [] })),
  };
}

export async function markTemplate(companyId: string, planId: string) {
  const supabase = createServiceClient();
  await supabase.from('plans').update({ is_template: true }).eq('id', planId).eq('company_id', companyId);
  return { is_template: true };
}

export async function assignProgram(companyId: string, planId: string, profileId: string) {
  const supabase = createServiceClient();

  // Ownership guard: never trust client-supplied ids. The plan and the target
  // profile must both belong to this company before we upsert the assignment.
  const { data: plan } = await supabase
    .from('plans')
    .select('id')
    .eq('id', planId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!plan) throw new Error('Plan not found');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!profile) throw new Error('Profile not found');

  await supabase
    .from('plan_assignments')
    .upsert({ company_id: companyId, plan_id: planId, profile_id: profileId }, { onConflict: 'plan_id,profile_id' });
  return { assigned: true };
}

/**
 * A member's assigned plans, NEWEST ASSIGNMENT FIRST.
 *
 * The ordering is load-bearing, not tidiness. plan_assignments is UNIQUE(plan_id, profile_id)
 * (0009), so one member can legitimately hold several plans, and /workouts renders `plans[0]` as
 * "your program". Without an ORDER BY, Postgres is free to return those rows in any order it likes,
 * so which program a member sees was undefined and could change between two loads of the same
 * screen. Newest-first also matches the intent of the act: a coach assigning a plan today means
 * that one is the current one.
 *
 * NOTE for the caller: this still returns every plan. A member holding more than one has no way to
 * reach the others from /workouts, which takes the first and drops the rest silently.
 */
export async function getAssignedPlans(companyId: string, profileId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('plan_assignments')
    .select('plan:plan_id (id, name_en, name_es, weeks)')
    .eq('company_id', companyId)
    .eq('profile_id', profileId)
    .order('assigned_at', { ascending: false });
  return (data ?? []).map((r) => r.plan);
}
