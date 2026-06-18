'use client';
// Error state with optional retry. Interactive, so it is a Client Component.
export function ErrorState({
  message = 'Something went wrong. Please try again.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="h-1 w-12 bg-olive" />
      <h3 className="font-display text-3xl uppercase leading-none text-ink">Something went wrong</h3>
      <p className="max-w-sm text-sm text-neutral-500">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="bg-olive px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-black transition hover:bg-olive-600"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
