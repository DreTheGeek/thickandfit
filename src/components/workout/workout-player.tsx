'use client';
// Workout player, re-skinned to the design-handoff exercise screen: video hero,
// Instructions/Muscles tabs, reps/weight steppers, set-progress dots, audible rest
// timer + Wake Lock (Phase 1 differentiators), inline substitution, and Log Set ->
// confetti -> persist (PRD-12). The exact things competitors got wrong.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Icon } from '@/components/ui/icons';
import { UnderlineTabs } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Confetti, useConfetti } from '@/components/ui/confetti';
import { MuscleMap } from '@/components/workout/muscle-map';
import {
  newClientSessionId,
  readDraft,
  writeDraft,
  clearDraft,
  DRAFT_VERSION,
  type WorkoutDraft,
  type DraftSet,
} from '@/lib/workout/draft';
import { normalizeRestSeconds } from '@/lib/workout/rest';
import { PortalButton } from '@/components/portal/portal-chrome';
import { epley1rm, beatsBest } from '@/lib/workout/epley';
import { exerciseKind, isWeighted, formatDuration, type ExerciseKind } from '@/lib/workout/exercise-kind';

export type OverloadHint = {
  action: 'increase_reps' | 'increase_weight' | 'hold' | 'deload';
  weight: number | null;
  reps: number;
  rationale: string;
  historyPoints: number;
  lastWeight: number | null;
  lastReps: number | null;
};

type Difficulty = 'easy' | 'moderate' | 'hard' | 'failed';
const DIFFICULTIES: Difficulty[] = ['easy', 'moderate', 'hard', 'failed'];

// Mux video player, loaded client-only (it's a web component; ssr:false avoids hydration issues).
const MuxPlayer = dynamic(() => import('@mux/mux-player-react'), { ssr: false });

function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export type PlayerExercise = {
  exercise_id: string;
  name: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  rest_sec: number | null;
  notes: string | null;
  cues: string | null;
  muscle: string | null;
  muscleKey: string | null;
  video_mux_id: string | null;
  /**
   * A playable URL for HER filmed demo, minted server-side (src/lib/exercises/demo-url.ts).
   *
   * 366 of her demos came across in the Lenus sweep and land in `exercises.demo_storage_path`; only
   * 2 rows have a Mux id, so reading `video_mux_id` alone showed a dumbbell icon on 1,303 of 1,305
   * movements. Her filmed demos are the reason this app exists rather than a spreadsheet, and they
   * were reaching only the coach's own exercise page.
   *
   * A signed URL rather than the path: the bucket is private and the path must not reach the DOM,
   * or the library is enumerable by anyone who reads the page source.
   */
  demoUrl: string | null;
  /**
   * Prescription detail imported from her Lenus programming. 1,531 of her 2,497 exercises sit
   * inside a superset and nothing in the app said so, which meant a member performed them as
   * straight sets with full rest: a different workout from the one she wrote.
   */
  repsMin: number | null;
  repsMax: number | null;
  isAmrap: boolean;
  groupKey: string | null;
  groupKind: string | null;
  /**
   * What she did on each set of this movement last time, for the table's Previous column.
   * Empty when this is the first time she has trained it.
   */
  previousSets: { setNumber: number; reps: number; weight: number }[];
  /**
   * Her prescribed DURATION, in seconds, for a movement she wrote as a time rather than a count.
   *
   * 270 of her 2,501 prescriptions are timed and 160 are untracked. Without this the player fell
   * back to `reps ?? 10` and `weight ?? 0`, so a 25-minute incline walk was presented, and LOGGED,
   * as ten reps at zero pounds. See lib/workout/exercise-kind.ts.
   */
  timeSec: number | null;
  /** Decides whether a load is even askable: a banded squat has resistance but no pounds. */
  equipment: string | null;
  overload: OverloadHint | null;
  // All-time bests for PR detection (Epley e1RM for weighted, max reps for bodyweight).
  bestE1rm: number | null;
  bestReps: number | null;
};
type Substitute = {
  exercise: { id: string; name_en: string; name_es: string | null; demoUrl?: string | null } | null;
  reason_tag: string | null;
};
/**
 * NULLABLE reps and weight, deliberately.
 *
 * A zero here is a claim: "she attempted this and moved nothing". A null is the truth for a
 * movement that has no rep count, and the two must not be spelled the same way in a history that
 * feeds progressive overload and the coach's console.
 */
type LoggedSet = {
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight: number | null;
  durationSec: number | null;
  completed: boolean;
  difficulty: Difficulty;
};

// One detected personal record for the completion sheet.
type PR = { exerciseId: string; name: string; weight: number; reps: number; bodyweight: boolean };

// Compare each exercise's best set THIS session against its all-time best (surfaced from the server).
// Weighted sets use Epley e1RM so more reps at the same load also counts; bodyweight uses max reps.
// No prior history -> a baseline, not a PR.
function detectPRs(exercises: PlayerExercise[], sets: LoggedSet[]): PR[] {
  const prs: PR[] = [];
  for (const ex of exercises) {
    if (ex.bestE1rm === null && ex.bestReps === null) continue;
    // Only rep-based sets can beat a rep-based record. A timed movement logs no reps and no
    // weight, and letting a null through here reads as zero and quietly loses to every record.
    const mine = sets.filter(
      (s) => s.exercise_id === ex.exercise_id && s.completed && s.reps != null,
    );
    if (!mine.length) continue;

    let sesE1rm = 0;
    let bestWeighted: LoggedSet | null = null;
    let bestReps: LoggedSet | null = null;
    for (const s of mine) {
      const reps = s.reps ?? 0;
      const weight = s.weight ?? 0;
      if (!bestReps || reps > (bestReps.reps ?? 0)) bestReps = s;
      if (weight > 0 && reps > 0) {
        const e = epley1rm(weight, reps);
        if (e > sesE1rm) {
          sesE1rm = e;
          bestWeighted = s;
        }
      }
    }

    if (ex.bestE1rm !== null && bestWeighted && beatsBest(sesE1rm, ex.bestE1rm)) {
      prs.push({ exerciseId: ex.exercise_id, name: ex.name, weight: bestWeighted.weight ?? 0, reps: bestWeighted.reps ?? 0, bodyweight: false });
    } else if (ex.bestE1rm === null && ex.bestReps !== null && bestReps && (bestReps.reps ?? 0) > ex.bestReps) {
      prs.push({ exerciseId: ex.exercise_id, name: ex.name, weight: 0, reps: bestReps.reps ?? 0, bodyweight: true });
    }
  }
  return prs;
}

function beep(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.start();
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // audio not available
  }
}

// A restored draft is JSON that was on disk for up to twelve hours; its `difficulty` is whatever
// string was written, possibly by an older build. Validate rather than cast: an unrecognised RPE
// would otherwise flow into the log and out to the coach's console as a value nothing can read.
function toLoggedSets(sets: DraftSet[]): LoggedSet[] {
  const num = (v: unknown): number | null => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  return sets.map((x) => ({
    exercise_id: String(x.exercise_id),
    set_number: Number(x.set_number),
    // null survives the round trip. Number(null) is 0, which would resurrect the exact lie this
    // whole change removes: a timed movement restored as "0 reps at 0 lb".
    reps: num(x.reps),
    weight: num(x.weight),
    durationSec: num(x.durationSec),
    completed: Boolean(x.completed),
    difficulty: DIFFICULTIES.includes(x.difficulty as Difficulty)
      ? (x.difficulty as Difficulty)
      : 'moderate',
  }));
}

