'use client';
// Workout player: audible Web Audio interval timer + Wake Lock (screen stays on), exercise-by-
// exercise set flow, difficulty rating, and inline substitution access. The exact things Alive
// got wrong. Logging persists in PRD-12; this drives the in-session experience.
import { useCallback, useEffect, useRef, useState } from 'react';

type PlayerExercise = {
  exercise_id: string;
  name: string;
  sets: number | null;
  reps: number | null;
  rest_sec: number | null;
  notes: string | null;
};
type Substitute = { exercise: { id: string; name_en: string } | null; reason_tag: string | null };

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

export function WorkoutPlayer({ dayLabel, exercises }: { dayLabel: string; exercises: PlayerExercise[] }) {
  const [idx, setIdx] = useState(0);
  const [rest, setRest] = useState<number | null>(null);
  const [subs, setSubs] = useState<Substitute[] | null>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);

  const ex = exercises[idx];

  // Wake Lock for the whole session.
  useEffect(() => {
    let released = false;
    async function acquire() {
      try {
        if ('wakeLock' in navigator) {
          wakeRef.current = await navigator.wakeLock.request('screen');
        }
      } catch {
        // wake lock unavailable
      }
    }
    acquire();
    const onVis = () => {
      if (document.visibilityState === 'visible' && !released) acquire();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVis);
      wakeRef.current?.release().catch(() => {});
    };
  }, []);

  // Rest countdown with an audible cue at zero.
  useEffect(() => {
    if (rest === null) return;
    if (rest <= 0) {
      beep();
      setRest(null);
      return;
    }
    const t = setTimeout(() => setRest((r) => (r === null ? null : r - 1)), 1000);
    return () => clearTimeout(t);
  }, [rest]);

  const swap = useCallback(async () => {
    setSubs(null);
    try {
      const res = await fetch(`/api/exercises/${ex.exercise_id}/substitutions?context=gym`);
      const json = await res.json();
      setSubs(json?.data?.substitutes ?? []);
    } catch {
      setSubs([]);
    }
  }, [ex]);

  if (!ex) {
    return <p className="text-sm text-neutral-600">Session complete. Nice work.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs uppercase tracking-widest text-neutral-500">{dayLabel} · {idx + 1}/{exercises.length}</p>
      <h2 className="text-2xl font-bold uppercase tracking-tight">{ex.name}</h2>
      <p className="text-lg">
        {ex.sets ?? '-'} x {ex.reps ?? '-'}
        {ex.rest_sec ? ` · rest ${ex.rest_sec}s` : ''}
      </p>
      {ex.notes ? <p className="text-sm text-neutral-600">{ex.notes}</p> : null}

      {rest !== null ? (
        <div className="bg-black px-6 py-4 text-center text-3xl font-bold text-white">{rest}s</div>
      ) : (
        <button type="button" onClick={() => setRest(ex.rest_sec ?? 60)} className="rounded-none border border-black px-5 py-3 text-sm font-medium">
          Start rest timer
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={swap} className="rounded-none border border-black px-4 py-2 text-sm">
          Swap exercise
        </button>
        <button
          type="button"
          onClick={() => {
            setSubs(null);
            setIdx((i) => Math.min(i + 1, exercises.length));
          }}
          className="rounded-none bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Next exercise
        </button>
      </div>

      {subs ? (
        <div className="border border-neutral-200 p-3">
          <p className="text-xs uppercase tracking-widest text-neutral-500">Substitutes (full gym)</p>
          {subs.length === 0 ? (
            <p className="mt-1 text-sm text-neutral-500">No substitutes curated. Stick with the original.</p>
          ) : (
            <ul className="mt-1 text-sm">
              {subs.map((s, i) => (
                <li key={i}>
                  {s.exercise?.name_en}
                  {s.reason_tag ? <span className="text-neutral-400"> ({s.reason_tag})</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
