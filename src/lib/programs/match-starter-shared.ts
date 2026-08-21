/**
 * SHARED, and free of `server-only` on purpose, so the rules below can be tested without a Next
 * runtime. Same split as risk-shared.ts / status-shared.ts / season-shared.ts: the reasoning lives
 * here, the database reads live in match-starter.ts beside it.
 *
 * Which of Stephanie's programs a new member should start on, from what she told us.
 *
 * WHAT THIS REPLACES. A single hardcoded uuid in STARTER_PROGRAM_ID, handed to every new member
 * regardless of her answers. The owner's words: "so we dont even ask a question of how many days
 * they want to work out or anything. that shoud dictate what plan they get." Correct on both
 * counts. Onboarding did not ask, and the answers it DID collect were never read.
 *
 * Her library is organised on three axes and she named it that way herself, so this is reading her
 * taxonomy rather than inventing one. The axes are columns on `plans` (migration 0148), not a regex
 * over titles: a matcher that parses "3 day" out of a name stops matching the day she renames a
 * plan, and that failure looks exactly like the bug this exists to fix.
 *
 * ------------------------------------------------------------------ the three rules
 *
 * 1. LOCATION IS A HARD CONSTRAINT. Everything else is a preference. A gym program handed to
 *    someone training in her bedroom is not a compromise, it is a cancellation: she opens day one,
 *    finds a barbell back squat and a cable row, and concludes the app is not for her. Stephanie has
 *    exactly ONE home program today, so a home member gets that one even when the days are wrong.
 *    Wrong days on a plan she can do beats right days on a plan she cannot.
 *
 * 2. NEVER MATCH UP ON LEVEL. An experienced member handed a Beginner/Intermediate block is mildly
 *    bored and says so in the chat. A beginner handed ADVANCED gets hurt. So `experienced` may drop
 *    to beginner_intermediate when no advanced plan fits, and `new` may never rise.
 *
 * 3. DAYS IS NEAREST-WINS, ROUNDING DOWN ON A TIE, AND IT OUTRANKS LEVEL. Asked for 4 with only 3
 *    and 5 available, she gets 3. Somebody who cannot make the sessions has a plan she is failing
 *    every week; somebody with a spare day has a plan and a spare day.
 *
 *    Days beating level is the non-obvious half, and it is the one that decides the common case: an
 *    experienced member who can train 3 days can have the 3-day Beginner/Intermediate block or the
 *    4-day ADVANCED one. Being a level too easy is fixable in one message ("this feels light") and
 *    a coach bumps her. Being a day too many is not fixable, because the constraint is her life:
 *    work, kids, the hours she actually has. So she gets the 3-day block, flagged as a compromise.
 *
 * ---------------------------------------------------------------- what it does NOT do
 *
 * It does not consider her goal (lose / gain / recomp). Every one of these seven programs is a
 * full-body hypertrophy block and the goal is expressed through nutrition, not through which
 * training plan she is on. Adding goal here would be inventing a distinction Stephanie's library
 * does not make.
 *
 * It returns null rather than guessing when nothing is marked as a starter candidate. Null means
 * the member lands in /coach/awaiting and a human writes her plan, which is the promise the app
 * makes anyway. A wrong program is worse than no program.
 */

export type MemberTrainingAnswers = {
  /** 'home' | 'gym' | 'both', from onboarding. Null when she never answered. */
  location: string | null;
  /** 'new' | 'some' | 'experienced'. Null when she never answered. */
  experience: string | null;
  /** How many days a week she said she can train. Null when she never answered. */
  daysPerWeek: number | null;
};

export type StarterCandidate = {
  id: string;
  name_en: string;
  days_per_week: number | null;
  level: string | null;
  location: string | null;
};

export type StarterMatch = {
  plan: StarterCandidate;
  /** Why this one, in a line a coach can read on the client record. */
  reason: string;
  /** True when we had to compromise, so the coach knows to look. */
  compromised: boolean;
};

/** Her stated experience, mapped onto the two levels Stephanie's library actually has. */
function wantedLevel(experience: string | null): 'beginner_intermediate' | 'advanced' {
  // Rule 2: only 'experienced' reaches for advanced. Unanswered floors to the safe one.
  return experience === 'experienced' ? 'advanced' : 'beginner_intermediate';
}

