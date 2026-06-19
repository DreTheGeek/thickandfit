// Empty state. Presentational (server-safe).
import type { ReactElement, ReactNode } from 'react';

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <h3 className="text-xl font-semibold text-ink">{title}</h3>
      {message ? <p className="max-w-sm text-sm text-muted">{message}</p> : null}
      {action}
    </div>
  );
}
