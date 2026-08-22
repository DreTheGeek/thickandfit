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
      // 54px TALL, FLAT, and that is an owner decision rather than a derivation.
      //
      // How it got here. The bar was `pt-2 + content + calc(16px + env(safe-area-inset-bottom))`,
      // which ADDS a 16px cushion to the 34pt home-indicator band and gave a 92pt bar with the icons
      // crammed against its top edge. Switching the addition to `max(16px, env(...))` was the
      // standard idiom and took it to 76pt, a shade under Apple's own 83pt tab bar. The owner looked
      // at it and asked for 54.
      //
      // WHAT 54 COSTS, stated once so nobody re-derives it later as a bug: the content block is
      // 36px, so a flat 54 leaves ~9px under the labels, and the home-indicator band is 34pt. The
      // labels therefore sit INSIDE that band, clear of the indicator pill itself (which draws
      // about 5pt from the bottom) but inside the space Apple reserves for it. That is a deliberate
      // trade of platform clearance for a compact bar, made with the numbers in hand.
      //
      // A fixed height rather than a padding tweak because 54 is the thing being specified. The
      // height holds even if a label wraps or an icon changes size, and `items-center` puts the
      // block in the middle of it instead of hanging it from the top, which is what made the old
      // bar read as icons stuck to the ceiling of an empty box.
      // bg-surface/95, not a hardcoded rgba(5,5,6). The handoff is a dark design and that literal was
      // its near-black bar; the moment the portal could be light it became a black slab under a
      // cream page, and the ACTIVE tab, which is text-ink, went black on black. The first tab simply
      // looked missing. A role follows the palette; a literal cannot.
      className="flex h-[54px] flex-none items-center border-t border-line bg-surface/95 px-2.5 backdrop-blur-lg lg:hidden"
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
