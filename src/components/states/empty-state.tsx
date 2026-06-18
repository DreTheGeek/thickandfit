// Empty state. Presentational (server-safe).
import type { ReactNode } from 'react';

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <h3 className="text-xl font-semibold text-black">{title}</h3>
      {message ? <p className="max-w-sm text-sm text-neutral-600">{message}</p> : null}
      {action}
    </div>
  );
}
