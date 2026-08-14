import 'server-only';
// Engagement risk: the reads. One sweep of the roster, one answer per member, consumed by both the
// coach queue (/coach/quiet) and the automated nudge ladder (generateReengagementNudges). The
// thresholds and the classifier live in risk-shared.ts and are tested without a database.
//
// HOW "LAST ACTIVE" IS ANSWERED, and why it takes two sources.
//
// user_streaks.last_active_on already exists and covers ALL history in one row per member, which is
// exactly the shape a roster sweep wants. It is not sufficient alone, for two reasons:
//   1. It is written by recomputeGamification, which runs when the member opens /dashboard or /you.
//      A member who logs food and closes the app can leave it a day or two stale.
//   2. It counts three things (completed workout, food log, weigh-in) and misses two that plainly
//      mean she showed up: submitting a check-in, and sending her coach a message.
// So the sweep takes the MAX of last_active_on and a 30-day window over the activity tables. The
// window is bounded (30 days > the 28-day ghost threshold, so anything past it is already the worst
// band and its exact age comes from last_active_on). Neither source can make a member look quieter
// than she is, which is the direction that matters: a false "she's gone" costs a real member an
// unwanted guilt-trip, and that is worse than missing one.
//
// PROFILE-KEYED ONLY. Migrated Lenus members who have not claimed an app account have a contact row
// and no profile, so there is nothing to be quiet WITH: they cannot log, cannot be notified, and
// their queue is the invite/claim one (invite-legacy), not this. Reading contact-keyed history here
// would put 250 people who have never seen the app at the top of a churn queue on day one.
import { createServiceClient } from '@/lib/supabase/service';
import {
  classifyRisk,
  daysSince,
  isEngagementRisk,
  TIER_RANK,
  type RiskTier,
} from '@/lib/engagement/risk-shared';

/** How far back the activity sweep looks. Past this, last_active_on carries the answer. */
const WINDOW_DAYS = 30;
/**
 * Per-table row cap. Reached only if the roster logs more than this in 30 days, which at 270
 * members means ~2.5 food entries per person per day across the whole book. If it ever IS reached
 * the result says so out loud (`truncated`) rather than quietly reporting the tail as inactive.
 */
const ROW_CAP = 20_000;

export type EngagementRow = {
  profileId: string;
  contactId: string | null;
  name: string;
  email: string | null;
  locale: string;
  tier: RiskTier;
  /** Days since she last did anything. Counts from onboarding when she has never done anything. */
  daysQuiet: number;
  /** Days since she finished onboarding. */
  memberAgeDays: number;
  workouts30d: number;
  /** ISO day of her last activity, or null when there has never been one. */
  lastActiveOn: string | null;
  /**
   * ISO day the current quiet spell began: her last active day, or her onboarding day if she has
   * never had one. This is the anchor the nudge ladder dedupes against, so that a member who comes
   * back and lapses again gets the ladder again instead of being permanently marked as done.
   */
  quietSince: string;
};

export type EngagementSweep = {
  rows: EngagementRow[];
  /** Tables whose 30-day window hit ROW_CAP. Non-empty means the numbers below are a floor. */
  truncated: string[];
};

type ProfileRow = {
  id: string;
  company_id: string;
  full_name: string | null;
  email: string | null;
  ui_locale: string | null;
  role: string;
  comp_access_until: string | null;
};

/** Fold `rows` into a map of profile_id -> latest ISO day seen. */
function foldLatest(
  into: Map<string, string>,
  rows: unknown[],
  dateKey: string,
): void {
  for (const raw of rows as Record<string, string | null>[]) {
    const id = raw.profile_id;
    const at = raw[dateKey];
    if (!id || !at) continue;
    const day = at.slice(0, 10);
    const prev = into.get(id);
    if (!prev || day > prev) into.set(id, day);
  }
}

/**
 * Every onboarded member with an app account, classified.
 *
 * Returns EVERYONE, including tier 'ok'. Callers filter. The queue wants the risky ones and the
 * nudge job wants the quiet ones, but a caller that wants a denominator ("14 of 260 have gone
 * quiet") should not have to run the sweep twice to get it.
 */
