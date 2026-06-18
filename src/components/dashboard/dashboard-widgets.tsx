'use client';
// Subscriber dashboard widgets with all four UI states: loading, error (recoverable),
// first-run (no onboarding), and content.
import { useState } from 'react';
import { Skeleton } from '@/components/states/skeleton';
import { ErrorState } from '@/components/states/error-state';
import { FirstRunState } from '@/components/states/first-run-state';
import type { DashboardSummary } from '@/lib/dashboard/summary';

const card = 'border border-neutral-200 p-5';

export function DashboardWidgets({ initial }: { initial: DashboardSummary | null }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(initial);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>(initial ? 'idle' : 'error');

  async function refresh() {
    setState('loading');
    try {
      const res = await fetch('/api/dashboard/summary');
      const json = await res.json().catch(() => null);
      if (res.ok && json?.data) {
        setSummary(json.data);
        setState('idle');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  if (state === 'loading') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  if (state === 'error' || !summary) {
    return <ErrorState onRetry={refresh} />;
  }

  if (!summary.hasOnboarded) {
    return (
      <FirstRunState
        title="Build your plan"
        message="Answer a few questions to get your custom macros and a program that fits your life."
        action={
          <a href="/onboarding" className="rounded-none bg-black px-6 py-3 text-sm font-medium text-white">
            Start onboarding
          </a>
        }
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className={card}>
        <p className="text-xs uppercase tracking-widest text-neutral-500">Today&apos;s macros</p>
        {summary.macros ? (
          <p className="mt-2 text-lg">
            <strong>{summary.macros.calories}</strong> kcal · P{summary.macros.protein_g} C
            {summary.macros.carbs_g} F{summary.macros.fat_g} g
          </p>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">Complete onboarding to set your targets.</p>
        )}
      </div>

      <div className={card}>
        <p className="text-xs uppercase tracking-widest text-neutral-500">Today&apos;s workout</p>
        <p className="mt-2 text-sm text-neutral-500">
          {summary.todaysWorkout ? summary.todaysWorkout.name : 'No workout scheduled yet.'}
        </p>
      </div>

      <div className={card}>
        <p className="text-xs uppercase tracking-widest text-neutral-500">Streak</p>
        <p className="mt-2 text-3xl font-bold">{summary.streak}</p>
      </div>

      <div className={card}>
        <p className="text-xs uppercase tracking-widest text-neutral-500">Recent activity</p>
        {summary.recentActivity.length ? (
          <ul className="mt-2 text-sm">
            {summary.recentActivity.map((a, i) => (
              <li key={i}>{a.label}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">Your activity will show up here.</p>
        )}
      </div>
    </div>
  );
}
