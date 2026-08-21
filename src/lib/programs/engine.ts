// Program builder engine: nested plan -> sessions -> session_exercises, templates, assignment.
import 'server-only';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * EVERY column the builder round-trips, and the reason this list has to be complete.
 *
 * saveProgram DELETEs the plan's sessions and re-inserts them, so anything absent from this schema
 * is not "left alone", it is DESTROYED on the next save. The builder used to send sets, reps and
 * rest_sec only, which meant one tap of SAVE PROGRAM on any of Stephanie's 41 imported plans would
 * have erased, across the library:
 *
 *     1,531 superset groupings (61% of all prescribed movements)
 *     2,066 rep ranges         (83%)
 *     2,438 coaching notes     (97%)
 *       271 timed durations
 *       209 prescribed weights
 *
 * silently, with a success toast. Nothing would have thrown. She would have found out weeks later
 * from a member performing her supersets as straight sets.
 *
 * The rule for anyone adding a column to session_exercises: add it HERE in the same change, or the
 * builder becomes a data-loss tool the first time a coach opens a plan that uses it.
 */
const exerciseSchema = z.object({
  exercise_id: z.string().uuid(),
  format: z.enum(['straight', 'circuit', 'superset']).default('straight'),
  sets: z.number().int().nullable().optional(),
  reps: z.number().int().nullable().optional(),
  reps_min: z.number().int().nullable().optional(),
  reps_max: z.number().int().nullable().optional(),
  is_amrap: z.boolean().optional(),
  time_sec: z.number().int().nullable().optional(),
  weight: z.number().nullable().optional(),
  rest_sec: z.number().int().nullable().optional(),
  rounds: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  // Supersets. group_key ties the movements performed back to back; group_kind names the shape.
  // Free text rather than an enum: the importer wrote whatever her Lenus export carried, and an
  // enum here would reject her own data on the way back in.
  group_key: z.string().nullable().optional(),
  group_kind: z.string().nullable().optional(),
  tempo: z.string().nullable().optional(),
  pct_1rm: z.number().nullable().optional(),
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
        reps_min: e.reps_min ?? null,
        reps_max: e.reps_max ?? null,
        is_amrap: e.is_amrap ?? false,
        time_sec: e.time_sec ?? null,
        weight: e.weight ?? null,
        rest_sec: e.rest_sec ?? null,
        rounds: e.rounds ?? null,
        notes: e.notes ?? null,
        group_key: e.group_key ?? null,
        group_kind: e.group_kind ?? null,
        tempo: e.tempo ?? null,
        pct_1rm: e.pct_1rm ?? null,
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

  // assigned_at is written explicitly, and that is not tidiness. plan_assignments is
  // UNIQUE(plan_id, profile_id), so putting a member back on a plan she has run before is an UPDATE,
  // and an update that omits assigned_at leaves the original date in place. Stephanie has 40
  // programs and reruns them; the second time a client goes through the same 12-week block, the old
  // date meant /workouts computed her week from a start months ago and pinned her at "week 12 of 12"
  // forever, and the renewal queue kept reporting the plan as expired with no action that could
  // clear it. Re-assigning IS a new assignment, and the date has to say so.
  //
  // Safe to bump: the only caller is POST /api/programs/[id]/assign, a deliberate coach action.
  // autoAssignStarterProgram writes with ignoreDuplicates and only when she holds nothing at all.
  await supabase.from('plan_assignments').upsert(
    {
      company_id: companyId,
      plan_id: planId,
      profile_id: profileId,
      assigned_at: new Date().toISOString(),
    },
    { onConflict: 'plan_id,profile_id' },
  );
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
