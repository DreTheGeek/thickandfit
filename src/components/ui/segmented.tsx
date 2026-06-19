'use client';

import type { ReactElement } from 'react';

export type SegmentedOption<T extends string> = { value: T; label: string };

/**
 * Pill segmented control (track on warm grey, active segment near-black).
 * Controlled: parent owns the value.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}): ReactElement {
  return (
    <div
      className={['inline-flex rounded-full bg-warm p-1', className].join(' ')}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={[
              'tf-press cursor-pointer rounded-full px-4 py-2 text-[12px] uppercase tracking-[1px]',
              active ? 'bg-ink text-white' : 'text-faint',
            ].join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
