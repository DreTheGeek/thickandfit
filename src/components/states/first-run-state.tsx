// First-run state (new user, nothing created yet). Presentational (server-safe).
import type { ReactElement, ReactNode } from 'react';

export function FirstRunState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-16 text-center">
      <div className="h-1 w-12 bg-ink" />
      <h2 className="tf-display text-[40px] text-ink">{title}</h2>
      {message ? <p className="max-w-md text-sm text-muted">{message}</p> : null}
      {action}
    </div>
  );
}
