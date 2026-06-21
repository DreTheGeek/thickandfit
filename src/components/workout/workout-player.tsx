'use client';
// Workout player, re-skinned to the design-handoff exercise screen: video hero,
// Instructions/Muscles tabs, reps/weight steppers, set-progress dots, audible rest
// timer + Wake Lock (Phase 1 differentiators), inline substitution, and Log Set ->
// confetti -> persist (PRD-12). The exact things competitors got wrong.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Icon } from '@/components/ui/icons';
import { UnderlineTabs } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/badge';
import { Confetti, useConfetti } from '@/components/ui/confetti';

export type OverloadHint = {
  action: 'increase_reps' | 'increase_weight' | 'hold' | 'deload';
  weight: number | null;
  reps: number;
  rationale: string;
  historyPoints: number;
};
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
  video_mux_id: string | null;
  overload: OverloadHint | null;
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
};

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
  programName,
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
  const logged = useRef<LoggedSet[]>([]);
  const wakeRef = useRef<WakeLockSentinel | null>(null);

  const ex = exercises[idx];
  const totalSets = ex?.sets ?? 1;
  // Prefill from the progressive-overload recommendation when we have one, else the plan target.
  const [reps, setReps] = useState(ex?.overload?.reps ?? ex?.reps ?? 10);
  const [weight, setWeight] = useState(ex?.overload?.weight ?? ex?.weight ?? 0);
  const [hintOpen, setHintOpen] = useState(true);

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
          i === idx ? { ...item, exercise_id: s.exercise!.id, name } : item,
        ),
      );
      setSubsOpen(false);
    },
    // subName is recreated each render; locale/t drive its output.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idx, locale],
  );

  const finish = useCallback(async (): Promise<void> => {
    setFinished(true);
    fire();
    try {
      await fetch('/api/workouts/log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId ?? undefined,
          completion_pct: 100,
          sets: logged.current,
        }),
      });
    } catch {
      // best-effort; the celebration already played
    }
    setTimeout(() => router.push('/workouts'), 1300);
  }, [fire, router, sessionId]);

  const logSet = useCallback((): void => {
    logged.current.push({
      exercise_id: ex.exercise_id,
      set_number: setNum,
      reps,
      weight,
      completed: true,
    });

    if (setNum < totalSets) {
      setSetNum((n) => n + 1);
      if (ex.rest_sec) setRest(ex.rest_sec);
    } else if (idx < exercises.length - 1) {
      const next = exercises[idx + 1];
      setIdx(idx + 1);
      setSetNum(1);
      setReps(next.overload?.reps ?? next.reps ?? 10);
      setWeight(next.overload?.weight ?? next.weight ?? 0);
      setHintOpen(true);
      setTab('instructions');
      if (ex.rest_sec) setRest(ex.rest_sec);
    } else {
      void finish();
    }
  }, [ex, setNum, totalSets, idx, exercises, reps, weight, finish]);

  const applyHint = useCallback((): void => {
    if (!ex?.overload) return;
    setReps(ex.overload.reps);
    if (ex.overload.weight !== null) setWeight(ex.overload.weight);
    setHintOpen(false);
  }, [ex]);

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
        <div className="absolute inset-x-4 top-3.5 flex items-center justify-between text-white">
          <button
            type="button"
            onClick={() => router.push('/workouts')}
            aria-label="Back"
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
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-black/40 text-white">
            ···
          </div>
        </div>
        <div className="text-white/50">
          <Icon name="dumbbell" size={90} strokeWidth={1.5} />
        </div>
        {ex.video_mux_id != null && (
          <div className="absolute bottom-3.5 right-4">
            <Tag outlined={false} className="bg-white/15 text-white">
              {t('demo')}
            </Tag>
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
          </div>
        )}

        {/* Progressive-overload recommendation (first set only) */}
        {ex.overload && setNum === 1 && hintOpen && (
          <OverloadCard hint={ex.overload} onApply={applyHint} onDismiss={() => setHintOpen(false)} />
        )}

        {/* Steppers */}
        <div className="mt-[26px] flex items-center justify-between gap-3.5">
          <Stepper
            label={t('reps')}
            value={String(reps)}
            onDec={() => setReps((r) => Math.max(0, r - 1))}
            onInc={() => setReps((r) => r + 1)}
          />
          <div className="h-16 w-px bg-line" />
          <Stepper
            label={t('weight')}
            value={String(weight)}
            onDec={() => setWeight((w) => Math.max(0, w - 5))}
            onInc={() => setWeight((w) => w + 5)}
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

        <Button size="block" className="mt-[18px]" onClick={logSet}>
          {idx === exercises.length - 1 && setNum === totalSets
            ? t('finish')
            : t('logSet')}
        </Button>
      </div>
    </div>
  );
}

// Pure-SVG glyph + colorway per overload action. No chart library.
function actionVisual(action: OverloadHint['action']): { glyph: ReactElement; tone: string } {
  const stroke = 'currentColor';
  switch (action) {
    case 'increase_weight':
    case 'increase_reps':
      return {
        tone: 'text-accent',
        glyph: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 13V3M8 3L4 7M8 3l4 4" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      };
    case 'deload':
      return {
        tone: 'text-alert',
        glyph: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M8 13l-4-4M8 13l4-4" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      };
    default:
      return {
        tone: 'text-muted',
        glyph: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      };
  }
}

function OverloadCard({
  hint,
  onApply,
  onDismiss,
}: {
  hint: OverloadHint;
  onApply: () => void;
  onDismiss: () => void;
}): ReactElement {
  const t = useTranslations('app.exercise');
  const { glyph, tone } = actionVisual(hint.action);
  const thin = hint.historyPoints < 2;
  const actionLabel = t(`overloadAction.${hint.action}`);
  const target =
    hint.weight !== null
      ? t('overloadTarget', { weight: hint.weight, reps: hint.reps })
      : t('overloadTargetBodyweight', { reps: hint.reps });

  return (
    <div className="mt-[22px] rounded-2xl bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-bg ${tone}`}>
            {glyph}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">
            {t('overloadTitle')}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('overloadDismiss')}
          className="tf-press text-faint"
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className={`mt-2 text-[13px] font-semibold ${tone}`}>{actionLabel}</div>
      <div className="mt-0.5 font-display text-[22px] leading-none text-ink">{target}</div>
      <p className="mt-2 text-[13px] leading-[1.6] text-soft">{hint.rationale}</p>
      {thin && (
        <p className="mt-1 text-[12px] leading-[1.5] text-faint">{t('overloadThin')}</p>
      )}

      <button
        type="button"
        onClick={onApply}
        className="tf-press mt-3 text-[12px] font-semibold uppercase tracking-[1px] text-accent"
      >
        {t('overloadApply')}
      </button>
    </div>
  );
}

function Stepper({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
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
          aria-label="decrease"
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
          aria-label="increase"
          className="tf-press flex h-[42px] w-[42px] items-center justify-center rounded-full bg-ink text-bg"
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
    </div>
  );
}
