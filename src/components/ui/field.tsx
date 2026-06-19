import type {
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';

const CONTROL =
  'w-full border border-line bg-surface px-3.5 py-3 text-[14px] text-ink placeholder:text-faint outline-none focus:border-ink';

/** Eyebrow label for a field. */
export function FieldLabel({ children }: { children: ReactNode }): ReactElement {
  return (
    <span className="mb-2.5 block text-[13px] font-semibold uppercase tracking-[1px] text-ink">
      {children}
    </span>
  );
}

type InputProps = {
  label?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>;

export function Input({
  label,
  className = '',
  ...rest
}: InputProps): ReactElement {
  return (
    <label className="block">
      {label != null && <FieldLabel>{label}</FieldLabel>}
      <input className={[CONTROL, className].join(' ')} {...rest} />
    </label>
  );
}

type TextareaProps = {
  label?: ReactNode;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({
  label,
  className = '',
  ...rest
}: TextareaProps): ReactElement {
  return (
    <label className="block">
      {label != null && <FieldLabel>{label}</FieldLabel>}
      <textarea
        className={[CONTROL, 'min-h-20 resize-y', className].join(' ')}
        {...rest}
      />
    </label>
  );
}
