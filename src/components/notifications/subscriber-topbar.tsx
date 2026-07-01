'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Icon } from '@/components/ui/icons';
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
  const t = useTranslations('app.nav');
  if (isHidden(pathname)) return null;

  return (
    <div className="flex h-12 flex-none items-center justify-end gap-1 border-b border-line/60 bg-surface px-2 lg:hidden">
      <Link
        href="/inbox"
        aria-label={t('messages')}
        className="tf-press flex h-9 w-9 items-center justify-center text-muted"
      >
        <Icon name="chat" size={20} />
      </Link>
      <NotificationBell initialUnread={initialUnread} profileId={profileId} />
    </div>
  );
}
