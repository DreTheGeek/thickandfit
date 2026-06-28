'use client';

import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { createChallengeAction } from '@/lib/community/challenge-actions';

const METRICS = ['workouts', 'steps', 'water', 'points'] as const;

export function CreateChallenge(): ReactElement {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState<(typeof METRICS)[number]>('workouts');
  const [goal, setGoal] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();

  const valid = title.trim().length >= 2 && startsOn !== '' && endsOn !== '';

  function submit(): void {
    setErr('');
    start(async () => {
      const res = await createChallengeAction({
        title,
        metric,
        goal: goal ? Number(goal) : null,
        startsOn,
        endsOn,
      });
      if (res.ok) {
        setTitle('');
        setGoal('');
        setStartsOn('');
        setEndsOn('');
        router.refresh();
      } else {
        setErr(res.error === 'bad_dates' ? 'End date must be after the start date.' : 'Could not create the challenge.');
      }
    });
  }

  const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-[14px] outline-none focus:border-ink';

  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-[1px] text-faint">New challenge</p>
      <div className="grid gap-3">
        <input className={input} placeholder="Challenge name (e.g. Summer Shred)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <select className={input} value={metric} onChange={(e) => setMetric(e.target.value as (typeof METRICS)[number])}>
            {METRICS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input className={input} type="number" min={1} placeholder="Goal (optional)" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[11px] text-faint">
            Starts
            <input className={input} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </label>
          <label className="text-[11px] text-faint">
            Ends
            <input className={input} type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
          </label>
        </div>
        {err ? <p className="text-[12px] text-red-600">{err}</p> : null}
        <button
          type="button"
          onClick={submit}
          disabled={!valid || pending}
          className="tf-press rounded-full bg-ink py-2.5 text-[13px] font-semibold text-bg disabled:opacity-40"
        >
          {pending ? 'Publishing...' : 'Publish challenge'}
        </button>
      </div>
    </div>
  );
}
