// Workout crash recovery: the rules that decide whether a saved session is used.
//
// Every one of these fails silently, and in one of two directions. Reject a good draft and she
// loses the hour the feature exists to protect. Accept a bad one and sets she did not do are
// written into her history and sent to her coach — worse, because nobody goes looking for work
// that appeared.
//
// Run: npx tsx .qa-visual/workout-draft-test.mts
import {
  readDraft,
  writeDraft,
  clearDraft,
  draftKey,
  DRAFT_VERSION,
  DRAFT_MAX_AGE_MS,
  type DraftStore,
  type WorkoutDraft,
} from '../src/lib/workout/draft';

let pass = 0;
const failures: string[] = [];

function check(name: string, got: unknown, want: unknown): void {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) pass += 1;
  else failures.push(`${name}\n    expected ${w}\n    got      ${g}`);
}

function ok(name: string, cond: boolean): void {
  if (cond) pass += 1;
  else failures.push(name);
}

function memStore(seed: Record<string, string> = {}): DraftStore & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k]! : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    removeItem: (k: string) => {
      delete data[k];
    },
  };
}

const NOW = 1_786_000_000_000;
const SESSION = 'sess-123';

function goodDraft(over: Partial<WorkoutDraft> = {}): WorkoutDraft {
  return {
    v: DRAFT_VERSION,
    savedAt: NOW - 60_000,
    sets: [
      { exercise_id: 'ex-1', set_number: 1, reps: 10, weight: 45, completed: true, difficulty: 'moderate' },
      { exercise_id: 'ex-1', set_number: 2, reps: 9, weight: 45, completed: true, difficulty: 'hard' },
    ],
    idx: 0,
    setNum: 3,
    elapsed: 420,
    swaps: {},
    ...over,
  };
}

const put = (d: unknown): DraftStore => memStore({ [draftKey(SESSION)]: JSON.stringify(d) });

// --- the happy path ------------------------------------------------------------
const restored = readDraft(SESSION, NOW, put(goodDraft()));
ok('a fresh draft is restored', restored !== null);
check('with every set', restored?.sets.length, 2);
check('at the exercise she was on', restored?.idx, 0);
check('at the set she was on', restored?.setNum, 3);
check('with the clock', restored?.elapsed, 420);

// --- what must be rejected -------------------------------------------------------
check('nothing stored', readDraft(SESSION, NOW, memStore()), null);
check('a draft for a different session', readDraft('other', NOW, put(goodDraft())), null);
// A version bump means the shape changed; there is no migration worth writing for an object that
// lives twelve hours, and reading an old one with new code puts garbage into her log.
check('an older version', readDraft(SESSION, NOW, put(goodDraft({ v: 0 }))), null);
check('a newer version', readDraft(SESSION, NOW, put(goodDraft({ v: 99 }))), null);
// An empty draft is not a workout. Restoring one would show the banner and offer to recover nothing.
check('no sets', readDraft(SESSION, NOW, put(goodDraft({ sets: [] }))), null);
check('sets is not an array', readDraft(SESSION, NOW, put(goodDraft({ sets: 'nope' as never }))), null);
check('corrupt JSON does not throw', readDraft(SESSION, NOW, memStore({ [draftKey(SESSION)]: '{not json' })), null);
check('missing savedAt', readDraft(SESSION, NOW, put(goodDraft({ savedAt: undefined as never }))), null);

// --- the age boundary, which is the one that writes false history ------------------
const aged = (ms: number): WorkoutDraft => goodDraft({ savedAt: NOW - ms });
ok('an hour old is fine', readDraft(SESSION, NOW, put(aged(3_600_000))) !== null);
ok('just inside twelve hours is fine', readDraft(SESSION, NOW, put(aged(DRAFT_MAX_AGE_MS - 1000))) !== null);
check('exactly twelve hours is still fine', readDraft(SESSION, NOW, put(aged(DRAFT_MAX_AGE_MS)))?.sets.length, 2);
// One second past, and it is a different day's workout. Reviving yesterday's sets into today's log
// is the failure nobody checks for, because the number only ever goes up.
check('a second past twelve hours is gone', readDraft(SESSION, NOW, put(aged(DRAFT_MAX_AGE_MS + 1000))), null);
check('yesterday is gone', readDraft(SESSION, NOW, put(aged(24 * 60 * 60 * 1000))), null);

