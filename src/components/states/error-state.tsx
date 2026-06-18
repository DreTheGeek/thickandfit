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
    <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <h3 className="text-xl font-semibold text-black">Something went wrong</h3>
      <p className="max-w-sm text-sm text-neutral-600">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-none bg-black px-5 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
