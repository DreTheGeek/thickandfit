// Loading state. Presentational (server-safe).
import type { ReactElement } from 'react';

export function Skeleton({ className = '' }: { className?: string }): ReactElement {
  return (
    <div aria-hidden="true" className={`animate-pulse rounded-xl bg-warm ${className}`} />
  );
}
