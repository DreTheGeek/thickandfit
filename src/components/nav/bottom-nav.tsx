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
    match: (p) =>
      p.startsWith('/you') || p.startsWith('/progress') || p.startsWith('/account'),
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
