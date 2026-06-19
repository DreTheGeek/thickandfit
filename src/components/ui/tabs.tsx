'use client';

import type { ReactElement } from 'react';

export type TabOption<T extends string> = { value: T; label: string };

/** Underline tab row (active: bold + 2px ink underline). Controlled. */
export function UnderlineTabs<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: ReadonlyArray<TabOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}): ReactElement {
  return (
    <div
      className={['flex gap-6 border-b border-line', className].join(' ')}
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
              'tf-press -mb-px cursor-pointer pb-3 text-[14px]',
              active
                ? 'border-b-2 border-ink font-semibold text-ink'
                : 'text-faint',
            ].join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
