'use client';
// The row vocabulary both settings screens are built from.
//
// There are around forty rows across the two screens. Hand-rolling each one is how the fifth toggle
// ends up 2px taller than the fourth and the ninth hint turns grey while the others are black, so
// every row shape lives here exactly once: section, toggle, select, text, number, checkbox group,
// chips, and the indented reveal a toggle can open underneath itself.
//
// Rules these components encode, so a caller cannot get them wrong:
//   - the control is always the last thing in the row, right-aligned, and never wraps under the label
//   - the hint is optional and always sits under the label, in the reading measure, never beside it
//   - green appears on exactly one thing: a switch that is ON. It is state, not decoration
//   - every control is labelled for a screen reader even when the visible label is a sibling node
import { useId, useState, type ReactElement, type ReactNode } from 'react';

// ---------------------------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------------------------

/** A titled card. Rows inside it are separated by hairlines, not by gaps. */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-3.5 sm:px-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">{title}</h2>
        {description ? <p className="tf-measure mt-1.5 text-[13px] leading-relaxed text-soft">{description}</p> : null}
      </div>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

/**
 * The indented area a toggle reveals when it is on.
 *
 * Rendered inside the parent row's own cell rather than as a sibling row, so the relationship reads
 * as "these belong to the switch above" instead of "here are four more unrelated settings".
 */
export function SettingsSubGroup({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="mt-4 flex flex-col gap-4 border-l-2 border-line pl-4 sm:pl-5">{children}</div>
  );
}

// ---------------------------------------------------------------------------------------------
// Row scaffolding
// ---------------------------------------------------------------------------------------------

/**
 * "Saved, but nothing acts on it yet."
 *
 * Only used on the rows whose feature does not exist in the product today. A settings screen that
 * silently records a preference nothing reads is worse than no screen: the coach flips the switch,
 * believes her clients are being reminded, and finds out from a client that they were not.
 *
 * Deliberately QUIET: a flat warm chip in muted ink, no status colour and no outline. Two thirds of
 * the rows on the first screen carry one of these. In the pending yellow the page read as a defect
 * list rather than as her settings, and with a hairline border it read as an empty input on a phone.
 * It is a footnote, not a warning.
 */
export function PendingTag({ label }: { label: string }): ReactElement {
  return (
    <span className="inline-block rounded-full bg-warm px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.5px] text-muted">
      {label}
    </span>
  );
}

function RowShell({
  label,
  hint,
  htmlFor,
  control,
  below,
  pending,
  placement = 'responsive',
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  control?: ReactNode;
  below?: ReactNode;
  pending?: string;
  /**
   * 'inline'     the control stays on the label's line at every width. For switches: a 48px switch
   *              fits beside a wrapping label even at 360px, and stacking it left-aligned underneath
   *              broke the scan-down-the-right-edge reading that makes a toggle list legible at all.
   * 'responsive' the control drops under the label on a phone. For selects and text fields, which
   *              need real width and would otherwise be squeezed into 120px next to a long label.
   */
  placement?: 'inline' | 'responsive';
}): ReactElement {
  const layout =
    placement === 'inline'
      ? 'flex items-start justify-between gap-4 sm:gap-8'
      : 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-8';
  return (
    <div className="border-b border-divider px-5 py-4 last:border-0 sm:px-6">
      <div className={layout}>
        <div className="min-w-0">
          <label htmlFor={htmlFor} className="block text-[14px] font-medium leading-snug text-ink">
            {label}
          </label>
          {hint ? <p className="tf-measure mt-1 text-[13px] leading-relaxed text-soft">{hint}</p> : null}
          {pending ? <div className="mt-2"><PendingTag label={pending} /></div> : null}
        </div>
        {control ? <div className="shrink-0 sm:pt-0.5">{control}</div> : null}
      </div>
      {below}
    </div>
  );
}

const CONTROL_CLS =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-ink disabled:opacity-40 sm:w-auto';

// ---------------------------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------------------------

