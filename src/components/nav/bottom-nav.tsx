'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Icon, type IconName } from '@/components/ui/icons';

type Tab = {
  key: 'today' | 'community' | 'activities' | 'nutrition' | 'you';
  href: string;
  icon: IconName;
  match: (path: string) => boolean;
  soon?: boolean;
};

const TABS: Tab[] = [
  { key: 'today', href: '/dashboard', icon: 'calendar', match: (p) => p === '/dashboard' },
  { key: 'community', href: '/community', icon: 'community', match: (p) => p.startsWith('/community') },
  {
    key: 'activities',
    href: '/workouts',
    icon: 'dumbbell',
    match: (p) =>
      p.startsWith('/workouts') ||
      p.startsWith('/exercises') ||
      p.startsWith('/workout/') ||
      p.startsWith('/history'),
  },
  { key: 'nutrition', href: '/nutrition', icon: 'nutrition', match: (p) => p.startsWith('/nutrition') },
  {
    key: 'you',
    href: '/you',
    icon: 'user',
    // Every child of the You hub, so the tab stays lit wherever she landed from it. /inbox and
    // /coach-chat were missing, which meant the two screens where she talks to her coach, human and
    // AI, were the only ones in the app with no tab highlighted and no way back down the nav. In a
    // coaching product that is the wrong screen to make her feel lost on. Both are rows in the You
    // menu (see you-screen.tsx), so this is the tab that already owns them.
    //
    // /messages only ever redirects to /coach-chat, so it is never a resting path; matched anyway
    // because the redirect is cheap to outlive and a stale entry here is invisible.
    //
    // NOT /notifications: the bell lives in the top bar and the desktop rail, not in the You menu,
    // so it belongs to no tab. Picking one for it would be a guess.
    match: (p) =>
      p.startsWith('/you') ||
      p.startsWith('/progress') ||
      p.startsWith('/account') ||
      p.startsWith('/evolution') ||
      p.startsWith('/inbox') ||
      p.startsWith('/coach-chat') ||
      p.startsWith('/messages'),
  },
];

/** Routes that are immersive flows: the bottom nav hides itself there. */
const HIDDEN = ['/onboarding', '/checkin'];
function isHidden(path: string): boolean {
  return HIDDEN.some((h) => path.startsWith(h)) || path.startsWith('/workout/');
}

export function BottomNav(): ReactElement | null {
  const pathname = usePathname();
  const t = useTranslations('app.nav');
  if (isHidden(pathname)) return null;

  return (
    <nav className="flex flex-none border-t border-divider bg-surface px-3.5 pb-3.5 pt-2.5 lg:hidden">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'tf-press flex flex-1 flex-col items-center gap-[3px]',
              active ? 'text-ink' : 'text-faint/90',
            ].join(' ')}
          >
            <span className="relative">
              <Icon name={tab.icon} size={18} />
              {tab.soon && (
                <span
                  aria-hidden
                  className="absolute -right-1.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent"
                />
              )}
            </span>
            <span className="text-[10px]">{t(tab.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
