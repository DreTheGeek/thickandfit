// Where a movement belongs, in Stephanie's words.
//
// THE VOCABULARY IS HERS, taken from the session names in her own 4,182 completed sessions rather
// than from a training textbook. Ranked by how often she actually programmed them:
//
//   Back & biceps 548 · Hamstrings & Glutes 347 · Full upperbody 319 · Shoulders, chest & triceps
//   308 · Quads & Glutes 274 · Fully body HIIT 269 · Legs-Glute focused 268 · Legs 258 · Legs (Quad
//   focused) 236 · Post workout stretch 231 · Cardio & core 133 · Glutes & hammies 45
//
// WHY NAME MATCHING RATHER THAN muscle_group: her export carried no taxonomy, so muscle_group is
// null on 360 of her 367 rows. Her naming, on the other hand, is unusually literal ("Banded fire
// hydrants", "Cable Pull Through-hamstrings"), which makes keyword rules honest here in a way that
// guessing a muscle group per row would not be. Anything the rules cannot place stays null and is
// shown in an "Unsorted" group rather than filed somewhere plausible: a movement under the wrong
// heading is worse than one she has to eyeball.
//
// One classifier, two callers: the library she programmes from and the shot list she films from.
// Two copies would drift, and then the list would disagree with the app about where a movement is.

export const BLOCKS = [
  'hams_glutes',
  'shoulders_chest_triceps',
  'back_biceps',
  'quads_legs',
  'core',
  'hiit_cardio',
  'stretch_mobility',
] as const;

export type Block = (typeof BLOCKS)[number];

/**
 * Display order: each block's share of her real sessions, so the top of the page is the work her
 * clients actually do and stopping early still covers most of it.
 */
export const BLOCK_ORDER: readonly Block[] = BLOCKS;

// `~` expands to "optional space or hyphen". Her naming is inconsistent about both ("Warm-up" vs
// "warm up", "Wallsit" vs "wall sit"), and a first pass using a plain optional space left 42
// movements unsorted, most of them only because of a hyphen. Spelling is hers too: "Hallow hold" is
// matched deliberately rather than corrected, because the rule has to match the row in the database.
const S = '[ -]?';
const rx = (src: string): RegExp => new RegExp(src.split('~').join(S), 'i');

// FIRST MATCH WINS, so the more specific pattern is listed first: "hip thrust" has to beat the bare
// "thrust" inside "thrusters".
const RULES: readonly (readonly [Block, RegExp])[] = [
  [
    'hams_glutes',
    rx('glute|hip~thrust|bridge|donkey|fire~hydrant|kick~back|rdl|romanian|deadlift|good~morning|hyperextension|pull~through|abduct|clamshell|frog|curtsy|sumo|hip~rotation|lateral~step|step~out|hip~circle'),
  ],
  [
    'shoulders_chest_triceps',
    rx('shoulder|delt|press|push~up|chest|fly|flys|flies|tricep|dip|skull|overhead|lateral~raise|front~raise|arnold|upright~row|around~the~world|snatch'),
  ],
  [
    'back_biceps',
    rx('row|pull~down|pull~up|pull~apart|chin~up|lat~pull|lats|bicep|curl|face~pull|shrug|superman|reverse~fly|dead~hang'),
  ],
  [
    'quads_legs',
    rx('squat|lunge|step~up|leg~press|leg~extension|leg~curl|calf|hack|wall~sit|wallsit|adduct|quad|hamstring|thruster|step~board'),
  ],
  [
    'core',
    rx('crunch|plank|abs|core|oblique|russian|sit~up|v~up|heel~tap|toe~touch|leg~raise|leg~lift|dead~bug|bird~dog|mountain~climber|windshield|hollow|hallow|woodchop|pallof|scissor|knee~tuck|march'),
  ],
  [
    'hiit_cardio',
    rx('jump|hop|slam|burpee|sprint|run|bike|treadmill|stair|erg|battle|sled|carry|farmer|skater|jack|high~knee|quick~feet|ski|walk|incline'),
  ],
  [
    'stretch_mobility',
    rx('stretch|mobility|warm~up|circle|dislocate|cat~cow|thoracic|opener|foam|roll|activation|swing'),
  ],
];

/** A real muscle_group beats the name rules, on the 7 of her rows that carry one. */
const BY_MUSCLE: Record<string, Block> = {
  glutes: 'hams_glutes',
  hamstrings: 'hams_glutes',
  quadriceps: 'quads_legs',
  calves: 'quads_legs',
  abductors: 'quads_legs',
  adductors: 'quads_legs',
  lats: 'back_biceps',
  'middle back': 'back_biceps',
  'lower back': 'back_biceps',
  biceps: 'back_biceps',
  traps: 'back_biceps',
  shoulders: 'shoulders_chest_triceps',
  chest: 'shoulders_chest_triceps',
  triceps: 'shoulders_chest_triceps',
  abdominals: 'core',
};

/** Null when no rule matches, which the UI shows as "Unsorted" rather than hiding. */
export function blockFor(name: string, muscleGroup?: string | null): Block | null {
  if (muscleGroup) {
    const hit = BY_MUSCLE[muscleGroup.toLowerCase()];
    if (hit) return hit;
  }
  for (const [block, re] of RULES) if (re.test(name)) return block;
  return null;
}
