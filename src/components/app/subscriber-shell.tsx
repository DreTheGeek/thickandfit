import type { ReactElement, ReactNode } from 'react';
import { BottomNav } from '@/components/nav/bottom-nav';
import { SubscriberRail } from '@/components/nav/subscriber-rail';
import { SubscriberTopBar } from '@/components/notifications/subscriber-topbar';
import { CaptureFab } from '@/components/app/capture-fab';
import { SupportWidget } from '@/components/support/support-widget';
import { resolveAuth } from '@/lib/auth/session';
import { getUnreadCount } from '@/lib/notifications/queries';

/**
 * Responsive subscriber app shell.
 * - phone / tablet: a centered app column with a top bar (notification bell) and the bottom nav.
 * - lg+ (desktop): a left nav rail (with the bell) beside a wider content surface.
 */
export async function SubscriberShell({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  const auth = await resolveAuth();
  const profileId = auth?.userId ?? '';
  const unread = profileId ? await getUnreadCount(profileId) : 0;

  return (
    <div className="flex min-h-screen justify-center bg-bg">
      <SubscriberRail initialUnread={unread} profileId={profileId} />
      <div className="flex min-h-screen w-full max-w-[520px] flex-col bg-surface shadow-[0_0_50px_rgba(0,0,0,0.04)] lg:max-w-[760px] lg:border-x lg:border-line lg:shadow-none">
        <SubscriberTopBar initialUnread={unread} profileId={profileId} />
        <main className="tf-scroll flex-1">{children}</main>
        <BottomNav />
        <CaptureFab />
      </div>
      <SupportWidget />
    </div>
  );
}