export async function getEngagementSweep(companyId: string): Promise<EngagementSweep> {
  const svc = createServiceClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const sinceIso = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();
  const sinceDay = sinceIso.slice(0, 10);

  const { data: profileData, error: profileErr } = await svc
    .from('profiles')
    .select('id, company_id, full_name, email, ui_locale, role, comp_access_until')
    .eq('company_id', companyId)
    .in('role', ['subscriber', 'free']);
  if (profileErr) {
    console.error('getEngagementSweep profiles:', profileErr.message);
    return { rows: [], truncated: [] };
  }

  const profiles = ((profileData ?? []) as ProfileRow[]).filter(
    // A free account whose comp has lapsed cannot reach the app. She is a billing problem, and the
    // billing queue already has her; putting her here too would double-count the same person under
    // two names on the same screen.
    (p) => p.role !== 'free' || (p.comp_access_until != null && p.comp_access_until > nowIso),
  );
  if (profiles.length === 0) return { rows: [], truncated: [] };

  const ids = profiles.map((p) => p.id);

  const [onbRes, streakRes, workoutRes, foodRes, weightRes, habitRes, formRes, msgRes, contactRes] =
    await Promise.all([
      // The clock starts at onboarding, not signup: before she finishes it the app owes her nothing
      // and generateOnboardingNudges owns her. Members with no completed row are dropped entirely.
      svc
        .from('onboarding_responses')
        .select('profile_id, completed_at')
        .eq('company_id', companyId)
        .in('profile_id', ids)
        .not('completed_at', 'is', null),
      svc.from('user_streaks').select('profile_id, last_active_on').in('profile_id', ids),
      svc
        .from('workout_logs')
        .select('profile_id, performed_at')
        .eq('company_id', companyId)
        .gte('performed_at', sinceIso)
        .limit(ROW_CAP),
      svc
        .from('food_log')
        .select('profile_id, log_date')
        .eq('company_id', companyId)
        .gte('log_date', sinceDay)
        .limit(ROW_CAP),
      svc
        .from('weight_entries')
        .select('profile_id, recorded_on')
        .eq('company_id', companyId)
        .gte('recorded_on', sinceDay)
        .limit(ROW_CAP),
      svc
        .from('habit_logs')
        .select('profile_id, logged_date')
        .eq('company_id', companyId)
        .gte('logged_date', sinceDay)
        .limit(ROW_CAP),
      svc
        .from('form_responses')
        .select('profile_id, submitted_at')
        .eq('company_id', companyId)
        .gte('submitted_at', sinceIso)
        .limit(ROW_CAP),
      // Her message, not the coach's. A coach writing into the void is the opposite of engagement,
      // and counting it would let an outreach attempt clear the very flag that prompted it.
      svc
        .from('client_messages')
        .select('profile_id, sent_at')
        .eq('company_id', companyId)
        .eq('is_from_coach', false)
        .gte('sent_at', sinceIso)
        .limit(ROW_CAP),
      svc.from('contacts').select('id, profile_id').eq('company_id', companyId).in('profile_id', ids),
    ]);

  const onboarded = new Map(
    ((onbRes.data ?? []) as { profile_id: string; completed_at: string }[]).map((r) => [
      r.profile_id,
      r.completed_at,
    ]),
  );

  const latest = new Map<string, string>();
  for (const r of (streakRes.data ?? []) as { profile_id: string; last_active_on: string | null }[]) {
    if (r.last_active_on) latest.set(r.profile_id, r.last_active_on.slice(0, 10));
  }
  foldLatest(latest, workoutRes.data ?? [], 'performed_at');
  foldLatest(latest, foodRes.data ?? [], 'log_date');
  foldLatest(latest, weightRes.data ?? [], 'recorded_on');
  foldLatest(latest, habitRes.data ?? [], 'logged_date');
  foldLatest(latest, formRes.data ?? [], 'submitted_at');
  foldLatest(latest, msgRes.data ?? [], 'sent_at');

  // Workouts inside the window, per member. Only read for members inside the first-month rule, but
  // counted for everyone because the fold is free once the rows are here.
  const workouts = new Map<string, number>();
  for (const r of (workoutRes.data ?? []) as { profile_id: string | null }[]) {
    if (!r.profile_id) continue;
    workouts.set(r.profile_id, (workouts.get(r.profile_id) ?? 0) + 1);
  }

  const contactBy = new Map(
    ((contactRes.data ?? []) as { id: string; profile_id: string | null }[])
      .filter((c) => c.profile_id)
      .map((c) => [c.profile_id as string, c.id]),
  );

  const truncated: string[] = [];
  const capped: Array<[string, { data: unknown[] | null }]> = [
    ['workout_logs', workoutRes],
    ['food_log', foodRes],
    ['weight_entries', weightRes],
    ['habit_logs', habitRes],
    ['form_responses', formRes],
    ['client_messages', msgRes],
  ];
  for (const [name, res] of capped) {
    if ((res.data ?? []).length >= ROW_CAP) truncated.push(name);
  }
  if (truncated.length > 0) {
    console.error(`getEngagementSweep: row cap hit on ${truncated.join(', ')}; results are a floor`);
  }

  const rows: EngagementRow[] = [];
  for (const p of profiles) {
    const completedAt = onboarded.get(p.id);
    if (!completedAt) continue;

    // null means "nothing in the 30-day window and no streak row", which is UNKNOWN rather than
    // never: a member who logged 45 days ago and has never loaded the dashboard since the streak
    // engine shipped has no row to read. The tier is still right (she is past every threshold the
    // window can see), so only the displayed age is a floor, and the page says so rather than
    // asserting she has never done anything.
    const lastActiveOn = latest.get(p.id) ?? null;
    const memberAgeDays = daysSince(completedAt, now);
    // No activity ever = quiet since the day she finished onboarding. Not "quiet forever": a member
    // who onboarded this morning and has not logged yet is at zero, which is correct and is what
    // keeps day-one signups off this list.
    const daysQuiet = lastActiveOn ? daysSince(lastActiveOn, now) : memberAgeDays;
    const workouts30d = workouts.get(p.id) ?? 0;

    rows.push({
      profileId: p.id,
      contactId: contactBy.get(p.id) ?? null,
      name: (p.full_name ?? '').trim() || 'Member',
      email: p.email,
      locale: p.ui_locale ?? 'en',
      tier: classifyRisk({ daysQuiet, memberAgeDays, workoutsSinceJoining: workouts30d }),
      daysQuiet,
      memberAgeDays,
      workouts30d,
      lastActiveOn,
      quietSince: lastActiveOn ?? completedAt.slice(0, 10),
    });
  }

  return { rows, truncated };
}

/** The coach queue: only members who need something, worst first, longest quiet first within a tier. */
export async function listEngagementRisk(companyId: string): Promise<EngagementSweep> {
  const sweep = await getEngagementSweep(companyId);
  const rows = sweep.rows
    .filter((r) => isEngagementRisk(r.tier))
    .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || b.daysQuiet - a.daysQuiet);
  return { rows, truncated: sweep.truncated };
}

/** For the attention chip. Counts the same set the page shows, so the two cannot disagree. */
export async function countEngagementRisk(companyId: string): Promise<number> {
  return (await listEngagementRisk(companyId)).rows.length;
}
