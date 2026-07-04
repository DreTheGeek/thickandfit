import type { ReactElement, ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { resolveAuth, COACH_ROLES } from '@/lib/auth/session';
import { SubscriberShell } from '@/components/app/subscriber-shell';
import { CoachShell } from '@/components/app/coach-shell';
import { TimezoneSync } from '@/components/app/timezone-sync';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { getUnreadCount } from '@/lib/notifications/queries';

// NOTE (paywall map): entitlement is enforced PER-PAGE via requireEntitled() on every training
// surface, not here - this layout only authenticates and picks the shell. A new (app) page MUST
// call requireEntitled/requireAuth/requireCoach itself (see src/lib/coach/system-map.ts).
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  const auth = await resolveAuth();
  if (!auth) redirect('/auth/sign-in');

  let shell: ReactNode;
  if (COACH_ROLES.includes(auth.role)) {
    // Coaches/operators get the notification bell too (physique flags, mid-ticket approvals, etc.
    // previously had nowhere to surface). Same component + Realtime stream as the subscriber.
    const unread = await getUnreadCount(auth.userId);
    shell = (
      <CoachShell bell={<NotificationBell initialUnread={unread} profileId={auth.userId} />}>
        {children}
      </CoachShell>
    );
  } else {
    shell = <SubscriberShell>{children}</SubscriberShell>;
  }
  return (
    <>
      <TimezoneSync />
      {shell}
    </>
  );
}
