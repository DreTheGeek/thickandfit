// Loading state. Presentational (server-safe). Zero-radius per design doctrine.
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-none bg-neutral-200 ${className}`}
    />
  );
}
