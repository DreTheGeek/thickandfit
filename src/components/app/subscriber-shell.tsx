import type { ReactElement, ReactNode } from 'react';
import { BottomNav } from '@/components/nav/bottom-nav';

/**
 * Mobile-first subscriber app shell: a centered phone-width column on a neutral
 * canvas, scrolling content, and the fixed bottom nav (Today/Chat/Activities/
 * Nutrition/You). Mirrors the migrated client's current app for familiarity.
 */
export function SubscriberShell({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <div className="flex min-h-screen justify-center bg-bg">
      <div className="flex min-h-screen w-full max-w-[460px] flex-col bg-surface shadow-[0_0_50px_rgba(0,0,0,0.04)]">
        <main className="tf-scroll flex-1">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
