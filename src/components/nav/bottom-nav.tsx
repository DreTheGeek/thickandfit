'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Icon, type IconName } from '@/components/ui/icons';

type Tab = {
  key: 'today' | 'chat' | 'activities' | 'nutrition' | 'you';
  href: string;
  icon: IconName;
  match: (path: string) => boolean;
};

const TABS: Tab[] = [
  { key: 'today', href: '/dashboard', icon: 'calendar', match: (p) => p === '/dashboard' },
  { key: 'chat', href: '/messages', icon: 'chat', match: (p) => p.startsWith('/messages') },
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
    <nav className="flex flex-none border-t border-divider bg-surface px-3.5 pb-3.5 pt-2.5">
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
            <Icon name={tab.icon} size={18} />
            <span className="text-[10px]">{t(tab.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
