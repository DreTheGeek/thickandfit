'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/ui/icons';

/**
 * The notification bell: unread badge + link to the center. Seeded with a server-computed count,
 * then kept fresh by a Supabase Realtime subscription on the caller's own notification rows (RLS
 * scopes the stream). Falls back gracefully if realtime is unavailable: the count refreshes on
 * navigation because the shell re-renders.
 */
export function NotificationBell({
  initialUnread,
  profileId,
}: {
  initialUnread: number;
  profileId: string;
}): ReactElement {
  const t = useTranslations('app.notifications');
  const pathname = usePathname();
  const [unread, setUnread] = useState(initialUnread);

  // Re-seed when the server count changes across navigations.
  useEffect(() => {
    setUnread(initialUnread);
  }, [initialUnread]);

  useEffect(() => {
    const sb = createClient();
    // Unique topic per mount: avoids reusing an already-subscribed channel when the effect
    // re-runs (React Strict Mode double-mount in dev, or a fast nav remount), which would throw
    // "cannot add postgres_changes callbacks after subscribe()".
    const channel = sb
      .channel(`notifications:${profileId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${profileId}`,
        },
        () => setUnread((n) => n + 1),
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [profileId]);

  const onCenter = pathname.startsWith('/notifications');
  const show = unread > 0 && !onCenter;
  const label = show ? t('bellWithCount', { count: unread }) : t('bell');

  return (
    <Link
      href="/notifications"
      aria-label={label}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-warm/60"
    >
      <Icon name="bell" size={20} />
      {show ? (
        <span className="absolute right-1 top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-ink">
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </Link>
  );
}
