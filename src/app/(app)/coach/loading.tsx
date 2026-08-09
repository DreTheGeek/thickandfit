import type { ReactElement } from 'react';
import { Skeleton } from '@/components/states/skeleton';

// Route-level loading fallback for the coach CRM. Heavy pages (clients, overview) await several
// queries before first byte; this paints the shell immediately instead of a blank screen.
export default function CoachLoading(): ReactElement {
  return (
    <div>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-6 h-12" />
      <Skeleton className="mt-3 h-64 rounded-2xl" />
    </div>
  );
}
