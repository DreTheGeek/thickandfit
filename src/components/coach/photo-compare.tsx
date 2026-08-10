'use client';

import { useMemo, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';

export type ComparePhoto = { url: string; on: string; pose: string | null; weightKg: number | null };

/**
 * Before and after, side by side.
 *
 * We store 2,289 progress photos across 245 clients, some going back to March 2024, and the only
 * way to see them was a reverse-chronological thumbnail grid. A grid shows a coach that photos
 * exist. It does not show her the thing the photos are FOR, which is the distance between two dates.
 * Shelise has 177 of them spanning 22 months and no way to put the first beside the last.
 *
 * Defaults to the widest span available (oldest vs newest) because that is the comparison a coach
 * reaches for first, then lets her move either end. The caption states the elapsed time and, when
 * both photos carry a weight, the change: the number is the evidence, the photo is the proof.
 */
export function PhotoCompare({
  photos,
  locale,
}: {
  photos: readonly ComparePhoto[];
  locale: string;
}): ReactElement | null {
  const t = useTranslations('app.coach');

  // Oldest first for the pickers, so the "before" dropdown reads like a timeline.
  const ordered = useMemo(() => [...photos].sort((a, b) => a.on.localeCompare(b.on)), [photos]);
  const [beforeIdx, setBeforeIdx] = useState(0);
  const [afterIdx, setAfterIdx] = useState(Math.max(0, ordered.length - 1));

  // Two photos are the minimum for a comparison; with one, the grid below already says everything.
  if (ordered.length < 2) return null;

  const before = ordered[Math.min(beforeIdx, ordered.length - 1)];
  const after = ordered[Math.min(afterIdx, ordered.length - 1)];

  const fmt = (d: string): string =>
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(
      new Date(`${d}T00:00:00`),
    );

  const days = Math.round(
    (Date.parse(`${after.on}T00:00:00Z`) - Date.parse(`${before.on}T00:00:00Z`)) / 86_400_000,
  );
  const weightDelta =
    before.weightKg != null && after.weightKg != null ? after.weightKg - before.weightKg : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {[
          { photo: before, idx: beforeIdx, set: setBeforeIdx, label: t('compareBefore') },
          { photo: after, idx: afterIdx, set: setAfterIdx, label: t('compareAfter') },
        ].map((side) => (
          <div key={side.label} className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">{side.label}</span>
            <a href={side.photo.url} target="_blank" rel="noreferrer" className="tf-press block overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={side.photo.url}
                alt={`${side.label} ${fmt(side.photo.on)}`}
                className="aspect-[3/4] w-full object-cover"
                loading="lazy"
              />
            </a>
            <select
              value={side.idx}
              onChange={(e) => side.set(Number(e.target.value))}
              aria-label={side.label}
              className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-[12px] outline-none focus:border-ink"
            >
              {ordered.map((p, i) => (
                <option key={`${p.url}-${i}`} value={i}>
                  {fmt(p.on)}
                  {p.weightKg != null ? ` · ${p.weightKg.toFixed(1)} kg` : ''}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Only stated when it is true: days apart is always knowable, a weight change is not, and an
          invented zero would read as "no progress" rather than "we did not weigh her that day". */}
      <p className="text-[12px] text-muted">
        {days > 0 ? t('compareApart', { days }) : t('compareSameDay')}
        {weightDelta != null && (
          <span className={weightDelta <= 0 ? 'text-good-ink' : 'text-ink'}>
            {' · '}
            {weightDelta >= 0 ? '+' : ''}
            {weightDelta.toFixed(1)} kg
          </span>
        )}
      </p>
    </div>
  );
}
