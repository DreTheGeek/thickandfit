// First-run state (new user, nothing created yet). Presentational (server-safe).
import type { ReactNode } from 'react';

export function FirstRunState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <h2 className="text-2xl font-bold uppercase tracking-tight text-black">{title}</h2>
      {message ? <p className="max-w-md text-sm text-neutral-600">{message}</p> : null}
      {action}
    </div>
  );
}
