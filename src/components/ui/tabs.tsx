'use client';

import type { ReactElement } from 'react';

export type TabOption<T extends string> = {
  value: T;
  label: string;
  /**
   * Per-tab utility classes, for a tab that only exists at some widths.
   *
   * The client page pins the conversation to a rail from xl up, so its Messages tab is `xl:hidden`:
   * one place for the thread at every size, no duplicate. Done in CSS rather than by measuring the
   * viewport in JS, because a matchMedia check renders the tab on the server and then removes it on
   * hydration, which the coach sees as a tab flickering out from under the cursor.
   */
  className?: string;
};

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
  // Scroll rather than squeeze. A flex row with nine tabs in it will happily shrink each button
  // until its label wraps to two lines ("Health & Progress" did exactly that on the client detail
  // page), which reads as broken. shrink-0 + nowrap keeps every label on one line and lets the
  // strip scroll sideways when the container is genuinely too narrow, which is the standard tab
  // behaviour on a phone anyway. tf-scroll hides the scrollbar itself.
  return (
    <div
      className={['tf-scroll flex gap-6 overflow-x-auto border-b border-line', className].join(' ')}
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
              'tf-press -mb-px shrink-0 cursor-pointer whitespace-nowrap pb-3 text-[14px]',
              active
                ? 'border-b-2 border-ink font-semibold text-ink'
                : 'text-faint',
              opt.className ?? '',
            ].join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
