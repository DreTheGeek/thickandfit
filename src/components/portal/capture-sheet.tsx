'use client';
// Quick entry for steps and last night's sleep, writing daily_metrics.
//
// Lifted out of dashboard/mission.tsx, which the 8.0 Today re-skin orphaned. PlanCard replaced the
// mission list and rendered MOVE and RECOVER as read-only rows, so the only way a member had to
// enter either number went with it: nothing imported mission.tsx any more, and no check noticed,
// because a component that is never rendered still type-checks and still lints.
//
// The whole stack behind this already existed and still does. daily_metrics (0088) has RLS, a
// unique key on (company, member, day) and value bounds; logDailyMetricAction validates, writes the
// member's LOCAL day and revalidates /dashboard; getDailyMetrics is already read on every dashboard
// load. Only the input was missing.
//
// Why manual entry rather than waiting for HealthKit: the sync is the layer that can be absent, not
// this one. HealthKit works only inside the iOS shell, and a Latin-American audience is heavily
// Android, so a self-reported number is the floor a sync sits on top of rather than a stand-in for
// it. daily_metrics.source already carries 'manual' and is documented as the seam where 'healthkit'
// joins later without a schema change.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { logDailyMetricAction } from '@/lib/dailymetrics/actions';

export type CaptureKind = 'steps' | 'sleep';

export function CaptureSheet({
  kind,
  onClose,
}: {
  kind: CaptureKind;
  onClose: () => void;
}): ReactElement {
  const t = useTranslations('app.today');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [steps, setSteps] = useState('');
  const [hours, setHours] = useState('');
  const [mins, setMins] = useState('');
  const [err, setErr] = useState(false);

  const save = (): void => {
    let value: number;
    if (kind === 'steps') {
      value = Math.round(Number(steps));
      if (!Number.isFinite(value) || value < 0 || steps.trim() === '') return setErr(true);
    } else {
      const h = Number(hours || 0);
      const m = Number(mins || 0);
      value = Math.round(h * 60 + m);
      if (!Number.isFinite(value) || value <= 0) return setErr(true);
    }
    setErr(false);
    start(async () => {
      const res = await logDailyMetricAction({ kind, value });
      if (res.ok) {
        router.refresh();
        onClose();
      } else setErr(true);
    });
  };

  const inputClass =
    'mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] outline-none focus:border-ink';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-surface p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg uppercase tracking-tight">
            {kind === 'steps' ? t('moveTitle') : t('recoverTitle')}
          </h3>
          <button type="button" onClick={onClose} aria-label={t('cancel')} className="tf-press text-faint">
            <Icon name="x" size={18} />
          </button>
        </div>

        {kind === 'steps' ? (
          <label className="block text-[12px] font-medium text-soft">
            {t('moveLabel')}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder="8000"
              autoFocus
              className={inputClass}
            />
          </label>
        ) : (
          <div className="flex gap-3">
            <label className="flex-1 text-[12px] font-medium text-soft">
              {t('recoverHours')}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={14}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="7"
                autoFocus
                className={inputClass}
              />
            </label>
            <label className="flex-1 text-[12px] font-medium text-soft">
              {t('recoverMinutes')}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                value={mins}
                onChange={(e) => setMins(e.target.value)}
                placeholder="30"
                className={inputClass}
              />
            </label>
          </div>
        )}

        {err && <p className="mt-2 text-[12px] text-alert-ink">{t('captureError')}</p>}

        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="tf-press mt-4 w-full rounded-xl bg-ink px-4 py-3 text-[14px] font-semibold text-surface disabled:opacity-40"
        >
          {pending ? t('captureSaving') : t('captureSave')}
        </button>
      </div>
    </div>
  );
}
