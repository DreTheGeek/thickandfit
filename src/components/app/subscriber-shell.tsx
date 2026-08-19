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
    // tf-portal is the 8.0 subscriber theme scope. It re-points the --c-* tokens the whole app
    // already reads, so every screen below re-themes with no component edits, and nothing outside
    // this subtree (coach console, admin portal) can be reached by it. See globals.css.
    <div className="tf-portal flex min-h-screen justify-center bg-bg">
      <SubscriberRail initialUnread={unread} profileId={profileId} />
      <div className="flex min-h-screen w-full max-w-[520px] flex-col bg-bg lg:max-w-[760px] lg:border-x lg:border-line">
        <SubscriberTopBar initialUnread={unread} profileId={profileId} />
        <main className="tf-scroll flex-1">{children}</main>
        <BottomNav />
        <CaptureFab />
      </div>
      <SupportWidget />
    </div>
  );
}
