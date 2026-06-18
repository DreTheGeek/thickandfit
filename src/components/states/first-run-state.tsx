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
    <div className="flex flex-col items-center justify-center gap-5 py-16 text-center">
      <div className="h-1 w-12 bg-olive" />
      <h2 className="font-display text-4xl uppercase leading-none text-ink sm:text-5xl">{title}</h2>
      {message ? <p className="max-w-md text-sm text-neutral-500">{message}</p> : null}
      {action}
    </div>
  );
}
