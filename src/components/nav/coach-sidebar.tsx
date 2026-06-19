'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { signOutAction } from '@/lib/auth/actions';
import { Icon, type IconName } from '@/components/ui/icons';

type Item = { href: string; key: 'overview' | 'subscribers' | 'programs' | 'forms'; icon: IconName };

const ITEMS: Item[] = [
  { href: '/coach', key: 'overview', icon: 'steps' },
  { href: '/coach/subscribers', key: 'subscribers', icon: 'community' },
  { href: '/coach/programs', key: 'programs', icon: 'clipboard' },
  { href: '/coach/forms', key: 'forms', icon: 'file' },
];

/** Light, Lenus-style coach sidebar (monochrome, no green in the console). */
export function CoachSidebar(): ReactElement {
  const pathname = usePathname();
  const t = useTranslations('app.coach');
  const c = useTranslations('app.common');

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex h-16 items-center border-b border-line px-5">
        <Link href="/coach" className="tf-display text-[22px] text-ink">
          Thick &amp; Fit
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {ITEMS.map(({ href, key, icon }) => {
          const active =
            href === '/coach'
              ? pathname === '/coach'
              : pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-3 border-l-2 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors',
                active
                  ? 'border-ink bg-warm text-ink'
                  : 'border-transparent text-muted hover:bg-warm/60 hover:text-ink',
              ].join(' ')}
            >
              <Icon name={icon} size={16} />
              {t(key)}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full px-4 py-2.5 text-left text-[12px] font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:text-ink"
          >
            {c('signOut')}
          </button>
        </form>
      </div>
    </aside>
  );
}
