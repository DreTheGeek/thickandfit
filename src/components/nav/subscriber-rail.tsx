'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Wordmark } from '@/components/ui/wordmark';
import { Icon, type IconName } from '@/components/ui/icons';
import { Tag } from '@/components/ui/badge';
import { signOutAction } from '@/lib/auth/actions';

type Tab = {
  key: 'today' | 'chat' | 'activities' | 'nutrition' | 'you';
  href: string;
  icon: IconName;
  match: (p: string) => boolean;
  soon?: boolean;
};

const TABS: Tab[] = [
  { key: 'today', href: '/dashboard', icon: 'calendar', match: (p) => p === '/dashboard' },
  { key: 'chat', href: '/messages', icon: 'chat', match: (p) => p.startsWith('/messages'), soon: true },
  {
    key: 'activities',
    href: '/workouts',
    icon: 'dumbbell',
    match: (p) =>
      p.startsWith('/workouts') || p.startsWith('/exercises') || p.startsWith('/workout/') || p.startsWith('/history'),
  },
  { key: 'nutrition', href: '/nutrition', icon: 'nutrition', match: (p) => p.startsWith('/nutrition'), soon: true },
  { key: 'you', href: '/you', icon: 'user', match: (p) => p.startsWith('/you') || p.startsWith('/progress') || p.startsWith('/account') },
];

const HIDDEN = ['/onboarding', '/checkin'];
function isHidden(path: string): boolean {
  return HIDDEN.some((h) => path.startsWith(h)) || path.startsWith('/workout/');
}

/** Desktop/tablet (lg+) left nav rail for the subscriber app. */
export function SubscriberRail(): ReactElement | null {
  const pathname = usePathname();
  const t = useTranslations('app.nav');
  const c = useTranslations('app.common');
  if (isHidden(pathname)) return null;

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex h-16 items-center px-6">
        <Link href="/dashboard">
          <Wordmark height={22} />
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex items-center gap-3 rounded-full px-4 py-2.5 text-[14px] font-medium transition-colors',
                active ? 'bg-warm font-semibold text-ink' : 'text-muted hover:bg-warm/60 hover:text-ink',
              ].join(' ')}
            >
              <Icon name={tab.icon} size={18} />
              {t(tab.key)}
              {tab.soon && (
                <span className="ml-auto">
                  <Tag>{c('soon')}</Tag>
                </span>
              )}
            </Link>
          );
        })}
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
