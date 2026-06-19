'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { signOutAction } from '@/lib/auth/actions';
import { Wordmark } from '@/components/ui/wordmark';
import { Icon, type IconName } from '@/components/ui/icons';

type Item = {
  href: string;
  key: 'overview' | 'subscribers' | 'programs' | 'forms' | 'broadcasts' | 'appHealth';
  icon: IconName;
};

const ITEMS: Item[] = [
  { href: '/coach', key: 'overview', icon: 'pulse' },
  { href: '/coach/subscribers', key: 'subscribers', icon: 'community' },
  { href: '/coach/programs', key: 'programs', icon: 'clipboard' },
  { href: '/coach/forms', key: 'forms', icon: 'file' },
  { href: '/coach/broadcasts', key: 'broadcasts', icon: 'megaphone' },
  { href: '/coach/health', key: 'appHealth', icon: 'bolt' },
];

/** Coach nav content, shared by the desktop sidebar and the mobile drawer. */
export function CoachNav({ onNavigate }: { onNavigate?: () => void }): ReactElement {
  const pathname = usePathname();
  const t = useTranslations('app.coach');
  const c = useTranslations('app.common');

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-line px-5">
        <Link href="/coach" onClick={onNavigate} className="tf-display text-[22px] text-ink">
          Thick &amp; Fit
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {ITEMS.map(({ href, key, icon }) => {
          const active =
            href === '/coach'
              ? pathname === '/coach'
              : pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={[
                'flex items-center gap-3 rounded-full px-4 py-2.5 text-[13px] font-medium transition-colors',
                active ? 'bg-warm font-semibold text-ink' : 'text-muted hover:bg-warm/60 hover:text-ink',
              ].join(' ')}
            >
              <Icon name={icon} size={17} />
              {t(key)}
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
    </div>
  );
}

/** Mobile-only wordmark fallback shown in the top bar. */
export function CoachTopWordmark(): ReactElement {
  return <Wordmark height={20} />;
}
