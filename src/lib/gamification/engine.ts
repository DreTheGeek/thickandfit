// Gamification engine. SERVER-ONLY.
// One public entry point per use: recomputeGamification(profileId, companyId) which:
//   1. gathers the member's distinct ACTIVITY DAYS (workout completion | food log | weight entry)
//   2. derives the current + longest streak, applying ONE freeze token to bridge a single
//      missed day (so a member who logs Mon, Tue, Thu keeps a 3-day streak if they hold a token)
//   3. computes the lifetime counters badges compare against (workout days, logging days,
//      lbs moved toward goal)
//   4. awards any newly-crossed badges idempotently (unique (profile_id, badge_id))
//   5. fires a notification per newly-earned badge (createNotification; push is key-gated no-op)
//   6. upserts user_streaks and returns the snapshot the UI renders, including which badge keys
//      were freshly earned this run (so the dashboard can pop confetti exactly once).
//
// All reads/writes use the service client (BYPASSRLS) because this runs on the server on behalf
// of one member. Pure, deterministic; no external keys required.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { createNotification } from '@/lib/notifications/create';
import { localDay, resolveTimezone } from '@/lib/datetime/local-day';
import type {
  Badge,
  BadgeKind,
  BadgeStatus,
  GamificationSnapshot,
  StreakState,
} from '@/lib/gamification/types';

const KG_TO_LB = 2.20462;
// Look back far enough to cover the longest streak badge (100 days) plus headroom.
const LOOKBACK_DAYS = 200;
// One token regenerates per this many consecutive active days, capped, so freezes feel earned.
const FREEZE_EARN_EVERY = 7;
const FREEZE_CAP = 3;

type DbBadge = {
  id: string;
  key: string;
  name_en: string;
  name_es: string;
  description_en: string;
  description_es: string;
  icon: string;
  threshold: number;
  kind: string;
  sort_order: number;
};

export type RecomputeResult = {
  snapshot: GamificationSnapshot;
  newlyEarnedKeys: string[];
  // Distinct local ISO days (YYYY-MM-DD) the member was active (workout | food log | weight entry),
  // ascending. The home week strip paints these green.
  activeDays: string[];
};

function toBadge(b: DbBadge): Badge {
  return {
    id: b.id,
    key: b.key,
    nameEn: b.name_en,
    nameEs: b.name_es,
    descriptionEn: b.description_en,
    descriptionEs: b.description_es,
    icon: b.icon,
    threshold: b.threshold,
    kind: (b.kind as BadgeKind) ?? 'misc',
    sortOrder: b.sort_order,
  };
}

function dateKey(value: string): string {
  // value may be a date ('2026-06-21') or a timestamptz; take the date portion.
  return value.slice(0, 10);
}

