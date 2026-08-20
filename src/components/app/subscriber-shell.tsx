import type { ReactElement, ReactNode } from 'react';
import { BottomNav } from '@/components/nav/bottom-nav';
import { SubscriberRail } from '@/components/nav/subscriber-rail';
import { SubscriberTopBar } from '@/components/notifications/subscriber-topbar';
import { ScrollReset } from '@/components/app/scroll-reset';
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
    // A REAL APP SHELL: the frame is exactly the viewport and only <main> scrolls.
    //
    // This was `min-h-screen` on both, which is why the bottom bar moved. `tf-scroll` already said
    // `overflow-y: auto` and it never engaged: a flex-1 child of a column with no bounded height
    // simply grows to fit its content, so nothing ever overflowed and the whole PAGE scrolled
    // instead. On any screen taller than the viewport the nav scrolled away with it.
    //
    // The contract pins `.bottom-nav` with `position: absolute; bottom: 0` inside a fixed phone
    // frame. Bounding the column is the same thing without taking the nav out of flow, so it keeps
    // its own height in the layout and content cannot slide underneath it.
    //
    // 100dvh, not 100vh: on iOS Safari 100vh is the height WITHOUT the address bar, so a fixed
    // frame is ~60px taller than the visible area and the nav sits just below the fold until the
    // bar retracts. dvh tracks the bar. That matters most in exactly the mode this is for.
    <div className="tf-portal flex h-[100dvh] justify-center overflow-hidden bg-bg">
      <SubscriberRail initialUnread={unread} profileId={profileId} />
      <div className="relative flex h-full w-full max-w-[520px] flex-col bg-bg lg:max-w-[760px] lg:border-x lg:border-line">
        <SubscriberTopBar initialUnread={unread} profileId={profileId} />
        <main className="tf-scroll flex-1 overscroll-contain">{children}</main>
        <BottomNav />
        <CaptureFab />
        <ScrollReset />
      </div>
      <SupportWidget />
    </div>
  );
}
