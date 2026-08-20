'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Send the app shell's scroller back to the top on every route change.
 *
 * The shell became a real app frame (fixed height, only <main> scrolls), which is what stops the
 * bottom bar moving. It also moves the scroll position off `window` and onto that element, and the
 * router only ever resets `window`. Without this, tapping from the bottom of a long Fuel diary into
 * Today lands her halfway down Today, which reads as a broken screen rather than a preserved
 * position.
 *
 * Targets the element rather than taking a ref, because the shell is a server component and passing
 * a ref through it would make it a client one for no other reason.
 *
 * `instant`, not smooth: this is a new screen, not a movement within one, and animating it makes
 * navigation feel slower than it is.
 */
export function ScrollReset(): null {
  const pathname = usePathname();

  useEffect(() => {
    const main = document.querySelector('main.tf-scroll');
    if (main) main.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return null;
}
