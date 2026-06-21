'use client';
// Route-level error boundary for the coach CRM. loadClientRows and other coach loaders throw on a
// failed read; this catches them with the bilingual ErrorState + retry instead of Next's default.
import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { ErrorState } from '@/components/states/error-state';

export default function CoachError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  useEffect(() => {
    console.error('coach segment error:', error.message);
  }, [error]);
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8">
      <ErrorState onRetry={reset} />
    </div>
  );
}
