// Crash recovery for a workout in progress: the pure part.
//
// WHY THIS EXISTS. The player buffers every set in memory until Finish, and until now nothing
// survived the page going away. submitLog was already careful about the NETWORK failing — it awaits
// the save, checks the response, and keeps her on screen with the sets intact if it fails — which
// protects the last thirty seconds. It did nothing about the other hour, because a gym is exactly
// where a tab dies: she switches to a song, iOS evicts the page to reclaim memory, she comes back
// to an empty screen. Back gesture, dead battery, dropped phone, accidental refresh: same result,
// no error anywhere, and she only finds out that 45 minutes did not happen.
//
// localStorage rather than the server, deliberately. The whole reason sets are buffered in the
// first place is that she may be in a basement with no signal, and a recovery mechanism that needs
// the network fails in precisely the situation it exists for.
//
// Split out of workout-player.tsx so the boundaries can be tested without a browser or React:
// .qa-visual/workout-draft-test.mts. The rules that decide whether a draft is used are the whole
// feature, and every one of them fails silently in the direction of lost or duplicated work.

export type DraftSet = {
  exercise_id: string;
  set_number: number;
  /** Null on a timed or untracked movement. A 0 would restore as "she moved nothing". */
  reps: number | null;
  weight: number | null;
  durationSec: number | null;
  completed: boolean;
  difficulty: string;
};

export type WorkoutDraft = {
  v: number;
  savedAt: number;
  sets: DraftSet[];
  idx: number;
  setNum: number;
  elapsed: number;
  /** Substitutions by exercise index. Storing the whole exercise list would carry instructions,
   *  cues and media for no reason; a swap is the only thing about the list she can change in here. */
  swaps: Record<number, { exercise_id: string; name: string }>;
};

// 2: reps/weight became nullable and durationSec arrived, so a v1 draft read by this code would
// restore a timed movement as 0 reps at 0 lb. readDraft rejects a mismatched version outright,
// which is the whole point of the field: a 12-hour-lived object needs no migration, only a refusal.
export const DRAFT_VERSION = 2;

/**
 * Past this, it is a different day's workout.
 *
 * 12 hours, not 24: a session resumed the next morning is not a resume, and silently reviving
 * yesterday's sets into today's log corrupts her history in the direction nobody checks. Erring
 * short costs an unlucky late-night lifter one recovery; erring long writes sets she did not do.
 */
export const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function draftKey(sessionId: string | null): string {
  return `tf:workout-draft:${sessionId ?? 'adhoc'}`;
}

/** Minimal shape of the storage this needs, so a test can supply one. */
export type DraftStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function store(): DraftStore | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    // Accessing localStorage THROWS in some privacy modes rather than returning null.
    return null;
  }
}

/**
 * The draft for this session, or null if there is nothing usable.
 *
 * Every rejection below is a case where restoring would be worse than not restoring. A corrupt or
 * unreadable draft must never block the workout either: losing the recovery is bad, refusing to let
 * her train because of it is worse.
 */
export function readDraft(sessionId: string | null, now = Date.now(), s: DraftStore | null = store()): WorkoutDraft | null {
  if (!s) return null;
  try {
    const raw = s.getItem(draftKey(sessionId));
    if (!raw) return null;
    const d = JSON.parse(raw) as WorkoutDraft;
    // A version bump means the shape changed. Reading an old one with new code is how a restore
    // puts garbage into a log; there is no migration worth writing for a 12-hour-lived object.
    if (d?.v !== DRAFT_VERSION) return null;
    if (!Array.isArray(d.sets) || d.sets.length === 0) return null;
    if (typeof d.savedAt !== 'number' || now - d.savedAt > DRAFT_MAX_AGE_MS) return null;
    // A clock that jumped backwards (timezone change on a flight, NTP correction) must not make a
    // draft look like it is from the future and live forever.
    if (d.savedAt > now + 60_000) return null;
    return {
      v: d.v,
      savedAt: d.savedAt,
      sets: d.sets,
      idx: Number.isInteger(d.idx) && d.idx >= 0 ? d.idx : 0,
      setNum: Number.isInteger(d.setNum) && d.setNum >= 1 ? d.setNum : 1,
      elapsed: Number.isFinite(d.elapsed) && d.elapsed >= 0 ? d.elapsed : 0,
      swaps: d.swaps && typeof d.swaps === 'object' ? d.swaps : {},
    };
  } catch {
    return null;
  }
}

export function writeDraft(sessionId: string | null, draft: WorkoutDraft, s: DraftStore | null = store()): void {
  if (!s) return;
  try {
    s.setItem(draftKey(sessionId), JSON.stringify(draft));
  } catch {
    // Quota, private mode, storage disabled. The workout continues exactly as it did before this
    // existed; she simply has no safety net, which is not worth an error for.
  }
}

export function clearDraft(sessionId: string | null, s: DraftStore | null = store()): void {
  if (!s) return;
  try {
    s.removeItem(draftKey(sessionId));
  } catch {
    // Nothing to do and nothing worth breaking over.
  }
}
