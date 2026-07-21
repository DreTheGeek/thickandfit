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

export function WorkoutPlayer({
  sessionId,
  dayLabel,
  exercises: initialExercises,
}: {
  sessionId: string | null;
  programName: string;
  dayLabel: string;
  exercises: PlayerExercise[];
}): ReactElement {
  const t = useTranslations('app.exercise');
  const locale = useLocale();
  const subName = (s: Substitute): string =>
    (locale === 'es' && s.exercise?.name_es) || s.exercise?.name_en || t('untitled');
  const router = useRouter();
  const { pieces, fire } = useConfetti();

  const [exercises, setExercises] = useState<PlayerExercise[]>(initialExercises);
  const [idx, setIdx] = useState(0);
  const [setNum, setSetNum] = useState(1);
  const [tab, setTab] = useState<'instructions' | 'muscles'>('instructions');
  const [rest, setRest] = useState<number | null>(null);
  const [subsOpen, setSubsOpen] = useState(false);
  const [subs, setSubs] = useState<Substitute[] | null>(null);
  const [finished, setFinished] = useState(false);
  const [elapsed, setElapsed] = useState(0); // total workout seconds, counts up from start
  const [difficulty, setDifficulty] = useState<Difficulty>('moderate'); // this set's RPE, resets each set
  const [showComplete, setShowComplete] = useState(false); // post-workout rating sheet
  const [setsCount, setSetsCount] = useState(0); // sets logged, snapshotted when the sheet opens
  const [prs, setPrs] = useState<PR[]>([]);
  const [enjoyment, setEnjoyment] = useState<number | null>(null);
  const [effort, setEffort] = useState<number | null>(null);
  const logged = useRef<LoggedSet[]>([]);
  const wakeRef = useRef<WakeLockSentinel | null>(null);

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
      setSubsOpen(false);
    },
    // subName is recreated each render; locale/t drive its output.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idx, locale],
  );

  // Persist the whole session (sets carry per-set difficulty; the sheet adds enjoyment/effort),
  // fire the celebration, and head back. Called from the completion sheet, not on the last set.
  const submitLog = useCallback(async (): Promise<void> => {
    setFinished(true);
    fire();
    try {
      await fetch('/api/workouts/log', {
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
    } catch {
      // best-effort; the celebration already played
    }
    setTimeout(() => router.push('/workouts'), 1300);
  }, [fire, router, sessionId, enjoyment, effort]);

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
      setSetNum((n) => n + 1);
      if (ex.rest_sec) setRest(ex.rest_sec);
    } else if (idx < exercises.length - 1) {
      const next = exercises[idx + 1];
      setIdx(idx + 1);
      setSetNum(1);
      setReps(next.overload?.reps ?? next.reps ?? 10);
      setWeight(next.overload?.weight ?? next.weight ?? 0);
      setTab('instructions');
      if (ex.rest_sec) setRest(ex.rest_sec);
    } else {
      // Last set of the last exercise: open the rating sheet (PRs + enjoyment/effort). Don't finish yet.
      const found = detectPRs(exercises, logged.current);
      setPrs(found);
      setSetsCount(logged.current.length);
      setShowComplete(true);
      if (found.length) fire();
    }
  }, [ex, setNum, totalSets, idx, exercises, reps, weight, difficulty, fire]);

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
            label={t('reps')}
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
            <Button size="block" onClick={() => void submitLog()}>
              {t('finish')}
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
