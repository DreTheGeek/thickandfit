import type { ReactElement, ReactNode } from 'react';
import { BottomNav } from '@/components/nav/bottom-nav';
import { SubscriberRail } from '@/components/nav/subscriber-rail';

/**
 * Responsive subscriber app shell.
 * - phone / tablet: a centered app column with the bottom nav.
 * - lg+ (desktop): a left nav rail beside a wider content surface (bottom nav hides).
 */
export function SubscriberShell({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <div className="flex min-h-screen justify-center bg-bg">
      <SubscriberRail />
      <div className="flex min-h-screen w-full max-w-[520px] flex-col bg-surface shadow-[0_0_50px_rgba(0,0,0,0.04)] lg:max-w-[760px] lg:border-x lg:border-line lg:shadow-none">
        <main className="tf-scroll flex-1">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
