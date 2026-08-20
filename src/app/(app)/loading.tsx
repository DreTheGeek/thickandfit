import type { ReactElement } from 'react';
import { Skeleton } from '@/components/states/skeleton';
import { Wordmark } from '@/components/ui/wordmark';

// Route-level loading fallback for the subscriber app: paints a skeleton immediately while the
// server component's data resolves, instead of a blank screen. Her wordmark sits faint on top so the
// brand is present even mid-load (dark:invert keeps the black mark visible on the dark theme).
export default function AppLoading(): ReactElement {
  return (
    <div className="px-[22px] py-8">
      {/* `dark:invert` was dead code here: the dark variant is defined as [data-theme="dark"] and
          the member portal is a CLASS scope (.tf-portal) that never sets it, so the black wordmark
          sat invisible on black. This route serves BOTH shells, member (dark) and coach (light), so
          the tone cannot be a static prop; the variant follows the theme attribute on <html>. */}
      <Wordmark height={18} className="mb-6 opacity-25 [[data-portal-theme='dark']_&]:invert" />
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-5 h-36 rounded-2xl" />
      <Skeleton className="mt-5 h-14" />
      <Skeleton className="mt-3 h-14" />
    </div>
  );
}
