import type { ReactElement, ReactNode } from 'react';

/** Small uppercase eyebrow label. */
export function Eyebrow({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div
      className={[
        'text-[11px] font-semibold uppercase tracking-[2px] text-faint',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

/** Big screen title in Gulams (e.g. "Activities", "Nutrition"). */
export function PageTitle({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <h1 className={['tf-display text-[30px]', className].join(' ')}>{children}</h1>
  );
}

/** Section heading in Gulams with an optional trailing action. */
export function SectionTitle({
  action,
  className = '',
  children,
}: {
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className={['flex items-center justify-between', className].join(' ')}>
      <span className="tf-display text-[22px]">{children}</span>
      {action != null && (
        <span className="text-[12px] font-semibold text-muted">{action}</span>
      )}
    </div>
  );
}
