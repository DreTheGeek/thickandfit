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
      // pb clears the iPhone home indicator.
      //
      // max(), NOT 16px + inset, and that arithmetic is the bug the owner photographed. ADDING the
      // two stacks a 16px cushion on top of a 34pt band that is already almost entirely empty (the
      // indicator itself is drawn about 5pt tall at the very bottom of it), so the bar carried 50pt
      // of dead space under the labels and read as a huge empty slab. max() is the standard idiom:
      // the inset REPLACES the base padding when there is one, and the base applies when there is
      // not. On hardware without an indicator env() is 0, so this stays exactly 16px and nothing
      // about the bar changes.
      // bg-surface/95, not a hardcoded rgba(5,5,6). The handoff is a dark design and that literal was
      // its near-black bar; the moment the portal could be light it became a black slab under a
      // cream page, and the ACTIVE tab, which is text-ink, went black on black. The first tab simply
      // looked missing. A role follows the palette; a literal cannot.
      className="flex flex-none border-t border-line bg-surface/95 px-2.5 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] backdrop-blur-lg lg:hidden"
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
