import 'server-only';
// The line a member screenshots.
//
// The scan returns macros; it does not return coaching. K7 projects goal dates and 30-day pace, but
// nothing answered the intra-day question at the moment it actually lands: "I just logged dinner,
// where am I against today, and what is the one move left?"
//
// DETERMINISTIC, ZERO MODEL CALLS. Two reasons, both load-bearing:
//   1. Latency. This runs inside the confirm action. A model call would put seconds between tapping
//      Log and seeing the meal appear, on the most-repeated interaction in the product.
//   2. Trust. A confident wrong line at log time costs more than saying nothing, which is the same
//      principle K8's meal recommendations already follow: silence beats a weak suggestion.
//
// Voice polish seam: pipe CoachMoment through AI_MODELS.chat with Stephanie's RAG voice
// (coach-ai/chat.ts pattern) in a later PRD. Deterministic templates stay the fallback.
import { createServiceClient } from '@/lib/supabase/service';
import { localDay } from '@/lib/datetime/local-day';

export type CoachMomentKind = 'protein_push' | 'protein_hit' | 'kcal_watch' | 'on_track' | 'none';

export type CoachMoment = {
  kind: CoachMomentKind;
  proteinG: number;
  targetProteinG: number | null;
  remainingProteinG: number | null;
  kcal: number;
  targetKcal: number | null;
  remainingKcal: number | null;
  mealSlot: string;
  /** One of HER habitual foods, never a generic suggestion. Null when we do not know any. */
  foodHint: string | null;
};

/** Nothing to say. Rendered as no card at all, not as an empty one. */
const NONE: CoachMoment = {
  kind: 'none',
  proteinG: 0,
  targetProteinG: null,
  remainingProteinG: null,
  kcal: 0,
  targetKcal: null,
  remainingKcal: null,
  mealSlot: '',
  foodHint: null,
};

/** Over target by more than this fraction before we mention calories at all. */
const KCAL_WATCH_MARGIN = 0.1;
/** The slots where "the day is nearly spent" is true, so a protein gap is worth naming. */
const LATE_SLOTS = new Set(['dinner', 'snack']);

/**
 * Build the moment for a member who just logged something.
 *
 * Call AFTER the insert: today's totals must already include this meal, or the number shown is the
 * one from before they logged, which is worse than showing nothing.
 *
 * Never throws. A coaching line must never fail a log.
 */
export async function buildCoachMoment(
  profileId: string,
  companyId: string | null,
  mealSlot: string,
): Promise<CoachMoment> {
  if (!companyId) return NONE;
  try {
    const svc = createServiceClient();

    const { data: stateRow } = await svc
      .from('user_state')
      .select('target_protein_g, target_kcal, favorite_foods')
      .eq('profile_id', profileId)
      .eq('company_id', companyId)
      .maybeSingle();
    const state = stateRow as {
      target_protein_g: number | null;
      target_kcal: number | null;
      favorite_foods: unknown;
    } | null;

    // A fresh member has no K3 snapshot yet. Say nothing rather than invent a target.
    const targetProteinG = numOrNull(state?.target_protein_g);
    const targetKcal = numOrNull(state?.target_kcal);
    if (targetProteinG === null && targetKcal === null) return NONE;

    // Their LOCAL day. An evening logger in New York must not be measured against a UTC tomorrow.
    const { data: tzRow } = await svc
      .from('profiles')
      .select('timezone')
      .eq('id', profileId)
      .maybeSingle();
    const today = localDay((tzRow as { timezone: string | null } | null)?.timezone);

    const { data: logRows } = await svc
      .from('food_log')
      .select('kcal, protein_g')
      .eq('profile_id', profileId)
      .eq('log_date', today);
    const rows = (logRows ?? []) as { kcal: number | null; protein_g: number | null }[];

    const proteinG = Math.round(rows.reduce((s, r) => s + Number(r.protein_g ?? 0), 0));
    const kcal = Math.round(rows.reduce((s, r) => s + Number(r.kcal ?? 0), 0));

    const remainingProteinG = targetProteinG === null ? null : Math.max(0, Math.round(targetProteinG - proteinG));
    const remainingKcal = targetKcal === null ? null : Math.round(targetKcal - kcal);

    const base: CoachMoment = {
      kind: 'on_track',
      proteinG,
      targetProteinG,
      remainingProteinG,
      kcal,
      targetKcal,
      remainingKcal,
      mealSlot,
      foodHint: null,
    };

    // Decision ladder, most-worth-saying first.

    // Protein met. The protein_goal_hit domain_event already fires elsewhere; do NOT emit a
    // duplicate here. This only decides what the card says.
    if (targetProteinG !== null && proteinG >= targetProteinG) return { ...base, kind: 'protein_hit' };

    // A protein gap is only actionable while there is still a meal left in the day, so it is named
    // at dinner or snack. Raising it at breakfast would be nagging about a day barely started.
    if (targetProteinG !== null && remainingProteinG !== null && remainingProteinG > 0 && LATE_SLOTS.has(mealSlot)) {
      return { ...base, kind: 'protein_push', foodHint: pickFoodHint(state?.favorite_foods) };
    }

    // Calories meaningfully over. States the fact; the copy carries no shame language (brand voice).
    if (targetKcal !== null && kcal > targetKcal * (1 + KCAL_WATCH_MARGIN)) {
      return { ...base, kind: 'kcal_watch' };
    }

    return base;
  } catch (e) {
    console.error('buildCoachMoment:', e instanceof Error ? e.message : e);
    return NONE;
  }
}

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * One of the member's own habitual foods.
 *
 * Never a generic suggestion: telling someone who does not eat chicken to add chicken is how a
 * coaching line reveals that it does not know them. Null is a perfectly good answer, and the copy
 * has a variant without a food.
 */
function pickFoodHint(favoriteFoods: unknown): string | null {
  if (!Array.isArray(favoriteFoods)) return null;
  for (const entry of favoriteFoods) {
    if (typeof entry === 'string' && entry.trim()) return entry.trim();
    // Tolerate [{name, count}] as well as ['chicken'], since the K3 snapshot's shape is its own.
    if (entry && typeof entry === 'object') {
      const name = (entry as { name?: unknown; food?: unknown }).name ?? (entry as { food?: unknown }).food;
      if (typeof name === 'string' && name.trim()) return name.trim();
    }
  }
  return null;
}
