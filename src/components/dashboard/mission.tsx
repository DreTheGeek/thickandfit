'use client';
// Today's mission: the identity framing from .planning/POSITIONING-IDENTITY.md. The screen should
// open on "here is your day and how much of it you own", not on a number.
//
// The four daily pillars are TRAIN / FUEL / MOVE / RECOVER, matching the marketing. Move (steps) and
// Recover (sleep) are self-reported for now (no wearable sync yet): tapping the row opens a quick
// entry sheet that writes daily_metrics. TRAIN and FUEL derive from the assigned workout and the food
// diary; HABITS still appears when the member has habits set. Nothing is invented: an unlogged Move
// or Recover row reads "Log your steps / sleep" rather than a fake value.
import { useState, useTransition, type ReactElement } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icons';
import { logDailyMetricAction } from '@/lib/dailymetrics/actions';

export type MissionItem = {
  key: 'train' | 'fuel' | 'habits' | 'checkin' | 'move' | 'recover';
  label: string;
  detail: string;
  /** Navigate here on tap. Omitted for capture rows. */
  href?: string;
  /** When set, the row opens the quick-entry sheet instead of navigating. */
  capture?: 'steps' | 'sleep';
  done: boolean;
};

const ICONS: Record<MissionItem['key'], IconName> = {
  train: 'dumbbell',
  fuel: 'nutrition',
  habits: 'check',
  checkin: 'ruler',
  move: 'steps',
  recover: 'pulse',
};

function Row({ item }: { item: MissionItem }): ReactElement {
  return (
    <>
      <span
        className={[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          item.done ? 'bg-accent text-accent-ink' : 'bg-surface text-muted',
        ].join(' ')}
      >
        <Icon name={ICONS[item.key]} size={18} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[11px] font-semibold uppercase tracking-[1.4px] text-faint">
          {item.label}
        </span>
        <span className="block truncate text-[14px] font-semibold text-ink">{item.detail}</span>
      </span>
      {item.done ? (
        <span className="shrink-0 text-accent">
          <Icon name="check" size={18} strokeWidth={3} />
        </span>
      ) : (
        <span className="shrink-0 text-faint">
          <Icon name={item.capture ? 'plus' : 'chevronRight'} size={18} />
        </span>
      )}
    </>
  );
}

const ROW_CLASS =
  'tf-press flex w-full items-center gap-3.5 rounded-2xl bg-warm/60 px-4 py-3 hover:bg-warm';

/** Bottom sheet: enter steps or last night's sleep, save to daily_metrics, refresh the mission. */
function CaptureSheet({ kind, onClose }: { kind: 'steps' | 'sleep'; onClose: () => void }): ReactElement {
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
      const res = await logDailyMetricAction({ kind: kind === 'steps' ? 'steps' : 'sleep', value });
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

export function Mission({
  items,
  title,
  weekLine,
  evolutionHref,
  evolutionLabel,
}: {
  items: MissionItem[];
  title: string;
  weekLine: string | null;
  /** When set, the week line becomes the front door to the Evolution timeline. */
  evolutionHref?: string;
  evolutionLabel?: string;
}): ReactElement | null {
  const [capture, setCapture] = useState<'steps' | 'sleep' | null>(null);

  if (items.length === 0) return null;

  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);

  return (
    <Card className="p-[22px]">
      <div className="flex items-end justify-between gap-4">
        <p className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">{title}</p>
        <p className="tf-display text-[26px] leading-none text-accent">{pct}%</p>
      </div>

      <div className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-warm">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-5 flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item.key}>
            {item.capture ? (
              <button type="button" onClick={() => setCapture(item.capture ?? null)} className={ROW_CLASS}>
                <Row item={item} />
              </button>
            ) : (
              <Link href={item.href ?? '#'} className={ROW_CLASS}>
                <Row item={item} />
              </Link>
            )}
          </li>
        ))}
      </ul>

      {weekLine ? (
        evolutionHref ? (
          <Link
            href={evolutionHref}
            className="tf-press mt-5 flex items-center justify-between gap-3 border-t border-divider pt-4"
          >
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[2px] text-faint">
                {weekLine}
              </span>
              {evolutionLabel ? (
                <span className="mt-0.5 block truncate text-[13px] font-semibold text-ink">
                  {evolutionLabel}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-faint">
              <Icon name="chevronRight" size={18} />
            </span>
          </Link>
        ) : (
          <div className="mt-5 border-t border-divider pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">{weekLine}</p>
          </div>
        )
      ) : null}

      {capture && <CaptureSheet kind={capture} onClose={() => setCapture(null)} />}
    </Card>
  );
}
