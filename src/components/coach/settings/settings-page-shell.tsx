'use client';
// Header and save affordance shared by both settings screens.
//
// The Save button is disabled until something changes, which is the whole reason the draft hook
// tracks a baseline. It sticks to the top of the scroll area because these pages are long: a save
// button that scrolls off after the third section is a save button that gets forgotten.
//
// WIDTH. These two screens are forms, and a form is not a dashboard. .tf-coach-page caps the console
// at 1720px, which is right for a client table and wrong here: measured at 1920 before this cap, the
// label text ended at x=620 and its switch sat at x=1792, so reading one row meant crossing 1172px of
// nothing and the rows above and below were equally plausible targets.
//
// 880px is not a taste number, it is the row's own content added up: the text column at its reading
// measure (.tf-measure resolves to 558px here), the 32px gap, the widest control (a 230px select),
// and the card's 24px padding on each side. Nothing spare, and no column is squeezed.
//
// A short label still leaves space before its switch, and that is the intended layout, not slack:
// right-aligned controls are what makes a long toggle list scannable down one edge. See the
// placement note in settings-rows.tsx. The bug was the SIZE of that space, not its existence.
//
// /coach/settings already caps itself at max-w-3xl, so a settings screen naming its own measure is
// the convention in this portal rather than an exception to the container rule.
import type { ReactElement, ReactNode } from 'react';

export function SettingsPageShell({
  title,
  subtitle,
  saveLabel,
  savingLabel,
  isDirty,
  isBusy,
  message,
  onSave,
  children,
}: {
  title: string;
  subtitle: string;
  saveLabel: string;
  savingLabel: string;
  isDirty: boolean;
  isBusy: boolean;
  message: { ok: boolean; text: string } | null;
  onSave: () => void;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="mx-auto w-full max-w-[880px]">
      <div className="sticky top-0 z-20 -mx-5 mb-6 border-b border-line bg-bg/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div className="min-w-0">
            <h1 className="tf-display text-[26px] leading-tight sm:text-[30px]">{title}</h1>
            <p className="tf-measure mt-1.5 text-[13px] leading-relaxed text-soft">{subtitle}</p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end">
            <button
              type="button"
              onClick={onSave}
              disabled={!isDirty || isBusy}
              className="tf-press rounded-xl bg-ink px-5 py-2.5 text-[13px] font-semibold text-surface disabled:opacity-40"
            >
              {isBusy ? savingLabel : saveLabel}
            </button>
            {message ? (
              <p
                role="status"
                className={`text-[12px] font-medium ${message.ok ? 'text-accent-ink' : 'text-alert-ink'}`}
              >
                {message.text}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 pb-16">{children}</div>
    </div>
  );
}
