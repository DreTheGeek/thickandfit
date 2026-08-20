'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { markCoachStepAction } from '@/lib/coach/tour-actions';

/**
 * Ticks a tour step when the coach actually opens that screen.
 *
 * Mounted once in the coach layout rather than on each of the eleven tracked pages. One mount
 * cannot drift; eleven can, and the twelfth page anybody adds would silently never tick.
 *
 * The ref stops a re-render from firing the same write twice in a session. The action is idempotent
 * anyway, so this is about not making a pointless request rather than about correctness.
 */
export function CoachTourTracker(): null {
  const pathname = usePathname();
  const sent = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!pathname || sent.current.has(pathname)) return;
    sent.current.add(pathname);
    // Fire and forget: this must never delay a screen or surface an error on one.
    void markCoachStepAction(pathname).catch(() => {});
  }, [pathname]);

  return null;
}
