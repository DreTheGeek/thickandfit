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
  readDraft,
  writeDraft,
  clearDraft,
  DRAFT_VERSION,
  type WorkoutDraft,
  type DraftSet,
} from '@/lib/workout/draft';

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
   * Prescription detail imported from her Lenus programming. 1,531 of her 2,497 exercises sit
   * inside a superset and nothing in the app said so, which meant a member performed them as
   * straight sets with full rest: a different workout from the one she wrote.
   */
  repsMin: number | null;
  repsMax: number | null;
  isAmrap: boolean;
  groupKey: string | null;
  groupKind: string | null;
  overload: OverloadHint | null;
  // All-time bests for PR detection (Epley e1RM for weighted, max reps for bodyweight).
  bestE1rm: number | null;
  bestReps: number | null;
};
type Substitute = {
  exercise: { id: string; name_en: string; name_es: string | null } | null;
  reason_tag: string | null;
};
type LoggedSet = {
  exercise_id: string;
  set_number: number;
  reps: number;
  weight: number;
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
    const mine = sets.filter((s) => s.exercise_id === ex.exercise_id && s.completed);
    if (!mine.length) continue;

    let sesE1rm = 0;
    let bestWeighted: LoggedSet | null = null;
    let bestReps: LoggedSet | null = null;
    for (const s of mine) {
      if (!bestReps || s.reps > bestReps.reps) bestReps = s;
      if (s.weight > 0 && s.reps > 0) {
        const e = s.weight * (1 + s.reps / 30);
        if (e > sesE1rm) {
          sesE1rm = e;
          bestWeighted = s;
        }
      }
    }

    if (ex.bestE1rm !== null && bestWeighted && sesE1rm > ex.bestE1rm + 0.5) {
      prs.push({ exerciseId: ex.exercise_id, name: ex.name, weight: bestWeighted.weight, reps: bestWeighted.reps, bodyweight: false });
    } else if (ex.bestE1rm === null && ex.bestReps !== null && bestReps && bestReps.reps > ex.bestReps) {
      prs.push({ exerciseId: ex.exercise_id, name: ex.name, weight: 0, reps: bestReps.reps, bodyweight: true });
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
  return sets.map((x) => ({
    exercise_id: String(x.exercise_id),
    set_number: Number(x.set_number),
    reps: Number(x.reps),
    weight: Number(x.weight),
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
  const [subsOpen, setSubsOpen] = useState(false);
  const [subs, setSubs] = useState<Substitute[] | null>(null);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [elapsed, setElapsed] = useState(draft?.elapsed ?? 0); // total workout seconds, counts up from start
  const [difficulty, setDifficulty] = useState<Difficulty>('moderate'); // this set's RPE, resets each set
  const [showComplete, setShowComplete] = useState(false); // post-workout rating sheet
  const [setsCount, setSetsCount] = useState(0); // sets logged, snapshotted when the sheet opens
  const [prs, setPrs] = useState<PR[]>([]);
  const [enjoyment, setEnjoyment] = useState<number | null>(null);
  const [effort, setEffort] = useState<number | null>(null);
  const logged = useRef<LoggedSet[]>(draft ? toLoggedSets(draft.sets) : []);
  const wakeRef = useRef<WakeLockSentinel | null>(null);
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
      } satisfies WorkoutDraft);
    },
    [sessionId, startedAt],
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
  // Prefill from the progressive-overload recommendation when we have one, else the plan target.
  const [reps, setReps] = useState(ex?.overload?.reps ?? ex?.reps ?? 10);
  const [weight, setWeight] = useState(ex?.overload?.weight ?? ex?.weight ?? 0);

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

  // Rest countdown with an audible cue at zero (setState only in the timer callback).
  useEffect(() => {
    if (rest === null || rest <= 0) return undefined;
    const timer = setTimeout(() => {
      if (rest <= 1) {
        beep();
        setRest(null);
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
          i === idx ? { ...item, exercise_id: s.exercise!.id, name, bestE1rm: null, bestReps: null } : item,
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
    setSaveFailed(false);
    setSaving(true);
    try {
      const res = await fetch('/api/workouts/log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId ?? undefined,
          completion_pct: 100,
          enjoyment: enjoyment ?? undefined,
          effort: effort ?? undefined,
          sets: logged.current,
        }),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      // Safely on the server now. Leaving the draft behind would offer to restore a workout she has
      // already logged, and accepting that offer would log it twice.
      clearDraft(sessionId);
    } catch (e) {
      console.error('workout submitLog:', e instanceof Error ? e.message : e);
      setSaving(false);
      setSaveFailed(true);
      return;
    }
    setSaving(false);
    // Celebrate only once it is actually hers. She earned the confetti by finishing; she has not
    // earned it while the work is still in a variable.
    setFinished(true);
    fire();
    setTimeout(() => router.push('/workouts'), 1300);
  }, [fire, router, sessionId, enjoyment, effort]);

  // The escape hatch for a restore she did not want — a plan changed, or she is genuinely starting
  // the day again. Everything else about recovery is automatic; this is the one tap that undoes it.
  const startOver = useCallback((): void => {
    logged.current = [];
    swapsRef.current = {};
    clearDraft(sessionId);
    setRestored(0);
    setExercises(initialExercises);
    setIdx(0);
    setSetNum(1);
    setElapsed(0);
  }, [sessionId, initialExercises]);

  const logSet = useCallback((): void => {
    logged.current.push({
      exercise_id: ex.exercise_id,
      set_number: setNum,
      reps,
      weight,
      completed: true,
      difficulty,
    });
    setDifficulty('moderate'); // reset the RPE tap for the next set

    if (setNum < totalSets) {
      // Saved with the position she is moving TO, not the one she just left: a recovery should put
      // her at the next set, not make her redo the one she already logged.
      saveDraft(idx, setNum + 1);
      setSetNum((n) => n + 1);
      if (ex.rest_sec) setRest(ex.rest_sec);
    } else if (idx < exercises.length - 1) {
      const next = exercises[idx + 1];
      saveDraft(idx + 1, 1);
      setIdx(idx + 1);
      setSetNum(1);
      setReps(next.overload?.reps ?? next.reps ?? 10);
      setWeight(next.overload?.weight ?? next.weight ?? 0);
      setTab('instructions');
      if (ex.rest_sec) setRest(ex.rest_sec);
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
  }, [ex, setNum, totalSets, idx, exercises, reps, weight, difficulty, fire, saveDraft]);

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
            onClick={() => router.push('/workouts')}
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
        {ex.video_mux_id ? (
          <MuxPlayer
            playbackId={ex.video_mux_id}
            streamType="on-demand"
            accentColor="#5EBE62"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <div className="text-white/50">
            <Icon name="dumbbell" size={90} strokeWidth={1.5} />
          </div>
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
          cueLines.length > 0 ? (
            <div className="text-[14px] leading-[1.9] text-soft">
              {cueLines.map((line, i) => (
                <div key={i} className="mb-2 flex gap-3">
                  <span className="font-bold text-muted">{i + 1}.</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[14px] leading-[1.7] text-muted">{t('noCues')}</p>
          )
        ) : (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">
              {t('targetMuscle')}
            </div>
            <div className="mt-1 text-[16px] font-semibold capitalize">
              {muscleLabel ?? '-'}
            </div>
            <div className="mt-4">
              <MuscleMap muscleKey={ex.muscleKey} frontLabel={t('front')} backLabel={t('back')} />
            </div>
          </div>
        )}

        {/* Progressive overload: canonical "Last time / Target / +X" line (+ coach rationale on set 1) */}
        {ex.overload && <ProgressionLine hint={ex.overload} showRationale={setNum === 1} />}

        {/* Steppers */}
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
          <div className="h-16 w-px bg-line" />
          <Stepper
            label={t('weight')}
            value={String(weight)}
            onDec={() => setWeight((w) => Math.max(0, w - 5))}
            onInc={() => setWeight((w) => w + 5)}
            decAria={t('decrease')}
            incAria={t('increase')}
          />
        </div>

        {/* Set dots */}
        <div className="mt-5 flex justify-center gap-1.5">
          {Array.from({ length: totalSets }, (_, i) => {
            const n = i + 1;
            const color =
              n < setNum
                ? 'bg-accent'
                : n === setNum
                  ? 'bg-ink'
                  : 'bg-line';
            return <span key={i} className={`h-1.5 w-[30px] rounded-full ${color}`} />;
          })}
        </div>
        <div className="mt-2 text-center text-[12px] text-faint">
          {t('set', { current: setNum, total: totalSets })}
        </div>

        {/* Rest banner */}
        {rest !== null && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-ink px-5 py-3 text-white">
            <span className="text-[12px] uppercase tracking-[2px] text-white/70">
              {t('rest')}
            </span>
            <span className="font-display text-[24px]">{rest}s</span>
            <button
              type="button"
              onClick={() => setRest(null)}
              className="tf-press text-[12px] uppercase tracking-[1px] text-white/70"
            >
              {t('skipRest')}
            </button>
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

        {/* Per-set difficulty (RPE): the signal that drives progressive overload */}
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

        <Button size="block" className="mt-[18px]" onClick={logSet}>
          {idx === exercises.length - 1 && setNum === totalSets
            ? t('finish')
            : t('logSet')}
        </Button>
      </div>

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
