// Workout player page. Requires auth; the plan must be assigned to this client.
import { requireAuth } from '@/lib/auth/guards';
import { getProgram } from '@/lib/programs/engine';
import { createServiceClient } from '@/lib/supabase/service';
import { WorkoutPlayer } from '@/components/workout/workout-player';

export const dynamic = 'force-dynamic';

type SessionExercise = {
  exercise_id: string;
  sets: number | null;
  reps: number | null;
  rest_sec: number | null;
  notes: string | null;
};

export default async function WorkoutPage({ params }: { params: Promise<{ planId: string }> }) {
  const ctx = await requireAuth();
  const { planId } = await params;

  const supabase = createServiceClient();
  const { data: assigned } = await supabase
    .from('plan_assignments')
    .select('id')
    .eq('plan_id', planId)
    .eq('profile_id', ctx.userId)
    .maybeSingle();

  const program = ctx.companyId ? await getProgram(ctx.companyId, planId) : null;

  if (!assigned || !program || program.sessions.length === 0) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-black">
        <p className="text-neutral-700">No workout available.</p>
      </main>
    );
  }

  const session = program.sessions[0];
  const exList = session.exercises as SessionExercise[];
  const ids = exList.map((e) => e.exercise_id);
  const { data: exs } = await supabase.from('exercises').select('id, name_en').in('id', ids);
  const byId = new Map((exs ?? []).map((e) => [e.id, e.name_en]));

  const playerExercises = exList.map((e) => ({
    exercise_id: e.exercise_id,
    name: byId.get(e.exercise_id) ?? 'Exercise',
    sets: e.sets,
    reps: e.reps,
    rest_sec: e.rest_sec,
    notes: e.notes,
  }));

  return (
    <main className="mx-auto max-w-lg px-6 py-12 text-black">
      <h1 className="mb-6 text-3xl font-bold uppercase tracking-tight">{program.plan.name_en}</h1>
      <WorkoutPlayer dayLabel={session.day_label} exercises={playerExercises} />
    </main>
  );
}
