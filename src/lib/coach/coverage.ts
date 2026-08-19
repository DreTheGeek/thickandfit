import 'server-only';
// Reading assignment and coverage. The rules live in coverage-shared.ts; this is the query half.
//
// See .planning/OPERATOR-GAPS.md Part 4 for why this exists: the role model was already right
// (five roles, requireApprover so an assistant cannot approve her own draft) and the delegation was
// missing. A queue that is company-wide cannot be handed to anybody, and an absence with no way to
// express it is an outage rather than a supported mode.
import { createServiceClient } from '@/lib/supabase/service';
import { effectiveCoach, coveringFor, isAway, type Coverage } from '@/lib/coach/coverage-shared';

export type CoachRef = { id: string; name: string };

/**
 * Every coverage arrangement for a company that has not finished yet.
 *
 * Past arrangements are dropped at the query rather than in the resolver: they can never make a
 * difference to today's answer, and last August's rota growing forever behind a date filter is how
 * a small read turns into a large one.
 */
export async function listCoverage(companyId: string, at: Date = new Date()): Promise<Coverage[]> {
  const svc = createServiceClient();
  const today = at.toISOString().slice(0, 10);
  const { data, error } = await svc
    .from('coach_coverage')
    .select('coach_id, covering_coach_id, starts_on, ends_on')
    .eq('company_id', companyId)
    .gte('ends_on', today)
    .order('starts_on', { ascending: true })
    .limit(500);
  if (error) {
    // Fail OPEN, and this is the one judgement call in the file. An unreadable rota means the
    // resolver sees no coverage, so every member stays with the coach she is assigned to — the
    // queues are then stale rather than empty. The alternative, throwing, takes the console down
    // over a table that is empty for most of the year.
    console.error('listCoverage:', error.message);
    return [];
  }
  return ((data ?? []) as {
    coach_id: string;
    covering_coach_id: string;
    starts_on: string;
    ends_on: string;
  }[]).map((r) => ({
    coachId: r.coach_id,
    coveringCoachId: r.covering_coach_id,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
  }));
}

/** Staff who can own clients. Operators are excluded: ops is not coaching. */
export async function listAssignableCoaches(companyId: string): Promise<CoachRef[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('profiles')
    .select('id, full_name')
    .eq('company_id', companyId)
    .in('role', ['coach', 'assistant_coach'])
    .order('full_name', { ascending: true });
  return ((data ?? []) as { id: string; full_name: string | null }[]).map((p) => ({
    id: p.id,
    name: (p.full_name ?? '').trim() || 'Coach',
  }));
}

export type CoverageContext = {
  coverages: Coverage[];
  /** ISO day the resolver is answering for. */
  today: string;
  /** Coaches whose work this viewer is currently holding. Empty for almost everyone, almost always. */
  covering: CoachRef[];
  /** Has this viewer handed her own work to someone else today? */
  away: boolean;
  /** Whether anything is assigned at all. Drives whether a "mine / everyone" filter is worth showing. */
  anyAssigned: boolean;
};

/**
 * Everything a coach screen needs to answer "whose is this".
 *
 * `anyAssigned` is here because of the state the app is actually in: nothing is assigned, all 256
 * migrating members belong to the company, and a "mine" filter on that roster shows an empty
 * console. The queues default to everyone and only offer the filter once the answer can be
 * non-empty.
 */
export async function getCoverageContext(
  companyId: string,
  viewerId: string,
  at: Date = new Date(),
): Promise<CoverageContext> {
  const today = at.toISOString().slice(0, 10);
  const svc = createServiceClient();
  const [coverages, coaches, assignedRes] = await Promise.all([
    listCoverage(companyId, at),
    listAssignableCoaches(companyId),
    svc
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .not('assigned_coach_id', 'is', null),
  ]);
  const nameById = new Map(coaches.map((c) => [c.id, c.name]));
  return {
    coverages,
    today,
    covering: coveringFor(viewerId, coverages, today).map((id) => ({
      id,
      name: nameById.get(id) ?? 'Coach',
    })),
    away: isAway(viewerId, coverages, today),
    anyAssigned: (assignedRes.count ?? 0) > 0,
  };
}

/**
 * Narrow a list of members to the ones on this coach's plate.
 *
 * Takes the already-loaded rows rather than filtering in SQL, because coverage is a chain that
 * Postgres would have to walk and every queue in the app has already fetched its rows by the time
 * it wants to know this. Filtering in memory keeps ONE definition of "mine" — the pure resolver —
 * instead of a second one written in SQL that drifts from it.
 */
export function filterToMine<T>(
  rows: readonly T[],
  assignedCoachIdOf: (row: T) => string | null,
  viewerId: string,
  ctx: CoverageContext,
): T[] {
  return rows.filter(
    (r) => effectiveCoach(assignedCoachIdOf(r), ctx.coverages, ctx.today) === viewerId,
  );
}
