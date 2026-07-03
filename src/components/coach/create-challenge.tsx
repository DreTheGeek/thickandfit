'use client';

import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createChallengeAction } from '@/lib/community/challenge-actions';

// Only metrics with a REAL data source: workouts counts workout_logs, logs counts distinct diary
// days. steps/water/points had no source (boards stayed 0 forever) so they are no longer offered;
// they return when wearables/hydration tracking exist.
const METRICS = ['workouts', 'logs'] as const;

export function CreateChallenge(): ReactElement {
  const t = useTranslations('app.coach');
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
        setErr(res.error === 'bad_dates' ? t('challengeBadDates') : t('challengeCreateFailed'));
      }
    });
  }

  const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-[14px] outline-none focus:border-ink';

  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-[1px] text-faint">{t('newChallengeTitle')}</p>
      <div className="grid gap-3">
        <input className={input} placeholder={t('challengeNamePh')} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <select className={input} value={metric} onChange={(e) => setMetric(e.target.value as (typeof METRICS)[number])}>
            {METRICS.map((m) => (
              <option key={m} value={m}>
                {m === 'workouts' ? t('metricWorkouts') : t('metricLogs')}
              </option>
            ))}
          </select>
          <input className={input} type="number" min={1} placeholder={t('challengeGoalPh')} value={goal} onChange={(e) => setGoal(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[11px] text-faint">
            {t('challengeStarts')}
            <input className={input} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </label>
          <label className="text-[11px] text-faint">
            {t('challengeEnds')}
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
          {pending ? t('challengePublishing') : t('challengeCreateCta')}
        </button>
      </div>
    </div>
  );
}
