'use client';
// Error state with optional retry. Interactive, so it is a Client Component.
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';

export function ErrorState({
  message = 'Something went wrong. Please try again.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="h-1 w-12 bg-ink" />
      <h3 className="tf-display text-[28px] text-ink">Something went wrong</h3>
      <p className="max-w-sm text-sm text-muted">{message}</p>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
