'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Icon } from '@/components/ui/icons';
import { TABS, isNavHidden } from '@/components/nav/tabs';

export function BottomNav(): ReactElement | null {
  const pathname = usePathname();
  const t = useTranslations('app.nav');
  if (isNavHidden(pathname)) return null;

  return (
    <nav
      // pb clears the iPhone home indicator. 16px is right on a device without one; on an iPhone
      // with a 34px indicator the bar sat underneath it and the labels were half-covered in the
      // installed app. env() returns 0 where there is no inset, so the calc is correct on both.
      // bg-surface/95, not a hardcoded rgba(5,5,6). The handoff is a dark design and that literal was
      // its near-black bar; the moment the portal could be light it became a black slab under a
      // cream page, and the ACTIVE tab, which is text-ink, went black on black. The first tab simply
      // looked missing. A role follows the palette; a literal cannot.
      className="flex flex-none border-t border-line bg-surface/95 px-2.5 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))] backdrop-blur-lg lg:hidden"
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
