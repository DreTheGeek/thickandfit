import 'server-only';
// Members who finished onboarding and have no training program yet.
//
// WHY THIS EXISTS. The app tells a new member "Steph writes your plan by hand, she will message you
// when it is ready." That sentence is now honest on the member's side, but on 2026-08-03 nothing
// made it true on the coach's: no queue, no task, no reminder, no age. A member could sit for a week
// and the only trace would be a Telegram alert that scrolled away the same evening.
//
// A promise the product makes to a member has to appear somewhere the coach cannot miss it, sorted
// by how long that person has been waiting. That is the whole job of this file.
import { createServiceClient } from '@/lib/supabase/service';

export type AwaitingProgramItem = {
  profileId: string;
  contactId: string | null;
  name: string;
  email: string | null;
  /** Onboarding completion, which is when the promise was made. Not signup. */
  waitingSince: string;
  waitingDays: number;
  /** Her stated goal, so the coach can start writing without opening the record. */
  goalSummary: string | null;
  /** Her coach, or null when the company owns her. Drives the mine/everyone filter on the queue. */
  assignedCoachId: string | null;
  /** Health flags from intake. A program cannot responsibly be written without seeing these. */
  injuries: string[];
  conditions: string[];
  tier: string | null;
};

/** Past this, a member has been waiting long enough that it is a problem rather than a backlog. */
export const OVERDUE_DAYS = 3;

type Row = {
  profile_id: string;
  answers: Record<string, unknown> | null;
  completed_at: string | null;
  profiles: { full_name: string | null; email: string | null; role: string | null } | null;
};

function label(slug: string): string {
  return String(slug ?? '').replace(/_/g, ' ').trim();
}

/**
 * Oldest first, because a queue sorted newest-first starves its own bottom, which is the exact
 * failure this list exists to prevent.
 */
export async function listAwaitingProgram(companyId: string): Promise<AwaitingProgramItem[]> {
  const svc = createServiceClient();

  const { data, error } = await svc
    .from('onboarding_responses')
    .select('profile_id, answers, completed_at, profiles(full_name, email, role, assigned_coach_id)')
    .eq('company_id', companyId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: true })
    .limit(200);
  if (error) {
    console.error('listAwaitingProgram:', error.message);
    return [];
  }

  const rows = ((data ?? []) as unknown as Row[]).filter((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    // Staff onboard too while testing. They are not waiting on a program from anyone.
    return p?.role === 'subscriber' || p?.role === 'free';
  });
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.profile_id);

  // Who already HAS a program, and the contact id for the deep link. Two queries over the whole
  // candidate set rather than two per member, so this stays flat as the roster grows.
  const [{ data: assigned }, { data: contacts }, { data: intakes }] = await Promise.all([
    svc.from('plan_assignments').select('profile_id').in('profile_id', ids),
    svc.from('contacts').select('id, profile_id, product_type').in('profile_id', ids),
    svc.from('client_intake').select('profile_id, intake_extraction').in('profile_id', ids),
  ]);

  const hasProgram = new Set(((assigned ?? []) as { profile_id: string }[]).map((a) => a.profile_id));
  const contactBy = new Map(
    ((contacts ?? []) as { id: string; profile_id: string; product_type: string | null }[]).map((c) => [
      c.profile_id,
      c,
    ]),
  );
  const intakeBy = new Map(
    ((intakes ?? []) as { profile_id: string; intake_extraction: { injuries?: string[]; conditions?: string[] } | null }[])
      .map((i) => [i.profile_id, i.intake_extraction ?? {}]),
  );

  const now = Date.now();
  return rows
    .filter((r) => !hasProgram.has(r.profile_id))
    .map((r) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      const a = (r.answers ?? {}) as Record<string, unknown>;
      const when = r.completed_at ?? new Date().toISOString();
      const x = intakeBy.get(r.profile_id) ?? {};
      const contact = contactBy.get(r.profile_id);

      // Pounds, not kg. The coach thinks in pounds and this list is scanned, not studied.
      const nowKg = Number(a.weightKg ?? 0);
      const goalKg = Number(a.goalWeightKg ?? 0);
      const lb = (kg: number): number => Math.round(kg * 2.20462);
      const goals = Array.isArray(a.primaryGoals) ? (a.primaryGoals as string[]).map(label).join(', ') : '';
      const goalSummary =
        nowKg && goalKg
          ? `${lb(nowKg)} to ${lb(goalKg)} lb${goals ? ` · ${goals}` : ''}`
          : goals || null;

      return {
        profileId: r.profile_id,
        contactId: contact?.id ?? null,
        name: (p?.full_name ?? '').trim() || 'Member',
        email: p?.email ?? null,
        assignedCoachId: (p as { assigned_coach_id?: string | null } | null)?.assigned_coach_id ?? null,
        waitingSince: when,
        waitingDays: Math.max(0, Math.floor((now - Date.parse(when)) / 86_400_000)),
        goalSummary,
        injuries: (x.injuries ?? []).map(label),
        conditions: (x.conditions ?? []).map(label),
        tier: contact?.product_type ?? null,
      };
    });
}

/** For the nav badge. Counts the same set the list shows, so the two can never disagree. */
export async function countAwaitingProgram(companyId: string): Promise<number> {
  return (await listAwaitingProgram(companyId)).length;
}