/** The bare switch, without a row around it. Exported for the few places a row is the wrong shape. */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}): ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'tf-press relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40',
        // Green means ON. The only colour in the row, and it carries the state.
        checked ? 'bg-accent' : 'bg-line',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-1 h-5 w-5 rounded-full bg-surface transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  );
}

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
  pending,
  children,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Set when the preference is stored but nothing acts on it yet. See PendingTag. */
  pending?: string;
  /** Revealed under the row while the switch is on. */
  children?: ReactNode;
}): ReactElement {
  return (
    <RowShell
      label={label}
      hint={hint}
      pending={pending}
      placement="inline"
      control={<Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />}
      below={checked && children ? <SettingsSubGroup>{children}</SettingsSubGroup> : null}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------------------------

export type SelectOption<T extends string> = { value: T; label: string };

export function SelectRow<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  pending,
}: {
  label: string;
  hint?: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (next: T) => void;
  pending?: string;
}): ReactElement {
  const id = useId();
  return (
    <RowShell
      label={label}
      hint={hint}
      pending={pending}
      htmlFor={id}
      control={
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className={`${CONTROL_CLS} sm:min-w-[230px]`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      }
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------------------------

export function TextRow({
  label,
  hint,
  value,
  onChange,
  placeholder,
  maxLength = 120,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
}): ReactElement {
  const id = useId();
  return (
    <RowShell
      label={label}
      hint={hint}
      htmlFor={id}
      control={
        <input
          id={id}
          type="text"
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${CONTROL_CLS} placeholder:text-faint sm:min-w-[280px]`}
        />
      }
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Inline controls, for the reveal under a toggle where a full row would be too heavy
// ---------------------------------------------------------------------------------------------

/** Label plus an arbitrary control on one line. Used inside SettingsSubGroup. */
export function InlineField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <span className="text-[13px] font-medium text-ink sm:min-w-[190px]">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  label: string;
}): ReactElement {
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const n = Number(e.target.value);
        // Clamp here rather than on save. A coach who types 400 should see 60, not discover on save
        // that the number she is looking at is not the number that was written.
        if (!Number.isFinite(n)) return;
        onChange(Math.min(max, Math.max(min, Math.round(n))));
      }}
      className="w-20 rounded-xl border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-ink"
    />
  );
}

export function InlineSelect<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (next: T) => void;
  label: string;
}): ReactElement {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-xl border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-ink"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TimeInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
}): ReactElement {
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value || '18:00')}
      className="rounded-xl border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-ink"
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Checkbox group
// ---------------------------------------------------------------------------------------------

export type CheckboxItem = { key: string; label: string; checked: boolean };

/** A short list of independent yes/no choices. A switch each would read as six unrelated settings. */
export function CheckboxGroupRow({
  label,
  hint,
  items,
  onToggle,
  pending,
}: {
  label: string;
  hint?: string;
  items: readonly CheckboxItem[];
  onToggle: (key: string, next: boolean) => void;
  pending?: string;
}): ReactElement {
  return (
    <RowShell
      label={label}
      hint={hint}
      pending={pending}
      below={
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
          {items.map((item) => (
            <label key={item.key} className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => onToggle(item.key, e.target.checked)}
                className="h-4 w-4 accent-[var(--c-accent)]"
              />
              <span className="text-[13px] text-ink">{item.label}</span>
            </label>
          ))}
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Chips
// ---------------------------------------------------------------------------------------------

/**
 * A free-text list rendered as removable chips, with one-tap presets.
 *
 * Free text rather than a closed list on purpose: allergies and avoided ingredients are exactly the
 * fields where a fixed vocabulary fails a real client, and the presets cover the common answers so
 * the common case is still a tap.
 */
export function ChipsRow({
  label,
  hint,
  values,
  suggestions,
  placeholder,
  addLabel,
  removeLabel,
  emptyLabel,
  max,
  onChange,
  pending,
}: {
  label: string;
  hint?: string;
  values: string[];
  suggestions?: readonly { value: string; label: string }[];
  placeholder: string;
  addLabel: string;
  /** Builds the remove button's screen-reader label for one chip. */
  removeLabel: (item: string) => string;
  emptyLabel: string;
  max: number;
  onChange: (next: string[]) => void;
  pending?: string;
}): ReactElement {
  const id = useId();
  const [draft, setDraft] = useState('');

  const has = (v: string): boolean => values.some((x) => x.toLowerCase() === v.toLowerCase());

  const add = (raw: string): void => {
    const v = raw.trim();
    if (!v || v.length > 60 || values.length >= max || has(v)) return;
    onChange([...values, v]);
    setDraft('');
  };
  const remove = (v: string): void => onChange(values.filter((x) => x !== v));

  const unusedSuggestions = (suggestions ?? []).filter((s) => !has(s.label));

  return (
    <RowShell
      label={label}
      hint={hint}
      pending={pending}
      htmlFor={id}
      below={
        <div className="mt-3 flex flex-col gap-3">
          {values.length === 0 ? (
            <p className="text-[13px] text-faint">{emptyLabel}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {values.map((v) => (
                <li key={v} className="flex items-center gap-1.5 rounded-full bg-warm py-1.5 pl-3.5 pr-2 text-[13px] text-ink">
                  <span>{v}</span>
                  <button
                    type="button"
                    aria-label={removeLabel(v)}
                    onClick={() => remove(v)}
                    className="tf-press flex h-5 w-5 items-center justify-center rounded-full text-muted hover:text-ink"
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              id={id}
              type="text"
              value={draft}
              maxLength={60}
              placeholder={placeholder}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  add(draft);
                }
              }}
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-ink sm:max-w-[320px] sm:flex-none"
            />
            <button
              type="button"
              onClick={() => add(draft)}
              disabled={!draft.trim() || values.length >= max}
              className="tf-press rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-ink disabled:opacity-40"
            >
              {addLabel}
            </button>
          </div>

          {unusedSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {unusedSuggestions.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => add(s.label)}
                  disabled={values.length >= max}
                  className="tf-press rounded-full border border-dashed border-line px-3 py-1.5 text-[12px] text-muted hover:border-ink hover:text-ink disabled:opacity-40"
                >
                  + {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Danger zone
// ---------------------------------------------------------------------------------------------

/**
 * A destructive action that cannot fire on one click.
 *
 * The first press swaps the button for an explicit confirm and cancel pair. It is not a modal on
 * purpose: a modal over a long settings page hides the thing being described, and the confirm text
 * belongs next to the sentence that explains what is about to be removed.
 */
export function DangerRow({
  label,
  hint,
  actionLabel,
  confirmQuestion,
  confirmLabel,
  cancelLabel,
  busyLabel,
  busy,
  onConfirm,
  result,
}: {
  label: string;
  hint?: string;
  actionLabel: string;
  confirmQuestion: string;
  confirmLabel: string;
  cancelLabel: string;
  busyLabel: string;
  busy: boolean;
  onConfirm: () => void;
  result?: { ok: boolean; text: string } | null;
}): ReactElement {
  const [arming, setArming] = useState(false);

  return (
    <div className="px-5 py-4 sm:px-6">
      <p className="text-[14px] font-medium leading-snug text-ink">{label}</p>
      {hint ? <p className="tf-measure mt-1 text-[13px] leading-relaxed text-soft">{hint}</p> : null}

      {arming ? (
        <div className="mt-3.5 rounded-xl bg-alert p-4">
          <p className="text-[13px] font-medium leading-relaxed text-alert-ink">{confirmQuestion}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setArming(false);
                onConfirm();
              }}
              className="tf-press rounded-xl bg-alert-ink px-4 py-2.5 text-[13px] font-semibold text-surface disabled:opacity-40"
            >
              {busy ? busyLabel : confirmLabel}
            </button>
            <button
              type="button"
              onClick={() => setArming(false)}
              className="tf-press rounded-xl border border-alert-ink/30 px-4 py-2.5 text-[13px] font-semibold text-alert-ink"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => setArming(true)}
          className="tf-press mt-3.5 rounded-xl border border-alert-ink/40 px-4 py-2.5 text-[13px] font-semibold text-alert-ink disabled:opacity-40"
        >
          {busy ? busyLabel : actionLabel}
        </button>
      )}

      {result ? (
        <p className={`mt-3 text-[13px] font-medium ${result.ok ? 'text-accent-ink' : 'text-alert-ink'}`}>
          {result.text}
        </p>
      ) : null}
    </div>
  );
}