export function WorkoutPlayer({
  sessionId,
  dayLabel,
  exercises: initialExercises,
  cycleNote,
}: {
  sessionId: string | null;
  programName: string;
  dayLabel: string;
  exercises: PlayerExercise[];
  /** One line of phase guidance, already localized, or null when she does not track her cycle. */
  cycleNote?: string | null;
}): ReactElement {
  const t = useTranslations('app.exercise');
  const locale = useLocale();
  const subName = (s: Substitute): string =>
    (locale === 'es' && s.exercise?.name_es) || s.exercise?.name_en || t('untitled');
  const router = useRouter();
  const { pieces, fire } = useConfetti();

  // Read ONCE, during the first render, so the initial state below is already the restored state.
  // Restoring in an effect would paint exercise 1 / set 1 first and jump, which in a gym reads as
  // the app having lost the workout — the exact fear this feature exists to remove.
  const [draft] = useState<WorkoutDraft | null>(() => readDraft(sessionId));
  const [restored, setRestored] = useState<number>(draft?.sets.length ?? 0);
  const restoredElapsed = draft?.elapsed ?? 0;

  const [exercises, setExercises] = useState<PlayerExercise[]>(() => {
    if (!draft?.swaps) return initialExercises;
    // Re-apply her substitutions, including clearing the bests, exactly as chooseSub does: a
    // substitute has no history here, and a restored session must not claim a false PR.
    return initialExercises.map((item, i) => {
      const sw = draft.swaps[i];
      return sw ? { ...item, exercise_id: sw.exercise_id, name: sw.name, bestE1rm: null, bestReps: null } : item;
    });
  });
  const [idx, setIdx] = useState(() => Math.min(draft?.idx ?? 0, Math.max(0, initialExercises.length - 1)));
  const [setNum, setSetNum] = useState(draft?.setNum ?? 1);
  const [tab, setTab] = useState<'instructions' | 'muscles'>('instructions');
  const [rest, setRest] = useState<number | null>(null);
  // What this rest STARTED at. The ring needs a denominator, and `rest` alone only says how much is
  // left. Also what a "+15s" tap has to extend.
  const [restTotal, setRestTotal] = useState(0);
  const [subsOpen, setSubsOpen] = useState(false);
  const [subs, setSubs] = useState<Substitute[] | null>(null);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [elapsed, setElapsed] = useState(draft?.elapsed ?? 0); // total workout seconds, counts up from start
  const [difficulty, setDifficulty] = useState<Difficulty>('moderate'); // this set's RPE, resets each set
  const [showComplete, setShowComplete] = useState(false); // post-workout rating sheet
  const [exitOpen, setExitOpen] = useState(false); // "save what you did?" on the way out
  const [setsCount, setSetsCount] = useState(0); // sets logged, snapshotted when the sheet opens
  const [prs, setPrs] = useState<PR[]>([]);
  // Exercise ids whose demo would not play. Keyed by id rather than a single boolean because the
  // player walks a session without remounting: one dead file must not blank the demo on every
  // movement after it. A signed URL that expired mid-session lands here and degrades to the icon.
  const [demoFailed, setDemoFailed] = useState<Set<string>>(new Set());
  const [enjoyment, setEnjoyment] = useState<number | null>(null);
  const [effort, setEffort] = useState<number | null>(null);
  const logged = useRef<LoggedSet[]>(draft ? toLoggedSets(draft.sets) : []);
  /**
   * A render-safe mirror of `logged`.
   *
   * The ref stays authoritative: submitLog and detectPRs read it, and it must survive without
   * re-rendering. But the set table needs the same data DURING render, and reading a ref there is a
   * real violation rather than a style one. React may discard and replay a render, and a ref read
   * that way can return a value from an attempt that never committed. It happens to work today
   * because logSet mutates and then immediately advances setNum; that is a coincidence of ordering,
   * not a guarantee, and it is exactly the kind of thing that breaks silently later.
   */
  const [loggedView, setLoggedView] = useState<LoggedSet[]>(draft ? toLoggedSets(draft.sets) : []);
  /**
   * The id every save of THIS session carries.
   *
   * Reused from the draft when one is being restored, so a recovered workout updates the row her
   * earlier sets already made rather than starting a second one beside it. Generated once, lazily,
   * because useState(newClientSessionId()) would mint a fresh id on every render and only keep the
   * first.
   */
  const [clientSessionId] = useState<string>(() => draft?.clientSessionId ?? newClientSessionId());
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  /**
   * ONE video element for the whole session, never remounted.
   *
   * THE BUG: "I tried to go big screen on one of my workouts on the branded fire hydrants, and then
   * it made me go back." The element carried `key={ex.exercise_id}`, so advancing a movement
   * destroyed it and built a new one, and a browser drops fullscreen the instant the element
   * holding it leaves the document. The elapsed clock re-renders this component every second, so
   * any reconciliation wobble had a second to find her.
   *
   * The src is set imperatively below instead. The element's identity is now permanent, which is
   * also what lets the demo keep playing across a rest without a flash of black.
   */
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Substitutions, by exercise index. A ref rather than state: nothing renders from it, and it has
  // to be readable from saveDraft without adding a dependency that re-creates the callback.
  const swapsRef = useRef<Record<number, { exercise_id: string; name: string }>>(draft?.swaps ?? {});

  // When this session actually started, in wall-clock terms, so saveDraft can record a duration
  // without an `elapsed` dependency that would rebuild the callback once a second for the length of
  // the workout.
  //
  // Wall clock rather than the displayed counter on purpose: that counter is a setInterval, and an
  // interval stops in a backgrounded tab. The visible number is an honest "time you have been
  // looking at this"; this one is an honest "how long the workout has been going", which is what a
  // recovered session should resume from.
  //
  // A lazy useState initializer, not useRef(Date.now()): a useRef argument is evaluated on every
  // render, so the clock would be read dozens of times with only the first value kept. The lazy
  // initializer runs exactly once, which is what "when did this session start" means.
  const [startedAt] = useState<number>(() => Date.now() - restoredElapsed * 1000);

  // Mirror the session to localStorage. Called after every logged set and every swap — the two
  // moments the session actually changes — rather than on a timer, so a crash can lose at most the
  // set she is mid-way through entering.
  const saveDraft = useCallback(
    (nextIdx: number, nextSetNum: number): void => {
      if (logged.current.length === 0) return;
      writeDraft(sessionId, {
        v: DRAFT_VERSION,
        savedAt: Date.now(),
        sets: logged.current,
        idx: nextIdx,
        setNum: nextSetNum,
        elapsed: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
        swaps: swapsRef.current,
        clientSessionId,
      } satisfies WorkoutDraft);
    },
    [sessionId, startedAt, clientSessionId],
  );

  // When this session actually started, in wall-clock terms. Set once and never reassigned, so
  // saveDraft can read the duration without taking an `elapsed` dependency that would rebuild the
  // callback once a second for the length of the workout.
  //
  // Wall clock rather than the displayed counter on purpose: that counter is a setInterval, and an
  // interval stops in a backgrounded tab. The visible number is the honest "time you have been
  // looking at this"; this one is the honest "how long the workout has been going", which is what a
  // recovered session should resume from.

  // Elapsed workout clock: tick every second until the rating sheet opens or the session finishes.
  useEffect(() => {
    if (finished || showComplete) return undefined;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [finished, showComplete]);

  const ex = exercises[idx];
  const totalSets = ex?.sets ?? 1;

  /**
   * WHAT THIS MOVEMENT IS, from the prescription she wrote. See lib/workout/exercise-kind.ts.
   *
   * Everything below branches on this instead of falling back to `reps ?? 10` and `weight ?? 0`,
   * which is how a 25-minute incline walk came to be presented, and logged, as ten reps at zero
   * pounds. 430 of her 2,501 prescribed movements are timed or untracked.
   */
  const kind: ExerciseKind = ex
    ? exerciseKind({
        reps: ex.reps,
        repsMin: ex.repsMin,
        repsMax: ex.repsMax,
        isAmrap: ex.isAmrap,
        timeSec: ex.timeSec,
      })
    : 'reps';
  // A banded squat has resistance and no pounds; a machine stack has a number she reads off the pin.
  const weighted = kind === 'reps' && isWeighted(ex?.equipment);
  const hasDemo = Boolean(ex?.demoUrl) && !demoFailed.has(ex?.exercise_id ?? '');

  /**
   * How far through the WHOLE session she is, as a percentage of prescribed sets.
   *
   * Counted in sets rather than in exercises, because exercises are not equal: a 5x5 and a single
   * set of sprints are one movement each and nothing like the same amount of work left. Sets are the
   * unit she actually performs, so a bar driven by them moves at roughly the rate the session does.
   *
   * Everything already completed, plus the sets logged inside the current movement. An exercise with
   * no prescribed count falls back to 1 so a session of untracked movements still advances rather
   * than sitting at zero to the end.
   */
  const sessionPct = (() => {
    const setsIn = (e: PlayerExercise): number => e.sets ?? 1;
    const total = exercises.reduce((a, e) => a + setsIn(e), 0);
    if (total <= 0) return 0;
    const done = exercises.slice(0, idx).reduce((a, e) => a + setsIn(e), 0) + (setNum - 1);
    return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  })();
  // Prefill from the progressive-overload recommendation when we have one, else the plan target.
  const [reps, setReps] = useState(ex?.overload?.reps ?? ex?.reps ?? 10);
  const [weight, setWeight] = useState(ex?.overload?.weight ?? ex?.weight ?? 0);
  /**
   * Seconds elapsed on a TIMED movement, and whether her clock is running.
   *
   * Counts UP from zero rather than down from the prescription. She may walk for twenty minutes of
   * a prescribed twenty-five, and a countdown that hits zero has no way to record that honestly;
   * counting up records what she did either way, and the target sits beside it as the target.
   */
  const [work, setWork] = useState(0);
  const [working, setWorking] = useState(false);

  // The work clock for a timed movement. Separate from `elapsed`, which never stops: this one is
  // hers to start and pause, and it is what gets logged.
  useEffect(() => {
    if (!working) return undefined;
    const id = setInterval(() => setWork((w) => w + 1), 1000);
    return () => clearInterval(id);
  }, [working]);


  // A closing tab with unsaved sets gets the browser's own confirm. The draft already means she
  // would not LOSE them, but "are you sure" costs nothing and stops the reload before it happens,
  // which is better than recovering from it. Deliberately not armed once the save has succeeded.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (finished || logged.current.length === 0) return;
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [finished]);

  // Wake Lock for the whole session.
  useEffect(() => {
    let released = false;
    async function acquire(): Promise<void> {
      try {
        if ('wakeLock' in navigator) {
          wakeRef.current = await navigator.wakeLock.request('screen');
        }
      } catch {
        // wake lock unavailable
      }
    }
    void acquire();
    const onVis = (): void => {
      if (document.visibilityState === 'visible' && !released) void acquire();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVis);
      wakeRef.current?.release().catch(() => {});
    };
  }, []);

  /**
   * Load and PLAY her demo whenever the movement changes.
   *
   * `muted` is what makes autoplay legal: every browser blocks sound-on autoplay, and these are
   * silent form clips, so nothing is lost. The owner's ask was "as soon as we hit next, I need
   * those videos playing" - which is only possible muted.
   *
   * `#t=0.1` seeks a tenth of a second in. Most encoders put a black frame at zero, so a paused
   * demo showed a black rectangle under the play button rather than the movement. That is the
   * "screenshot of the workout on top of the play button" - it is the real first frame, not a
   * separate poster image somebody would have to generate for 367 clips.
   */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const src = ex?.demoUrl && !demoFailed.has(ex.exercise_id) ? ex.demoUrl : null;
    if (!src) {
      v.removeAttribute('src');
      v.load();
      return;
    }
    const withFrame = src.includes('#') ? src : `${src}#t=0.1`;
    if (v.getAttribute('src') === withFrame) return;
    v.setAttribute('src', withFrame);
    v.load();
    // A rejected play() is normal (a backgrounded tab, a strict autoplay policy). The controls are
    // right there; refusing to render over it would be worse than a demo she has to tap.
    void v.play().catch(() => {});
  }, [ex?.exercise_id, ex?.demoUrl, demoFailed]);

  // Rest countdown with an audible cue at zero (setState only in the timer callback).
  useEffect(() => {
    if (rest === null || rest <= 0) return undefined;
    const timer = setTimeout(() => {
      if (rest <= 1) {
        beep();
        setRest(null);
        // The next movement is already on screen behind the overlay (logSet advanced before the
        // rest began). All that is left is to start its demo, so she looks up from the timer into a
        // playing video rather than a paused one she has to tap.
        void videoRef.current?.play().catch(() => {});
      } else {
        setRest(rest - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [rest]);

  const swap = useCallback(async (): Promise<void> => {
    setSubsOpen(true);
    setSubs(null);
    try {
      const res = await fetch(`/api/exercises/${ex.exercise_id}/substitutions?context=gym`);
      const json = await res.json();
      setSubs(json?.data?.substitutes ?? []);
    } catch {
      setSubs([]);
    }
  }, [ex]);

  const chooseSub = useCallback(
    (s: Substitute): void => {
      if (!s.exercise) return;
      const name = subName(s);
      setExercises((list) =>
        list.map((item, i) =>
          // A substitute has no history in this flow: clear the bests so we never claim a false PR.
          //
          // The VIDEO must move with the swap for the same reason. Spreading `...item` alone kept
          // the previous movement's footage under the new name, so she would have been shown a demo
          // of the exercise she just swapped away from. video_mux_id is cleared rather than carried
          // (it belongs to the old row) and demoUrl comes from the substitute the API signed.
          i === idx
            ? {
                ...item,
                exercise_id: s.exercise!.id,
                name,
                video_mux_id: null,
                demoUrl: s.exercise!.demoUrl ?? null,
                bestE1rm: null,
                bestReps: null,
              }
            : item,
        ),
      );
      // Remember it, or a recovery would put her back on the machine that was broken or taken.
      swapsRef.current = { ...swapsRef.current, [idx]: { exercise_id: s.exercise.id, name } };
      saveDraft(idx, setNum);
      setSubsOpen(false);
    },
    // subName is recreated each render; locale/t drive its output.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idx, locale, setNum, saveDraft],
  );

  /**
   * The one write. Everything above this is memory and localStorage.
   *
   * `pct` is what makes a partial save possible: 100 from the completion sheet, and however far she
   * actually got when she leaves early.
   *
   * Nulls are stripped rather than coerced. The API schema has reps and weight optional, and
   * sending `weight: null` for a banded squat would be rejected by Zod; sending 0 would be worse,
   * because it validates and then lies in the history forever.
   */
  /**
   * SAVES ARE SERIALIZED, and that is not caution, it is required.
   *
   * The endpoint replaces this session's sets on every save (delete-then-insert, keyed by
   * client_session_id). Two saves in flight at once can interleave their delete and insert and drop
   * work. She can tap Log Set twice in three seconds, so this is a real race, not a theoretical one.
   */
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));

  const send = useCallback(
    async (pct: number): Promise<boolean> => {
      const res = await fetch('/api/workouts/log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId ?? undefined,
          // Makes every save of this session land in ONE row. See migration 0151.
          client_session_id: clientSessionId,
          completion_pct: pct,
          enjoyment: enjoyment ?? undefined,
          effort: effort ?? undefined,
          sets: logged.current.map((x) => ({
            exercise_id: x.exercise_id,
            set_number: x.set_number,
            ...(x.reps == null ? {} : { reps: x.reps }),
            ...(x.weight == null ? {} : { weight: x.weight }),
            ...(x.durationSec == null ? {} : { duration_sec: x.durationSec }),
            completed: x.completed,
            difficulty: x.difficulty,
          })),
        }),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      return true;
    },
    [sessionId, enjoyment, effort, clientSessionId],
  );

  const persist = useCallback(
    async (pct: number): Promise<boolean> => {
      setSaveFailed(false);
      setSaving(true);
      const run = chain.current.catch(() => false).then(() => send(pct));
      chain.current = run.catch(() => false);
      try {
        await run;
        // Safely on the server now. Leaving the draft behind would offer to restore a workout she
        // has already logged, and accepting that offer would log it twice.
        clearDraft(sessionId);
      } catch (e) {
        console.error('workout persist:', e instanceof Error ? e.message : e);
        setSaving(false);
        setSaveFailed(true);
        return false;
      }
      setSaving(false);
      return true;
    },
    [sessionId, send],
  );

  /**
   * SAVE EVERY SET, AS SHE DOES IT.
   *
   * THE BUG THIS CLOSES, reproduced against production before it was written: log four sets, leave
   * with the phone's back gesture, and workout_logs, set_logs and workout_completion_history are all
   * still empty. api_request_log showed no POST at all, because there had never been one to make.
   *
   * Everything used to buffer in memory and localStorage and go up in ONE request, from the Finish
   * button on the rating sheet after the last set of the last exercise. That is the rarest way a
   * session actually ends. She stops early, the gym closes, the phone is evicted, she uses the back
   * gesture, which on a phone IS how you leave a screen. Every one of those lost the lot, silently,
   * and the exit sheet added earlier only covered the in-app back arrow.
   *
   * Quiet on purpose: no spinner, no error state, no draft clearing. The draft is still the safety
   * net for the gym basement with no signal, so a failed autosave changes nothing she can see and
   * the next set tries again with the whole session attached. The explicit save at the end is still
   * the one that reports success or failure to her.
   */
  const autosave = useCallback(
    (pct: number): void => {
      chain.current = chain.current
        .catch(() => false)
        .then(() => send(pct))
        .catch((e: unknown) => {
          console.error('workout autosave:', e instanceof Error ? e.message : e);
          return false;
        });
    },
    [send],
  );

  /**
   * LEAVING EARLY IS THE NORMAL CASE, and until now it recorded nothing.
   *
   * Reported exactly as it happens: "I just went back, and I hit history, and none of my workouts
   * that I did has been logged at all." workout_logs and set_logs were both empty. The sets were
   * never lost - they sat in the draft - but nothing on any screen said so, and every write was
   * gated behind reaching the last set of the last exercise and tapping through a rating sheet.
   *
   * Almost nobody finishes a twenty-movement session. She does eight, the gym closes, she leaves.
   * That is eight real sets that happened, and an app that files them under nothing is telling her
   * she did not train.
   */
  const saveAndExit = useCallback(async (): Promise<void> => {
    if (logged.current.length === 0) {
      router.push('/workouts');
      return;
    }
    const ok = await persist(sessionPct);
    if (ok) router.push('/workouts');
  }, [persist, router, sessionPct]);

  // Persist the whole session (sets carry per-set difficulty; the sheet adds enjoyment/effort),
  // fire the celebration, and head back. Called from the completion sheet, not on the last set.
  const submitLog = useCallback(async (): Promise<void> => {
    // EVERY SET OF THIS SESSION LIVES IN logged.current UNTIL THIS CALL SUCCEEDS. Buffering is the
    // right design for a gym (she may have no signal in a basement), but it makes this one request
    // the only thing standing between an hour of work and nothing.
    //
    // It used to fire the confetti first, ignore the response entirely, swallow the catch as
    // "best-effort; the celebration already played", and route away on a timer. A dropped request
    // therefore looked EXACTLY like a saved workout: celebration, redirect, and the session gone.
    // She would find out days later, from a history that has a hole in it, and have no idea which
    // day it was.
    //
    // Now the save is awaited and checked, and she only leaves this screen if it worked. A failure
    // keeps her here with her sets still in memory and a button that tries again, which is the only
    // moment they can still be rescued.
    const ok = await persist(100);
    if (!ok) return;
    // Celebrate only once it is actually hers. She earned the confetti by finishing; she has not
    // earned it while the work is still in a variable.
    setFinished(true);
    fire();
    setTimeout(() => router.push('/workouts'), 1300);
  }, [fire, router, persist]);

  // The escape hatch for a restore she did not want — a plan changed, or she is genuinely starting
  // the day again. Everything else about recovery is automatic; this is the one tap that undoes it.
  const startOver = useCallback((): void => {
    logged.current = [];
    swapsRef.current = {};
    clearDraft(sessionId);
    setRestored(0);
    setExercises(initialExercises);
    setLoggedView([]);
    setIdx(0);
    setSetNum(1);
    setElapsed(0);
  }, [sessionId, initialExercises]);

  const logSet = useCallback((): void => {
    /**
     * WHAT GETS RECORDED depends on what she was asked to do.
     *
     * A timed movement records seconds and nothing else. An untracked one records only that she did
     * it. Writing `reps: 10, weight: 0` for either is the bug this whole change removes: those rows
     * feed progressive overload, so a fabricated zero told the recommender she failed a lift she
     * was never asked to perform.
     */
    const entry: LoggedSet =
      kind === 'reps'
        ? {
            exercise_id: ex.exercise_id,
            set_number: setNum,
            reps,
            // Bodyweight and banded movements have no pounds. Null, not 0.
            weight: weighted ? weight : null,
            durationSec: null,
            completed: true,
            difficulty,
          }
        : {
            exercise_id: ex.exercise_id,
            set_number: setNum,
            reps: null,
            weight: null,
            // She may tap Done without ever starting the clock. Crediting the prescription is the
            // honest reading of that: she says she did it, and the plan says how long it was.
            durationSec: kind === 'timed' ? (work > 0 ? work : ex.timeSec) : null,
            completed: true,
            difficulty,
          };
    logged.current.push(entry);
    setLoggedView((prev) => [...prev, entry]);
    setDifficulty('moderate'); // reset the RPE tap for the next set

    // TO THE SERVER, NOW. The draft below is the offline fallback; this is the record. See autosave.
    // sessionPct is computed from the state BEFORE this set advanced the counters, so it understates
    // by one set until the next render. That is the right direction: a completion percentage should
    // never run ahead of the work.
    autosave(sessionPct);

    if (setNum < totalSets) {
      // Saved with the position she is moving TO, not the one she just left: a recovery should put
      // her at the next set, not make her redo the one she already logged.
      saveDraft(idx, setNum + 1);
      setSetNum((n) => n + 1);
      setWork(0);
      setWorking(false);
      {
        // Normalised: the column is named seconds and mostly holds milliseconds, so the raw
        // value started a five-hour countdown. See lib/workout/rest.ts.
        const r = normalizeRestSeconds(ex.rest_sec);
        if (r) {
          setRest(r);
          setRestTotal(r);
        }
      }
    } else if (idx < exercises.length - 1) {
      const next = exercises[idx + 1];
      saveDraft(idx + 1, 1);
      setIdx(idx + 1);
      setSetNum(1);
      setReps(next.overload?.reps ?? next.reps ?? 10);
      setWeight(next.overload?.weight ?? next.weight ?? 0);
      setWork(0);
      setWorking(false);
      setTab('instructions');
      {
        // Normalised: the column is named seconds and mostly holds milliseconds, so the raw
        // value started a five-hour countdown. See lib/workout/rest.ts.
        const r = normalizeRestSeconds(ex.rest_sec);
        if (r) {
          setRest(r);
          setRestTotal(r);
        }
      }
    } else {
      // Last set of the last exercise: open the rating sheet (PRs + enjoyment/effort). Don't finish yet.
      // Still saved: the sheet is where enjoyment and effort get chosen, and a tab that dies on that
      // screen would otherwise lose a COMPLETED workout, which is the worst moment to lose one.
      saveDraft(idx, setNum);
      const found = detectPRs(exercises, logged.current);
      setPrs(found);
      setSetsCount(logged.current.length);
      setShowComplete(true);
      if (found.length) fire();
    }
  }, [ex, setNum, totalSets, idx, exercises, reps, weight, difficulty, fire, saveDraft, kind, weighted, work, autosave, sessionPct]);

  // SUPERSET CONTEXT. Everything sharing a group_key is performed back to back, so the member needs
  // to know before she starts the set, not after. Without this the app rendered her supersets as
  // straight sets and a member would rest between them, which is a different training stimulus from
  // the one Stephanie wrote.
  const groupMates = ex?.groupKey
    ? exercises.filter((e) => e.groupKey === ex.groupKey)
    : [];
  const groupPos = ex?.groupKey ? groupMates.findIndex((e) => e.exercise_id === ex.exercise_id) + 1 : 0;
  const nextInGroup = groupPos > 0 && groupPos < groupMates.length ? groupMates[groupPos] : null;

  // Her prescription, in her words. A range is what she actually writes; a single number is the
  // target. AMRAP is neither, and must not be shown as a rep count.
  const targetLabel = ex?.isAmrap
    ? t('amrap')
    : ex?.repsMin != null && ex?.repsMax != null && ex.repsMax !== ex.repsMin
      ? `${ex.repsMin}-${ex.repsMax}`
      : null;

  const muscleLabel = ex?.muscle ?? null;
  const cueLines = ex?.cues
    ? ex.cues
        .split(/\r?\n|(?<=\.)\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (finished || !ex) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center px-8 text-center">
        <Confetti pieces={pieces} />
        <div className="tf-display text-[32px]">{t('sessionComplete')}</div>
        <p className="mt-2 text-[14px] text-muted">{t('niceWork')}</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      <Confetti pieces={pieces} />

      {/* Video / demo hero */}
      <div
        className="relative flex h-[300px] flex-none items-center justify-center"
        style={{ background: 'linear-gradient(150deg,#2c2c2c,#0c0c0c)' }}
      >
        <div className="absolute inset-x-4 top-3.5 z-10 flex items-center justify-between text-white">
          <button
            type="button"
            onClick={() => (logged.current.length > 0 ? setExitOpen(true) : router.push('/workouts'))}
            aria-label={t('back')}
            className="tf-press flex h-[34px] w-[34px] items-center justify-center rounded-full bg-black/40"
          >
            <Icon name="arrowLeft" size={18} />
          </button>
          <div className="text-center">
            <div className="text-[14px] font-semibold">{ex.name}</div>
            <div className="text-[11px] text-white/70">
              {idx + 1} / {exercises.length} · {dayLabel}
              {groupMates.length > 1 && (
                <>
                  {' · '}
                  <span className="font-semibold text-accent">
                    {t('supersetOf', { pos: groupPos, total: groupMates.length })}
                  </span>
                </>
              )}
            </div>
          </div>
          {/* Total elapsed workout time. */}
          <div className="flex h-[34px] min-w-[34px] items-center justify-center rounded-full bg-black/40 px-2.5 text-[13px] font-semibold tabular-nums text-white">
            {fmtClock(elapsed)}
          </div>
        </div>

        {/* SESSION progress, which is the one thing neither handoff screen agreed on and the one
            question the player could not answer. File A shows "SET 3 OF 4", which is where she is
            inside this movement; File B shows "20:34 · 23%" with a segment per exercise, which is
            how much of the whole workout is behind her. "How much longer?" is the question people
            actually ask mid-session, and the movement counter cannot answer it.

            Pure client arithmetic over state already held: sets logged against the session's total
            prescribed sets. No query, no new prop. */}
        <div className="absolute inset-x-4 bottom-3 z-10">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold tabular-nums text-white/70">
            <span>{fmtClock(elapsed)}</span>
            <span>{sessionPct}%</span>
          </div>
          <div className="flex gap-1">
            {exercises.map((e, i) => (
              <span
                key={e.exercise_id + i}
                className={[
                  'h-1 flex-1 rounded-full',
                  i < idx ? 'bg-white' : i === idx ? 'bg-white/60' : 'bg-white/20',
                ].join(' ')}
              />
            ))}
          </div>
        </div>
        {/* THREE SOURCES, IN THIS ORDER, and the order is the whole point.
            Mux first where it exists (2 rows today, adaptive streaming, the direction of travel).
            Then HER filmed demo from storage, which is 366 of the 367 movements she shot and which
            no member-facing surface could reach until now: the player read video_mux_id alone, so
            1,303 of 1,305 movements showed a dumbbell icon while her footage sat in the bucket.
            The icon is last and means "not filmed", which for ~940 seeded catalog movements is
            simply true. */}
        {ex.video_mux_id ? (
          <MuxPlayer
            playbackId={ex.video_mux_id}
            streamType="on-demand"
            accentColor="#5EBE62"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <>
            {/* ALWAYS RENDERED, never keyed, hidden rather than unmounted when there is no footage.
                Unmounting it is what dropped her out of fullscreen; see videoRef above. */}
            <video
              ref={videoRef}
              controls
              playsInline
              loop
              muted
              preload="metadata"
              onError={() =>
                setDemoFailed((prev) => {
                  const next = new Set(prev);
                  next.add(ex.exercise_id);
                  return next;
                })
              }
              aria-label={ex.name}
              className={`absolute inset-0 h-full w-full bg-black object-contain ${
                hasDemo ? '' : 'hidden'
              }`}
            />
            {!hasDemo && (
              <div className="text-white/50">
                <Icon name="dumbbell" size={90} strokeWidth={1.5} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Body */}
      <div className="tf-scroll flex-1 px-[22px] pb-7 pt-5">
        {/* RESTORED, SAID OUT LOUD. The recovery is automatic on purpose — a modal asking "resume?"
            is friction at the exact moment her hands are chalky and she wants to lift — but silently
            reviving sets she cannot see would be worse than losing them: she would trust a number
            she never verified. So it restores, tells her what it restored, and puts starting over
            one tap away. */}
        {restored > 0 && (
          <div className="mb-[18px] flex items-start justify-between gap-3 rounded-[14px] border border-line bg-warm/40 px-4 py-3">
            <p className="text-[13px] leading-snug text-soft">{t('restoredSets', { count: restored })}</p>
            <button
              type="button"
              onClick={startOver}
              className="tf-press shrink-0 text-[12px] font-semibold text-ink underline"
            >
              {t('restoredStartOver')}
            </button>
          </div>
        )}

        {/* Only on the first exercise. This is context for the session, not for every set, and a
            note that repeats on every screen stops being read by the third one. */}
        {cycleNote && idx === 0 && (
          <p className="mb-[18px] rounded-[14px] border border-line bg-surface px-4 py-3 text-[13px] leading-relaxed text-soft">
            {cycleNote}
          </p>
        )}

        <UnderlineTabs
          className="mb-[18px]"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'instructions', label: t('instructions') },
            { value: 'muscles', label: t('muscles') },
          ]}
        />

        {tab === 'instructions' ? (
          <>
            {/* HER NOTE FOR THIS PRESCRIPTION, which had never been rendered anywhere.
                session_exercises.notes is carried on 2,438 of her 2,501 prescribed movements (97%)
                and is the difference between a generic movement and her programming of it: "the
                goal is to hit 25 floors within this time frame". It was loaded into this component,
                sat in the props, and was never put on screen in either console.

                Above the cues, not below: the cues describe the movement in general, this describes
                what she wants from it today. */}
            {ex.notes && (
              <div className="mb-4 rounded-[14px] border border-line bg-warm/40 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[2px] text-faint">
                  {t('coachNote')}
                </div>
                <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-soft">
                  {ex.notes.trim()}
                </p>
              </div>
            )}
            {cueLines.length > 0 ? (
            <div className="text-[14px] leading-[1.9] text-soft">
              {cueLines.map((line, i) => (
                <div key={i} className="mb-2 flex gap-3">
                  <span className="font-bold text-muted">{i + 1}.</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
            ) : ex.notes ? null : (
              <p className="text-[14px] leading-[1.7] text-muted">{t('noCues')}</p>
            )}
          </>
        ) : (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">
              {t('targetMuscle')}
            </div>
            {/* TELL HER WHAT THIS IS FOR. The owner's note: "we should be telling them what we're
                targeting with the workouts". 406 of 1,305 movements carry no muscle_group - they
                came across from Lenus by name only - and this rendered a bare "-" for every one of
                them, which is the app admitting it has nothing to say.

                The prescription still knows something: a movement written as a duration is
                conditioning, and one written with no numbers at all is a warm-up or a stretch.
                Saying that is both true and useful. A hyphen is neither. */}
            <div className="mt-1 text-[16px] font-semibold capitalize">
              {muscleLabel ??
                (kind === 'timed' ? t('focusConditioning') : kind === 'untracked' ? t('focusMobility') : t('focusFullBody'))}
            </div>
            {/* The map needs a key to highlight. Without one it is an unlabelled body outline, which
                reads as a rendering failure rather than as missing data. */}
            {ex.muscleKey ? (
              <div className="mt-4">
                <MuscleMap muscleKey={ex.muscleKey} frontLabel={t('front')} backLabel={t('back')} />
              </div>
            ) : (
              <p className="mt-3 text-[13px] leading-relaxed text-muted">
                {kind === 'timed'
                  ? t('focusConditioningNote')
                  : kind === 'untracked'
                    ? t('focusMobilityNote')
                    : t('focusUnknownNote')}
              </p>
            )}
          </div>
        )}

        {/* Progressive overload: canonical "Last time / Target / +X" line (+ coach rationale on set 1).
            Rep-based only. There is no load to progress on a 25-minute walk, and the recommender's
            numbers come from set history that a timed movement deliberately does not write. */}
        {kind === 'reps' && ex.overload && (
          <ProgressionLine hint={ex.overload} showRationale={setNum === 1} />
        )}

        {/* THE INPUT, decided by what she was asked to do rather than by a fallback.
            Three shapes, and the wrong one is not a cosmetic slip: it writes a fabricated number
            into the history that drives her progressions. */}
        {kind === 'reps' ? (
          <div className="mt-[26px] flex items-center justify-between gap-3.5">
            <Stepper
              // Her prescription in the label, so the stepper is measured against what she wrote
              // rather than floating free. "REPS 12-15" is the instruction; the number below is the
              // attempt.
              label={targetLabel ? `${t('reps')} ${targetLabel}` : t('reps')}
              value={String(reps)}
              onDec={() => setReps((r) => Math.max(0, r - 1))}
              onInc={() => setReps((r) => r + 1)}
              decAria={t('decrease')}
              incAria={t('increase')}
            />
            {/* No weight stepper on a bodyweight or banded movement. A 0 in that box is not a
                reading, it is a shrug, and it lands in set_logs looking like a failed lift. */}
            {weighted && (
              <>
                <div className="h-16 w-px bg-line" />
                <Stepper
                  label={t('weight')}
                  value={String(weight)}
                  onDec={() => setWeight((w) => Math.max(0, w - 5))}
                  onInc={() => setWeight((w) => w + 5)}
                  decAria={t('decrease')}
                  incAria={t('increase')}
                />
              </>
            )}
            {!weighted && (
              <div className="flex-1 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-[2px] text-faint">
                  {t('load')}
                </div>
                <div className="mt-1.5 text-[15px] font-semibold text-muted">
                  {t('bodyweightLoad')}
                </div>
              </div>
            )}
          </div>
        ) : kind === 'timed' ? (
          /* A CLOCK, because she was given a duration. It counts UP: she may walk twenty of a
             prescribed twenty-five, and a countdown that hits zero cannot record that. */
          <div className="mt-[26px] rounded-[18px] border border-line bg-surface px-5 py-5 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[2px] text-faint">
              {t('timeTarget', { target: formatDuration(ex.timeSec ?? 0) })}
            </div>
            <div className="tf-display mt-1.5 text-[46px] leading-none tabular-nums">
              {fmtClock(work)}
            </div>
            <button
              type="button"
              onClick={() => setWorking((v) => !v)}
              className="tf-press mt-3.5 inline-flex items-center gap-2 rounded-full border border-line px-5 py-2 text-[12px] font-semibold uppercase tracking-[1px] text-ink"
            >
              <Icon name={working ? 'pause' : 'play'} size={14} />
              {working ? t('timePause') : work > 0 ? t('timeResume') : t('timeStart')}
            </button>
          </div>
        ) : (
          /* Neither counted nor timed. She wrote no numbers here, so the app writes none either. */
          <p className="mt-[26px] rounded-[18px] border border-line bg-surface px-5 py-4 text-center text-[13px] leading-relaxed text-muted">
            {t('untrackedNote')}
          </p>
        )}

        {/* The handoff's `.set-table`, replacing five dots that said only "you are on set 3".
            Columns are what THIS app records: reps, weight, and what she managed last time. The
            mock's Time and Effort columns are not dropped out of laziness, they are not recorded
            per set here; effort is the RPE row below, which is a tap rather than a column.

            `logged.current` is a ref, and reading a ref during render is normally wrong. It is
            correct here because logSet pushes to it and then immediately advances setNum or idx,
            so the render that follows always sees the push. Nothing else writes it. */}
        {kind === 'reps' && (
        <div className="mt-5 overflow-hidden rounded-[14px] border border-line">
          <div className="grid grid-cols-[44px_1fr_1fr_1.2fr] border-b border-line bg-warm/40 px-3 py-2 text-[9px] font-extrabold uppercase tracking-[0.6px] text-faint">
            <span>{t('setCol')}</span>
            <span className="text-right">{t('reps')}</span>
            <span className="text-right">{t('weight')}</span>
            <span className="text-right">{t('previousCol')}</span>
          </div>
          {Array.from({ length: totalSets }, (_, i) => {
            const n = i + 1;
            const done = loggedView.find(
              (l) => l.exercise_id === ex.exercise_id && l.set_number === n,
            );
            const prev = ex.previousSets.find((p) => p.setNumber === n);
            const current = n === setNum;
            return (
              <div
                key={n}
                className={[
                  'grid grid-cols-[44px_1fr_1fr_1.2fr] px-3 py-2.5 text-[13px] tabular-nums',
                  i > 0 ? 'border-t border-divider' : '',
                  current ? 'bg-warm/40' : '',
                ].join(' ')}
              >
                <span className={current ? 'font-bold text-ink' : 'text-muted'}>{n}</span>
                {/* A logged row shows what she DID. The current row shows what the steppers are set
                    to, so the table and the control above it never disagree. A future row shows a
                    dash rather than the target: printing the plan as though it were a result is how
                    a table starts lying about work nobody has done. */}
                <span className={`text-right ${done ? 'text-accent' : current ? 'text-ink' : 'text-faint'}`}>
                  {done ? done.reps : current ? reps : '--'}
                </span>
                <span className={`text-right ${done ? 'text-accent' : current ? 'text-ink' : 'text-faint'}`}>
                  {done ? done.weight : current ? weight : '--'}
                </span>
                <span className="text-right text-faint">
                  {prev ? `${prev.weight} x ${prev.reps}` : '--'}
                </span>
              </div>
            );
          })}
        </div>
        )}

        {/* What she goes straight into. Placed above the rest timer's territory on purpose: the
            whole point of a superset is that there is no rest here, and naming the next movement is
            what lets her set up for it before she finishes this one. */}
        {nextInGroup && (
          <div className="mt-4 rounded-xl bg-warm px-4 py-3 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">
              {t('thenStraightInto')}
            </span>
            <div className="mt-0.5 text-[15px] font-semibold text-ink">{nextInGroup.name}</div>
          </div>
        )}

        {/* Substitution */}
        <button
          type="button"
          onClick={swap}
          className="tf-press mt-4 flex w-full items-center justify-center gap-2 text-[12px] uppercase tracking-[1px] text-muted"
        >
          <Icon name="x" size={14} className="rotate-45" />
          {t('swap')}
        </button>
        {subsOpen && (
          <div className="mt-3 border border-line p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">
              {t('subsTitle')}
            </div>
            {subs === null ? (
              <p className="mt-2 text-[13px] text-faint">…</p>
            ) : subs.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted">{t('noSubs')}</p>
            ) : (
              <ul className="mt-2 flex flex-col">
                {subs.map((s, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => chooseSub(s)}
                      className="tf-press flex w-full items-center justify-between border-b border-divider py-2 text-left text-[14px] last:border-0"
                    >
                      <span>{subName(s)}</span>
                      {s.reason_tag && (
                        <span className="text-[12px] text-faint">{s.reason_tag}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Per-set difficulty (RPE): the signal that drives progressive overload. Not asked on an
            untracked movement: there is no set to rate, and a question with no purpose is the kind
            of friction that gets a warm-up skipped. */}
        {kind !== 'untracked' && (
        <div className="mt-5">
          <div className="mb-2 text-center text-[10px] font-medium uppercase tracking-[2px] text-faint">
            {t('feltTitle')}
          </div>
          <div className="flex gap-2">
            {DIFFICULTIES.map((d) => {
              const active = difficulty === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  aria-pressed={active}
                  className={`tf-press flex-1 rounded-full py-2 text-[12px] font-semibold ${
                    active ? 'bg-ink text-bg' : 'border border-line text-muted'
                  }`}
                >
                  {t(`difficulty.${d}`)}
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* The handoff spends its one action colour on this button, and it is the right place for
            it: everything else on the screen is a reading, this is the thing she came to do. */}
        <PortalButton variant="action" className="mt-[18px]" onClick={logSet}>
          {idx === exercises.length - 1 && setNum === totalSets
            ? t('finish')
            : kind === 'reps'
              ? t('logSet')
              : kind === 'timed'
                ? t('timeDone')
                : t('markComplete')}
        </PortalButton>
      </div>

      {/* THE WAY OUT, and the thing that was missing entirely.
          Backing out used to route away and record nothing, so a member who did eight movements
          and left had trained, by the app's account, zero times. */}
      {exitOpen && (
        <div className="absolute inset-0 z-50 flex items-end bg-black/60 px-4 pb-6">
          <div className="w-full rounded-[22px] bg-bg p-5">
            <div className="text-[17px] font-semibold text-ink">{t('exitTitle')}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {t('exitBody', { count: loggedView.length })}
            </p>
            {saveFailed && (
              <p role="alert" className="mt-3 rounded-xl bg-alert px-3 py-2 text-[13px] text-alert-ink">
                {t('saveFailed')}
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              <PortalButton variant="action" onClick={() => void saveAndExit()}>
                {saving ? t('saving') : saveFailed ? t('tryAgain') : t('exitSave')}
              </PortalButton>
              <button
                type="button"
                onClick={() => setExitOpen(false)}
                className="tf-press rounded-full border border-line py-3 text-[13px] font-semibold text-ink"
              >
                {t('exitKeepGoing')}
              </button>
              {/* Discard is deliberately the quietest control on the sheet and says what it does.
                  It is still here: a session started by mistake should not be a permanent row. */}
              <button
                type="button"
                onClick={() => {
                  clearDraft(sessionId);
                  logged.current = [];
                  router.push('/workouts');
                }}
                className="tf-press py-1.5 text-[12px] text-faint underline"
              >
                {t('exitDiscard')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REST, FULL SCREEN.
          It used to be a strip under the set table: "I think that sixty second rest should be
          popping up on the entire screen, not just like that. It should pop up on the entire screen
          so my people know that they got sixty seconds, and there should be a countdown clock."

          He is describing what a rest actually is. It is not a status line beside the next input,
          it is a period of the session with a defined end, and the phone is on a bench four feet
          away. A number that reads across a gym, a ring that shows the shape of the wait, and the
          name of what she is walking back to. */}
      {rest !== null && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#0b0b0c] px-8 text-center text-white">
          <span className="text-[11px] font-semibold uppercase tracking-[4px] text-white/50">
            {t('rest')}
          </span>

          <div className="relative mt-6 flex h-[230px] w-[230px] items-center justify-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#edff00"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 45}
                // Drains as the rest runs down. restTotal can be 0 only if a rest somehow began
                // without one, in which case a full ring is the safe reading.
                strokeDashoffset={2 * Math.PI * 45 * (1 - (restTotal > 0 ? rest / restTotal : 1))}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <span className="tf-display text-[72px] leading-none tabular-nums">{rest}</span>
          </div>

          {/* What she is going back to. During a rest the screen behind has ALREADY advanced, so
              naming it here is the difference between waiting and getting set up. */}
          <div className="mt-7 min-h-[42px]">
            <div className="text-[10px] font-semibold uppercase tracking-[3px] text-white/40">
              {t('restNextUp')}
            </div>
            <div className="mt-1 text-[17px] font-semibold">{ex.name}</div>
          </div>

          <div className="mt-8 flex w-full max-w-[320px] items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setRest((r) => (r ?? 0) + 15);
                setRestTotal((v) => v + 15);
              }}
              className="tf-press flex-1 rounded-full border border-white/25 py-3 text-[13px] font-semibold uppercase tracking-[1px] text-white/80"
            >
              {t('restPlus15')}
            </button>
            <button
              type="button"
              onClick={() => {
                setRest(null);
                void videoRef.current?.play().catch(() => {});
              }}
              className="tf-press flex-1 rounded-full bg-white py-3 text-[13px] font-semibold uppercase tracking-[1px] text-[#0b0b0c]"
            >
              {t('skipRest')}
            </button>
          </div>
        </div>
      )}

      {/* Post-workout rating sheet: PRs + enjoyment/effort before we persist and celebrate */}
      {showComplete && !finished && (
        <div className="absolute inset-0 z-30 flex flex-col bg-bg">
          <Confetti pieces={pieces} />
          <div className="tf-scroll flex-1 px-[22px] pb-6 pt-10">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Icon name="check" size={30} />
              </div>
              <div className="tf-display mt-4 text-[30px]">{t('completeTitle')}</div>
              <p className="mt-1 text-[13px] text-muted">{t('completeSubtitle')}</p>
              <div className="mt-2 text-[12px] tabular-nums text-faint">
                {fmtClock(elapsed)} · {t('setsLogged', { count: setsCount })}
              </div>
            </div>

            {prs.length > 0 && (
              <div className="mt-6 rounded-2xl bg-accent/10 p-4">
                <div className="flex items-center gap-2 text-accent">
                  <Icon name="flame" size={18} />
                  <span className="text-[11px] font-semibold uppercase tracking-[2px]">
                    {t('prTitle', { count: prs.length })}
                  </span>
                </div>
                <ul className="mt-2.5 flex flex-col gap-1.5">
                  {prs.map((pr) => (
                    <li key={pr.exerciseId} className="flex items-center justify-between gap-3 text-[14px]">
                      <span className="font-semibold">{pr.name}</span>
                      <span className="tabular-nums text-muted">
                        {pr.bodyweight
                          ? t('prReps', { reps: pr.reps })
                          : t('overloadTarget', { weight: pr.weight, reps: pr.reps })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-7 flex flex-col gap-6">
              <RatingRow
                label={t('enjoymentLabel')}
                low={t('enjoymentLow')}
                high={t('enjoymentHigh')}
                value={enjoyment}
                onChange={setEnjoyment}
              />
              <RatingRow
                label={t('effortLabel')}
                low={t('effortLow')}
                high={t('effortHigh')}
                value={effort}
                onChange={setEffort}
              />
            </div>
          </div>
          <div className="flex-none px-[22px] pb-7 pt-2">
            {saveFailed && (
              <p role="alert" className="mb-2 rounded-xl bg-alert px-3 py-2 text-[13px] text-alert-ink">
                {t('saveFailed')}
              </p>
            )}
            <Button size="block" disabled={saving} onClick={() => void submitLog()}>
              {saving ? t('saving') : saveFailed ? t('tryAgain') : t('finish')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// A 1-5 rating row (enjoyment / effort). Numbered, no emoji (product rule), min/max labels underneath.
function RatingRow({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: number | null;
  onChange: (n: number) => void;
}): ReactElement {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">{label}</div>
      <div className="mt-2.5 flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`${label}: ${n}`}
              aria-pressed={active}
              className={`tf-press flex h-12 flex-1 items-center justify-center rounded-2xl font-display text-[18px] ${
                active ? 'bg-ink text-bg' : 'border border-line text-muted'
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-faint">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

// Canonical progressive-overload line: "Last time - N x W lb / Target - N x W lb [+X]" with the
// suggested next step as a pill, plus the coach's-voice rationale on the first set (my enhancement).
// The steppers already prefill to the target, so this reads rather than acts.
function ProgressionLine({
  hint,
  showRationale,
}: {
  hint: OverloadHint;
  showRationale: boolean;
}): ReactElement {
  const t = useTranslations('app.exercise');
  const fmtSet = (r: number | null, w: number | null): string =>
    w != null && w > 0 ? `${r ?? 0} × ${w} lb` : t('prReps', { reps: r ?? 0 });

  const wDelta = Math.round(((hint.weight ?? 0) - (hint.lastWeight ?? 0)) * 10) / 10;
  const rDelta = hint.reps - (hint.lastReps ?? hint.reps);
  let pill: { text: string; tone: string } | null = null;
  if (hint.lastReps != null) {
    if (hint.action === 'increase_weight' && wDelta > 0) {
      pill = { text: `+${wDelta} lb`, tone: 'bg-accent/15 text-accent' };
    } else if (hint.action === 'increase_reps' && rDelta > 0) {
      pill = { text: t('plusReps', { n: rDelta }), tone: 'bg-accent/15 text-accent' };
    } else if (hint.action === 'deload' && wDelta < 0) {
      pill = { text: `${wDelta} lb`, tone: 'bg-alert text-alert-ink' };
    }
  }

  return (
    <div className="mt-[22px]">
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="text-muted">
          {hint.lastReps != null
            ? `${t('lastTime')} · ${fmtSet(hint.lastReps, hint.lastWeight)}`
            : t('firstSet')}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-muted">
            {t('target')} ·{' '}
            <span className="font-semibold text-ink">{fmtSet(hint.reps, hint.weight)}</span>
          </span>
          {pill && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill.tone}`}>
              {pill.text}
            </span>
          )}
        </span>
      </div>
      {showRationale && hint.rationale && (
        <p className="mt-1.5 text-[12px] leading-[1.5] text-soft">{hint.rationale}</p>
      )}
    </div>
  );
}

function Stepper({
  label,
  value,
  onDec,
  onInc,
  decAria,
  incAria,
}: {
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
  decAria: string;
  incAria: string;
}): ReactElement {
  return (
    <div className="flex-1">
      <div className="mb-2 text-center text-[10px] font-medium uppercase tracking-[2px] text-faint">
        {label}
      </div>
      <div className="flex items-center justify-center gap-3.5">
        <button
          type="button"
          onClick={onDec}
          aria-label={decAria}
          className="tf-press flex h-[42px] w-[42px] items-center justify-center rounded-full border border-line text-xl"
        >
          <Icon name="minus" size={18} />
        </button>
        <div className="min-w-[52px] text-center font-display text-[40px] leading-none">
          {value}
        </div>
        <button
          type="button"
          onClick={onInc}
          aria-label={incAria}
          className="tf-press flex h-[42px] w-[42px] items-center justify-center rounded-full bg-ink text-bg"
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
    </div>
  );
}
