import type { ReactElement, ReactNode } from 'react';

type BadgeVariant =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'cancelled'
  | 'legacy'
  | 'accent';

const BADGE: Record<BadgeVariant, string> = {
  active: 'bg-ink text-bg',
  inactive: 'bg-line text-soft',
  pending: 'bg-pending text-pending-ink',
  cancelled: 'bg-alert text-alert-ink',
  legacy: 'bg-ink text-white',
  accent: 'bg-accent text-white', // live / positive / unread only
};

/** Filled status pill. */
export function Badge({
  variant = 'active',
  className = '',
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-3.5 py-[5px] text-[12px] font-semibold leading-none',
        BADGE[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}

/** Outline tag (uppercase), e.g. Premium / Base. */
export function Tag({
  outlined = true,
  className = '',
  children,
}: {
  outlined?: boolean;
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <span
      className={[
        'inline-flex items-center px-3 py-1 text-[11px] font-semibold uppercase leading-none tracking-[1px]',
        outlined ? 'border border-ink text-ink' : 'border border-line text-muted',
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}

/** Small round count chip (unread/notifications). Accent = positive/live. */
export function CountChip({
  tone = 'accent',
  children,
}: {
  tone?: 'accent' | 'muted';
  children: ReactNode;
}): ReactElement {
  return (
    <span
      className={[
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white',
        tone === 'accent' ? 'bg-accent' : 'bg-muted',
      ].join(' ')}
    >
      {children}
    </span>
  );
}
