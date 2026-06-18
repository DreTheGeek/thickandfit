// Progressive overload: DETERMINISTIC double-progression from the last sessions + difficulty.
// (An AI layer explains the number in Stephanie's voice; it never invents the number.)
export type SetResult = {
  weight: number | null;
  reps: number | null;
  completed: boolean;
  difficulty: 'easy' | 'moderate' | 'hard' | 'failed';
};
export type RepRange = { min: number; max: number };
export type Recommendation = {
  weight: number | null;
  reps: number;
  action: 'increase_reps' | 'increase_weight' | 'hold' | 'deload';
  rationale: string;
};

// history is oldest -> newest; only the last 4 are considered.
export function recommendNext(history: SetResult[], range: RepRange, weightStep = 2.5): Recommendation {
  const recent = history.slice(-4);
  const last = recent[recent.length - 1];

  if (!last) {
    return { weight: null, reps: range.min, action: 'hold', rationale: 'No history yet. Start at the bottom of the range and build.' };
  }

  const w = last.weight ?? 0;
  const reps = last.reps ?? range.min;

  if (last.difficulty === 'failed' || !last.completed) {
    return {
      weight: w ? Math.max(0, Math.round((w - weightStep) * 100) / 100) : null,
      reps: range.min,
      action: 'deload',
      rationale: 'Last session was missed. Deload and rebuild momentum.',
    };
  }

  const lastTwo = recent.slice(-2);
  const twoHardInARow = lastTwo.length === 2 && lastTwo.every((s) => s.difficulty === 'hard' || s.difficulty === 'failed');
  if (twoHardInARow) {
    return { weight: w || null, reps, action: 'hold', rationale: 'Two hard sessions in a row. Hold here and consolidate before adding load.' };
  }

  if (last.difficulty === 'easy' || last.difficulty === 'moderate') {
    if (reps < range.max) {
      return { weight: w || null, reps: reps + 1, action: 'increase_reps', rationale: `Add a rep toward the top of your ${range.min}-${range.max} range.` };
    }
    return {
      weight: Math.round(((w || 0) + weightStep) * 100) / 100,
      reps: range.min,
      action: 'increase_weight',
      rationale: `Top of the range hit. Add ${weightStep} and reset to ${range.min} reps.`,
    };
  }

  return { weight: w || null, reps, action: 'hold', rationale: 'Completed but hard. Repeat to own it before progressing.' };
}
