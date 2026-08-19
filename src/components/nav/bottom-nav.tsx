'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Icon, type IconName } from '@/components/ui/icons';

type Tab = {
  key: 'today' | 'activities' | 'nutrition' | 'progress' | 'community' | 'coach';
  href: string;
  icon: IconName;
  match: (path: string) => boolean;
};

/**
 * Six tabs, per the 8.0 handoff (.planning/design_handoff/8.0/client-portal.html).
 *
 * The old nav had five and buried Progress and the coach thread inside the You hub. Five of the
 * six screens in the handoff draw the same bar: Today, Train, Fuel, Progress, Community, Coach.
 * The Profile screen draws a seventh tab in Coach's place, which is the one internal contradiction
 * in the handoff; Coach wins because it is what the other five agree on, and because a coaching
 * product should not put its coach two taps deep. Profile is reached from the header instead.
 */
const TABS: Tab[] = [
  { key: 'today', href: '/dashboard', icon: 'calendar', match: (p) => p === '/dashboard' },
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
    key: 'progress',
    href: '/progress',
    icon: 'pulse',
    // Progress owns the body-and-photos story, which the handoff splits across a Progress screen
    // and a Photos screen reached from its own tab row. /evolution is the same story over a longer
    // window, so it lights this tab rather than none.
    match: (p) => p.startsWith('/progress') || p.startsWith('/evolution'),
  },
  { key: 'community', href: '/community', icon: 'community', match: (p) => p.startsWith('/community') },
  {
    key: 'coach',
    href: '/inbox',
    icon: 'chat',
    // /inbox is the human thread with Stephanie, which is the conversation the handoff's Coach
    // screen draws. /coach-chat is the assistant and lives behind the same tab: from a member's
    // side both are "talking to my coach", and giving them separate tabs would ask her to know
    // which one she wants before she has typed anything.
    match: (p) => p.startsWith('/inbox') || p.startsWith('/coach-chat') || p.startsWith('/messages'),
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
    <nav
      className="flex flex-none border-t border-line bg-[rgba(5,5,6,0.96)] px-2.5 pb-4 pt-2 backdrop-blur-lg lg:hidden"
      aria-label={t('today')}
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'tf-press flex flex-1 flex-col items-center gap-[3px] py-0.5',
              active ? 'text-ink' : 'text-faint',
            ].join(' ')}
          >
            <Icon name={tab.icon} size={18} />
            {/* 9px in the handoff. Six labels have to survive Spanish too, where "Comunidad" is
                the longest, so the label wraps at the tab edge rather than pushing its neighbours. */}
            <span className="text-center text-[9px] font-semibold leading-tight">{t(tab.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