// A clock that jumps backwards — a flight, an NTP correction — must not mint an immortal draft.
check('a draft from the future is rejected', readDraft(SESSION, NOW, put(goodDraft({ savedAt: NOW + 3_600_000 }))), null);
// ...but small skew is normal and must not throw away a real session.
ok('30 seconds of skew is tolerated', readDraft(SESSION, NOW, put(goodDraft({ savedAt: NOW + 30_000 }))) !== null);

// --- position is repaired, not trusted ---------------------------------------------
// Restoring eight sets while the screen says "exercise 1, set 1" would make her redo work she has
// already logged, and log it twice. Nonsense positions fall back rather than propagate.
check('a negative index falls back to the first exercise', readDraft(SESSION, NOW, put(goodDraft({ idx: -3 })))?.idx, 0);
check('a fractional index falls back', readDraft(SESSION, NOW, put(goodDraft({ idx: 1.5 })))?.idx, 0);
check('set 0 falls back to set 1', readDraft(SESSION, NOW, put(goodDraft({ setNum: 0 })))?.setNum, 1);
check('a negative clock falls back to 0', readDraft(SESSION, NOW, put(goodDraft({ elapsed: -5 })))?.elapsed, 0);
check('missing swaps becomes an empty map', readDraft(SESSION, NOW, put(goodDraft({ swaps: null as never })))?.swaps, {});

// --- substitutions survive ------------------------------------------------------------
// Without this a recovery puts her back on the machine that was broken or taken.
const swapped = readDraft(SESSION, NOW, put(goodDraft({ swaps: { 2: { exercise_id: 'ex-9', name: 'Goblet Squat' } } })));
check('a swap is carried', swapped?.swaps[2]?.exercise_id, 'ex-9');
check('with its name, for the UI', swapped?.swaps[2]?.name, 'Goblet Squat');

// --- write / clear round trip ------------------------------------------------------
const s1 = memStore();
writeDraft(SESSION, goodDraft(), s1);
ok('a written draft reads back', readDraft(SESSION, NOW, s1) !== null);
clearDraft(SESSION, s1);
check('a cleared draft is gone', readDraft(SESSION, NOW, s1), null);
// Cleared on a SUCCESSFUL save specifically: leaving it would offer to restore a workout already on
// the server, and accepting that offer logs it twice.
check('clearing removes the key itself', draftKey(SESSION) in s1.data, false);

// --- storage that is unavailable or hostile -------------------------------------------
// Private mode throws on access rather than returning null. Losing the safety net is acceptable;
// refusing to let her train because of it is not.
const hostile: DraftStore = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};
check('a throwing read returns null', readDraft(SESSION, NOW, hostile), null);
let threw = false;
try {
  writeDraft(SESSION, goodDraft(), hostile);
  clearDraft(SESSION, hostile);
} catch {
  threw = true;
}
check('a throwing write is swallowed', threw, false);
check('a null store returns null', readDraft(SESSION, NOW, null), null);

// --- keying ---------------------------------------------------------------------------
ok('the key is namespaced', draftKey(SESSION).startsWith('tf:workout-draft:'));
ok('two sessions do not collide', draftKey('a') !== draftKey('b'));
// A session with no id still gets protection; the 12-hour expiry is what stops yesterday's ad-hoc
// workout from colliding with today's.
ok('a null session id still has a key', draftKey(null).length > 0);

// --- report -----------------------------------------------------------------------------
if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`\n${pass} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`✓ ${pass} assertions passed`);
