'use client';

import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';
import { NotificationBell } from '@/components/notifications/notification-bell';

/**
 * Phone/tablet top bar holding the notification bell. Hidden on immersive flows (onboarding,
 * check-in, the in-workout player) to match the bottom nav, and on lg+ where the bell lives in
 * the left rail instead.
 */
const HIDDEN = ['/onboarding', '/checkin'];
function isHidden(path: string): boolean {
  return HIDDEN.some((h) => path.startsWith(h)) || path.startsWith('/workout/');
}

export function SubscriberTopBar({
  initialUnread,
  profileId,
}: {
  initialUnread: number;
  profileId: string;
}): ReactElement | null {
  const pathname = usePathname();
  if (isHidden(pathname)) return null;

  return (
    <div className="flex h-12 flex-none items-center justify-end border-b border-line/60 bg-surface px-2 lg:hidden">
      <NotificationBell initialUnread={initialUnread} profileId={profileId} />
    </div>
  );
}