/**
 * Which plan locations this member can actually train at.
 *
 * 'both' prefers gym, because the gym library is where six of the seven programs are and she has
 * said she has access. 'home' accepts ONLY home. That asymmetry is rule 1.
 */
function acceptableLocations(location: string | null): string[] {
  if (location === 'home') return ['home'];
  if (location === 'gym' || location === 'both') return ['gym', 'home'];
  // Unanswered: treat as home-only. It is the conservative read - a plan needing no equipment
  // always works, and a plan needing a gym she does not have does not.
  return ['home'];
}

/**
 * The weights, named because their ORDER is the policy and a silent tweak would change what a
 * member is given. DAY_GAP > LEVEL_DROP is rule 3: one day of mismatch hurts more than one level.
 * Both are far below the location penalty, which is rule 1 and effectively absolute.
 */
const LOCATION_PENALTY = 1000;
const DAY_GAP = 40;
const OVER_PENALTY = 10;
const LEVEL_DROP = 25;
// Cheaper than dropping a level, because "she did not label it" is weaker evidence of a mismatch
// than "she labelled it as the other thing". Still non-zero, so a plan that states her level wins.
const LEVEL_UNKNOWN = 12;

export function chooseStarterPlan(
  candidates: StarterCandidate[],
  answers: MemberTrainingAnswers,
): StarterMatch | null {
  const allowed = acceptableLocations(answers.location);
  const pool = candidates.filter((p) => p.location != null && allowed.includes(p.location));
  if (pool.length === 0) return null;

  const level = wantedLevel(answers.experience);
  const days = answers.daysPerWeek;

  const score = (p: StarterCandidate): number => {
    let s = 0;
    // Location: the first acceptable entry is the preferred one, so index is the penalty.
    s += allowed.indexOf(p.location ?? '') * LOCATION_PENALTY;
    // Level: an exact match is free. Falling DOWN from advanced costs less than a single day of
    // mismatch, which is rule 3's second half. Rising is banned outright rather than made expensive,
    // because "expensive" still gets chosen when nothing else fits, and nothing else fitting is
    // exactly when a beginner would be handed an ADVANCED block.
    //
    // AN UNLABELLED PLAN SUITS ANYONE, and getting this wrong made a whole feature inert. Her eight
    // @HOME programs carry no level in their names: the gym siblings say BEGINNER or ADVANCED, the
    // home ones say nothing. Under the old test `null !== 'beginner_intermediate'` fell straight to
    // the ban, so unarchiving them and tagging days and location would have changed NOTHING and
    // every at-home member would have stayed on the one plan this was written to stop.
    //
    // Guessing a level off a name that does not state one is the alternative, and it is worse: it
    // is how an ADVANCED block reaches a beginner. Costing slightly more than an exact match is the
    // honest reading. It means "she did not say", not "it does not fit".
    if (p.level !== level) {
      if (p.level == null) s += LEVEL_UNKNOWN;
      else if (level === 'advanced' && p.level === 'beginner_intermediate') s += LEVEL_DROP;
      else return Number.POSITIVE_INFINITY;
    }
    // Days: distance, with a thumb on the scale against going OVER what she said she can manage.
    if (days != null && p.days_per_week != null) {
      const diff = p.days_per_week - days;
      s += Math.abs(diff) * DAY_GAP + (diff > 0 ? OVER_PENALTY : 0);
    }
    return s;
  };

  let best: StarterCandidate | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const p of pool) {
    const s = score(p);
    if (s < bestScore) {
      bestScore = s;
      best = p;
    }
  }
  // Every candidate was banned on level. Only possible for an 'experienced' member, since
  // beginner_intermediate is never banned, so this cannot strand a beginner.
  if (!best) return null;

  const daysOff = days != null && best.days_per_week != null && best.days_per_week !== days;
  const levelOff = best.level !== level;
  const compromised = daysOff || levelOff;

  const bits: string[] = [];
  if (best.days_per_week != null) bits.push(`${best.days_per_week} days`);
  if (best.location) bits.push(best.location === 'home' ? 'no gym needed' : 'gym');
  if (best.level === 'advanced') bits.push('advanced');

  let reason = `Matched on ${bits.join(', ')}.`;
  if (daysOff) reason += ` She asked for ${days} days a week and this is the closest program.`;
  if (levelOff) reason += ' No advanced program fits those days, so she is on the Beginner/Intermediate block.';

  return { plan: best, reason, compromised };
}

