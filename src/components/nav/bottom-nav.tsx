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
      // 36px TALL, FLAT. An owner decision, arrived at by looking rather than by derivation, and
      // walked down deliberately: 92 -> 76 -> 54 -> 36.
      //
      //   92pt   pt-2 + content + calc(16px + env(safe-area-inset-bottom))   icons at the ceiling
      //   76pt   pt-2 + content + max(16px, env(safe-area-inset-bottom))     the standard idiom
      //   54px   h-[54px] + items-center
      //   36px   this
      //
      // 36 IS VERY NEARLY THE CONTENT BLOCK ITSELF (icon 20 + gap 3 + label 11 = 34, plus the 1px
      // border), which is why the links lost their py-0.5: keeping it put the block inside a box
      // smaller than itself and clipped the label descenders. It also means the icon size and this
      // height are now coupled. 20 is the largest icon that fits; 21 overflows. Change one and
      // re-measure the other.
      //
      // THE TWO COSTS, recorded once so neither reads as a bug later:
      //   1. There is no home-indicator clearance left at all. The labels sit over the pill, not
      //      merely inside the 34pt band Apple reserves for it. The bar's own background is what
      //      keeps them legible.
      //   2. The tap targets are 36px tall against Apple's 44pt minimum. The row is still full
      //      width per tab, so horizontally they are generous; it is the vertical that is under.
      // Both were raised with the owner before this landed and both are accepted.
      //
      // A fixed height rather than padding because the height is the thing being specified: it holds
      // if a label wraps or an icon changes size. items-center centres the block instead of hanging
      // it from the top, which is what made the 92pt bar read as icons stuck to a ceiling.
      // bg-surface/95, not a hardcoded rgba(5,5,6). The handoff is a dark design and that literal was
      // its near-black bar; the moment the portal could be light it became a black slab under a
      // cream page, and the ACTIVE tab, which is text-ink, went black on black. The first tab simply
      // looked missing. A role follows the palette; a literal cannot.
      className="flex h-[36px] flex-none items-center border-t border-line bg-surface/95 px-2.5 backdrop-blur-lg lg:hidden"
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
              'tf-press flex flex-1 flex-col items-center gap-[3px]',
              active ? 'text-ink' : 'text-faint',
            ].join(' ')}
          >
            {/* 20, up from 18, and 20 is the CEILING at a 36px bar rather than a preference.
                The block is icon + 3px gap + an 11.3px label inside 35px of usable height, so 20
                leaves 0.7px spare and 21 overflows and clips the label descenders. Anything larger
                than this needs the bar taller. */}
            <Icon name={tab.icon} size={20} />
            {/* 9px in the handoff. Six labels have to survive Spanish too, where "Comunidad" is
                the longest, so the label wraps at the tab edge rather than pushing its neighbours. */}
            <span className="text-center text-[9px] font-semibold leading-tight">{t(tab.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
