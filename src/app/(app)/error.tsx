'use client';
// Route-level error boundary for the subscriber app. A thrown server data loader (e.g. a Supabase
// read failure) now lands on the app's bilingual ErrorState with a retry, not Next's default screen.
import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { ErrorState } from '@/components/states/error-state';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  useEffect(() => {
    console.error('app segment error:', error.message);
  }, [error]);
  return (
    <div className="px-[22px] py-10">
      <ErrorState onRetry={reset} />
    </div>
  );
}
