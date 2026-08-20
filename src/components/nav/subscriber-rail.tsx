'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Wordmark } from '@/components/ui/wordmark';
import { Icon } from '@/components/ui/icons';
import { signOutAction } from '@/lib/auth/actions';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { CommandPalette } from '@/components/nav/command-palette';
import { TABS, isNavHidden } from '@/components/nav/tabs';

/**
 * The rail's one extra row, below the six shared tabs.
 *
 * It used to be Messages, because the rail had no Coach tab and /inbox needed a home. Coach now
 * carries /inbox from the shared list, so a Messages row here would light two rows on the same URL.
 * You takes the slot instead, which the phone reaches from the header and the rail otherwise could
 * not reach at all.
 *
 * The match is narrow on purpose: /progress, /evolution and /coach-chat belong to Progress and Coach
 * in the shared list, and claiming them here would light two rows again, which is the exact drift
 * this file just stopped duplicating.
 */
const YOU_MATCH = (p: string): boolean => p.startsWith('/you') || p.startsWith('/account');

/** Desktop/tablet (lg+) left nav rail for the subscriber app. */
export function SubscriberRail({
  initialUnread = 0,
  profileId = '',
}: {
  initialUnread?: number;
  profileId?: string;
}): ReactElement | null {
  const pathname = usePathname();
  const t = useTranslations('app.nav');
  const c = useTranslations('app.common');
  if (isNavHidden(pathname)) return null;

  const rowClass = (active: boolean): string =>
    [
      'flex items-center gap-3 rounded-full px-4 py-2.5 text-[14px] font-medium transition-colors',
      active ? 'bg-warm font-semibold text-ink' : 'text-muted hover:bg-warm/60 hover:text-ink',
    ].join(' ');

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex h-16 items-center justify-between px-6">
        <Link href="/dashboard">
          {/* tone="white". The default is the BLACK wordmark, which is correct on the marketing
              site and on the coach console, and invisible here: this rail only ever renders inside
              .tf-portal, on a #121214 ground. Her brand mark was a dark smudge in the corner of the
              member's desktop nav. */}
          <Wordmark height={22} tone="white" />
        </Link>
        <div className="flex items-center gap-1">
          <CommandPalette audience="member" />
          {profileId ? (
            <NotificationBell initialUnread={initialUnread} profileId={profileId} />
          ) : null}
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={rowClass(active)}
            >
              <Icon name={tab.icon} size={18} />
              {t(tab.key)}
            </Link>
          );
        })}
        <Link href="/you" aria-current={YOU_MATCH(pathname) ? 'page' : undefined} className={rowClass(YOU_MATCH(pathname))}>
          <Icon name="user" size={18} />
          {t('you')}
        </Link>
      </nav>
      <div className="border-t border-line p-3">
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full rounded-full px-4 py-2.5 text-left text-[12px] font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:text-ink"
          >
            {c('signOut')}
          </button>
        </form>
      </div>
    </aside>
  );
}
