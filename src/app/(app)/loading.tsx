import type { ReactElement } from 'react';
import { Skeleton } from '@/components/states/skeleton';

// Route-level loading fallback for the subscriber app: paints a skeleton immediately while the
// server component's data resolves, instead of a blank screen.
export default function AppLoading(): ReactElement {
  return (
    <div className="px-[22px] py-8">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-5 h-36 rounded-2xl" />
      <Skeleton className="mt-5 h-14" />
      <Skeleton className="mt-3 h-14" />
    </div>
  );
}