function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(`${aIso}T00:00:00Z`);
  const b = Date.parse(`${bIso}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

/**
 * Walk the sorted-descending distinct active days from `today` backward. A gap of exactly one
 * missing day may be bridged ONCE if a freeze token is available; any larger gap, or a second
 * single-day gap with no token left, ends the current streak.
 * Returns the current streak length and how many freeze tokens were consumed bridging it.
 */
function computeCurrentStreak(
  activeDaysDesc: string[],
  today: string,
  availableFreezes: number,
): { current: number; freezesUsed: number } {
  if (activeDaysDesc.length === 0) return { current: 0, freezesUsed: 0 };

  const set = new Set(activeDaysDesc);
  // The streak only counts if the member was active today or yesterday (today not yet logged).
  const mostRecent = activeDaysDesc[0]!;
  const gapToNow = daysBetween(today, mostRecent);
  if (gapToNow > 1) return { current: 0, freezesUsed: 0 };

  let freezesLeft = availableFreezes;
  let freezesUsed = 0;
  let count = 0;
  // Start from the most recent active day and walk backward one calendar day at a time.
  let cursor = mostRecent;
  // Count the anchor day.
  count = 1;
  while (true) {
    const prev = isoMinusDays(cursor, 1);
    if (set.has(prev)) {
      count += 1;
      cursor = prev;
      continue;
    }
    // prev is missing. Can we bridge a single-day gap? Check the day before prev.
    const prevPrev = isoMinusDays(cursor, 2);
    if (freezesLeft > 0 && set.has(prevPrev)) {
      freezesLeft -= 1;
      freezesUsed += 1;
      // The frozen day counts toward the streak (the freeze "saved" it).
      count += 2;
      cursor = prevPrev;
      continue;
    }
    break;
  }
  return { current: count, freezesUsed };
}

function isoMinusDays(iso: string, n: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`) - n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Longest run of consecutive active days (no freeze applied; this is the pure best). */
function computeLongestStreak(activeDaysAsc: string[]): number {
  if (activeDaysAsc.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < activeDaysAsc.length; i += 1) {
    if (daysBetween(activeDaysAsc[i]!, activeDaysAsc[i - 1]!) === 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

/**
 * Recompute streak + badges for one member. Idempotent and safe to call on every dashboard load.
 * Returns the snapshot plus the keys of badges earned THIS run (for confetti).
 */
export async function recomputeGamification(
  profileId: string,
  companyId: string,
): Promise<RecomputeResult> {
  const svc = createServiceClient();
  // Anchor "today" to the member's LOCAL calendar day so streaks match the diary day they see.
  // log_date / recorded_on are now written as the user's local day too (WP11), so the streak math
  // and the activity rows agree.
  const { data: tzRow } = await svc
    .from('profiles')
    .select('timezone')
    .eq('id', profileId)
    .maybeSingle();
  const tz = resolveTimezone((tzRow as { timezone: string | null } | null)?.timezone);
  const today = localDay(tz);
  const since = isoMinusDays(today, LOOKBACK_DAYS);

  // --- Gather activity (three sources) in parallel ---
  const [workoutRes, foodRes, weightRes, badgesRes, ownedRes, streakRes, onbRes] =
    await Promise.all([
      svc
        .from('workout_completion_history')
        .select('changed_at, status')
        .eq('profile_id', profileId)
        .eq('status', 'completed')
        .gte('changed_at', `${since}T00:00:00Z`),
      svc
        .from('food_log')
        .select('log_date')
        .eq('profile_id', profileId)
        .gte('log_date', since),
      svc
        .from('weight_entries')
        .select('recorded_on, weight_kg')
        .eq('profile_id', profileId)
        .order('recorded_on', { ascending: true }),
      svc.from('badges').select('*').order('sort_order', { ascending: true }),
      svc.from('user_badges').select('badge_id, earned_at').eq('profile_id', profileId),
      svc.from('user_streaks').select('*').eq('profile_id', profileId).maybeSingle(),
      svc
        .from('onboarding_responses')
        .select('answers')
        .eq('profile_id', profileId)
        .maybeSingle(),
    ]);

  const workoutDays = new Set<string>();
  for (const r of (workoutRes.data ?? []) as { changed_at: string }[]) {
    // changed_at is a timestamptz INSTANT: bucket it into the member's LOCAL day, matching how
    // food (log_date) and weight (recorded_on) already store local days. Slicing UTC mispainted the
    // week strip and corrupted streaks for evening workouts west of UTC.
    workoutDays.add(localDay(tz, new Date(r.changed_at)));
  }
  const loggingDays = new Set<string>();
  for (const r of (foodRes.data ?? []) as { log_date: string }[]) {
    loggingDays.add(dateKey(r.log_date));
  }
  const weightDays = new Set<string>();
  for (const r of (weightRes.data ?? []) as { recorded_on: string }[]) {
    weightDays.add(dateKey(r.recorded_on));
  }

  // Any-activity-per-day union.
  const activeSet = new Set<string>([...workoutDays, ...loggingDays, ...weightDays]);
  const activeAsc = [...activeSet].sort();
  const activeDesc = [...activeAsc].reverse();

  // --- Freeze tokens: prior balance + earned from the active run, capped ---
  const priorStreak = streakRes.data as
    | { current_streak: number; longest_streak: number; freeze_tokens: number }
    | null;
  const priorFreezes = priorStreak?.freeze_tokens ?? 0;

  const { current: rawCurrent, freezesUsed } = computeCurrentStreak(
    activeDesc,
    today,
    priorFreezes,
  );
  const longest = Math.max(computeLongestStreak(activeAsc), priorStreak?.longest_streak ?? 0, rawCurrent);

  // Regenerate one token per FREEZE_EARN_EVERY active days reached in the current streak,
  // minus what we just spent, capped. Never goes negative.
  const earnedFreezes = Math.floor(rawCurrent / FREEZE_EARN_EVERY);
  const freezeTokens = Math.max(
    0,
    Math.min(FREEZE_CAP, priorFreezes - freezesUsed + earnedFreezes),
  );

  const streak: StreakState = {
    currentStreak: rawCurrent,
    longestStreak: longest,
    lastActiveOn: activeDesc[0] ?? null,
    freezeTokens,
  };

  // --- Counters for badge thresholds ---
  const workoutDayCount = workoutDays.size;
  const loggingDayCount = loggingDays.size;

  // lbs moved toward goal: |start - current| but only the portion in the goal direction.
  const answers = (onbRes.data?.answers ?? null) as
    | { weightKg?: number; goalWeightKg?: number }
    | null;
  const weightRows = (weightRes.data ?? []) as { recorded_on: string; weight_kg: number }[];
  let lbsTowardGoal = 0;
  if (answers?.weightKg && answers?.goalWeightKg && weightRows.length > 0) {
    const startKg = answers.weightKg;
    const goalKg = answers.goalWeightKg;
    const currentKg = Number(weightRows[weightRows.length - 1]!.weight_kg);
    const goingDown = goalKg < startKg;
    const movedKg = goingDown
      ? Math.max(0, startKg - currentKg)
      : Math.max(0, currentKg - startKg);
    lbsTowardGoal = Math.floor(movedKg * KG_TO_LB);
  }

  // --- Badge evaluation ---
  const allBadges = ((badgesRes.data ?? []) as DbBadge[]).map(toBadge);
  const ownedRows = (ownedRes.data ?? []) as { badge_id: string; earned_at: string }[];
  const ownedById = new Map<string, string>();
  for (const r of ownedRows) ownedById.set(r.badge_id, r.earned_at);

  function counterFor(kind: BadgeKind): number {
    switch (kind) {
      case 'workout':
        return workoutDayCount;
      case 'logging':
        return loggingDayCount;
      case 'streak':
        return Math.max(rawCurrent, longest);
      case 'weight':
        return lbsTowardGoal;
      default:
        return 0;
    }
  }

  const toAward: Badge[] = [];
  for (const b of allBadges) {
    if (ownedById.has(b.id)) continue;
    if (counterFor(b.kind) >= b.threshold) toAward.push(b);
  }

  // Insert new awards (idempotent: ignore unique-violation conflicts).
  const newlyEarnedKeys: string[] = [];
  if (toAward.length > 0) {
    const rows = toAward.map((b) => ({
      company_id: companyId,
      profile_id: profileId,
      badge_id: b.id,
    }));
    const { error } = await svc
      .from('user_badges')
      .upsert(rows, { onConflict: 'profile_id,badge_id', ignoreDuplicates: true });
    if (!error) {
      const nowIso = new Date().toISOString();
      for (const b of toAward) {
        ownedById.set(b.id, nowIso);
        newlyEarnedKeys.push(b.key);
      }
    } else {
      console.error('gamification award upsert:', error.message);
    }
  }

  // Persist streak state (upsert on the primary key).
  const { error: streakErr } = await svc.from('user_streaks').upsert(
    {
      profile_id: profileId,
      company_id: companyId,
      current_streak: streak.currentStreak,
      longest_streak: streak.longestStreak,
      last_active_on: streak.lastActiveOn,
      freeze_tokens: streak.freezeTokens,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id' },
  );
  if (streakErr) console.error('gamification streak upsert:', streakErr.message);

  // Fire a notification per newly-earned badge (fire-and-forget; push key-gated).
  for (const key of newlyEarnedKeys) {
    const b = allBadges.find((x) => x.key === key);
    if (!b) continue;
    void createNotification(companyId, profileId, {
      type: 'streak',
      title: `${b.icon} ${b.nameEn}`,
      body: b.descriptionEn,
      link: '/you',
    });
  }

  const badgeStatuses: BadgeStatus[] = allBadges.map((b) => ({
    ...b,
    earned: ownedById.has(b.id),
    earnedAt: ownedById.get(b.id) ?? null,
  }));

  const snapshot: GamificationSnapshot = {
    streak,
    badges: badgeStatuses,
    earnedCount: badgeStatuses.filter((b) => b.earned).length,
    totalCount: badgeStatuses.length,
  };

  // workoutToday drives the dashboard's "today's workout" check: it must reflect an ACTUAL workout
  // completion today, not streak>0 (any food/weight log kept the old check green all day).
  return { snapshot, newlyEarnedKeys, activeDays: activeAsc, workoutToday: workoutDays.has(today) };
}
