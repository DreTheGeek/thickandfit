// Client-safe body-progress types + the measurement field list. Kept separate from stats.ts (which
// is server-only) so client components can import the shapes without pulling server code into the
// browser bundle.

export type WeightPoint = { on: string; lb: number };

export type MeasureField = 'waist' | 'hips' | 'chest' | 'arms' | 'thighs' | 'bodyFat';
export const MEASURE_FIELDS: MeasureField[] = ['waist', 'hips', 'chest', 'arms', 'thighs', 'bodyFat'];

// latest/first are cm for circumferences and % for bodyFat; the client renders the right unit.
export type MeasureStat = {
  field: MeasureField;
  latest: number | null;
  first: number | null;
  delta: number | null;
  recordedOn: string | null;
};

export type WeekRollup = {
  startOn: string;
  endOn: string;
  workouts: number;
  daysLogged: number;
  weightDeltaLb: number | null;
};

export type BodyStats = {
  weightSeries: WeightPoint[];
  goalLb: number | null;
  startLb: number | null;
  currentLb: number | null;
  measurements: MeasureStat[];
  rollups: WeekRollup[];
};
