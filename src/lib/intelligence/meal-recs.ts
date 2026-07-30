import 'server-only';
// K8: adherence-aware meal recommendations.
//
// The distinction that makes this worth building: "your most-eaten foods" is a leaderboard, and every
// tracker has one. It is also useless as advice, because the food someone eats most is often the one
// quietly wrecking their week. What actually helps is knowing which foods show up on the days she HIT
// her protein target and are absent on the days she missed.
//
// So this computes LIFT, not frequency: for each food, the share of her on-target days it appears on
// versus the share of her off-target days. A food eaten every single day has zero lift and tells her
// nothing. A food on 70% of good days and 20% of bad ones is a genuine lever.
//
// Guards against the obvious ways this becomes nonsense:
//   * a minimum number of logged days before we say anything at all
//   * a minimum appearance count per food, so one lucky Tuesday cannot become "your best meal"
//   * both a good-day and a bad-day sample, because lift is meaningless without a contrast
// When any guard fails we return NOTHING rather than a weak suggestion. A confident wrong tip from
// something branded as her coach's intelligence costs more trust than silence does.

import { createServiceClient } from '@/lib/supabase/service';

/** Days of history considered. 30 matches the user_state rollup window. */
const WINDOW_DAYS = 30;
/** Below this many logged days there is no signal worth reporting. */
const MIN_LOGGED_DAYS = 8;
/** A food must appear this often before it can be ranked. */
const MIN_APPEARANCES = 3;
/** Both cohorts need this many days or lift is not a contrast. */
const MIN_COHORT_DAYS = 3;
/** Below this lift the difference is noise, not a lever. */
const MIN_LIFT = 0.15;

export type MealRec = {
  food: string;
  /** Share of on-target days this food appeared on (0-1). */
  goodDayRate: number;
  /** goodDayRate minus badDayRate. Higher = more strongly associated with hitting target. */
  lift: number;
  appearances: number;
};

export type MealIntelligence = {
  recs: MealRec[];
  /** Days with any food logged, in the window. */
  loggedDays: number;
  /** Days that hit the protein target. */
  onTargetDays: number;
  /** Null when we do not have a target to measure against. */
  proteinTargetG: number | null;
};

type LogRow = { log_date: string; protein_g: number | null; name: string | null };

/**
 * Which of her meals track with hitting protein.
 *
 * Protein is the axis on purpose: it is the target Stephanie coaches hardest, it is the one members
 * miss most, and unlike calories a protein miss is almost always a food-choice problem rather than a
 * portion problem, which makes "eat this" actionable advice.
 */
export async function getMealIntelligence(
  profileId: string,
  companyId: string,
): Promise<MealIntelligence> {
  const svc = createServiceClient();
  const empty: MealIntelligence = { recs: [], loggedDays: 0, onTargetDays: 0, proteinTargetG: null };

  const { data: stateRow } = await svc
    .from('user_state')
    .select('target_protein_g')
    .eq('profile_id', profileId)
    .eq('company_id', companyId)
    .maybeSingle();
  const target = (stateRow as { target_protein_g: number | null } | null)?.target_protein_g ?? null;
  if (!target || target <= 0) return empty;

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await svc
    .from('food_log')
    .select('log_date, protein_g, name')
    .eq('profile_id', profileId)
    .gte('log_date', since);
  if (error) {
    console.error('getMealIntelligence:', error.message);
    return empty;
  }

  const rows = (data ?? []) as LogRow[];
  if (!rows.length) return empty;

  // Roll up to days: total protein, and the set of distinct foods eaten that day. A food counted
  // twice in one day must not count twice toward its day-rate, hence the Set.
  const byDay = new Map<string, { protein: number; foods: Set<string> }>();
  for (const r of rows) {
    const day = (r.log_date ?? '').slice(0, 10);
    if (!day) continue;
    let d = byDay.get(day);
    if (!d) {
      d = { protein: 0, foods: new Set() };
      byDay.set(day, d);
    }
    d.protein += Number(r.protein_g ?? 0);
    const name = (r.name ?? '').trim();
    if (name) d.foods.add(name);
  }

  const loggedDays = byDay.size;
  const good: Set<string>[] = [];
  const bad: Set<string>[] = [];
  for (const d of byDay.values()) {
    // "Hit" is 90% of target, not 100%: coaching on a 4g miss is how you make someone quit.
    (d.protein >= target * 0.9 ? good : bad).push(d.foods);
  }

  const base: MealIntelligence = {
    recs: [],
    loggedDays,
    onTargetDays: good.length,
    proteinTargetG: target,
  };
  if (loggedDays < MIN_LOGGED_DAYS) return base;
  if (good.length < MIN_COHORT_DAYS || bad.length < MIN_COHORT_DAYS) return base;

  const countIn = (cohort: Set<string>[], food: string): number =>
    cohort.reduce((n, s) => n + (s.has(food) ? 1 : 0), 0);

  const foods = new Set<string>();
  for (const d of byDay.values()) for (const f of d.foods) foods.add(f);

  const scored: MealRec[] = [];
  for (const food of foods) {
    const inGood = countIn(good, food);
    const inBad = countIn(bad, food);
    const appearances = inGood + inBad;
    if (appearances < MIN_APPEARANCES) continue;
    const goodRate = inGood / good.length;
    const lift = goodRate - inBad / bad.length;
    if (lift < MIN_LIFT) continue;
    scored.push({ food, goodDayRate: goodRate, lift, appearances });
  }

  // Strongest contrast first; break ties toward the food she has actually eaten more, which is the
  // one she is likelier to eat again.
  scored.sort((a, b) => b.lift - a.lift || b.appearances - a.appearances);
  return { ...base, recs: scored.slice(0, 3) };
}
