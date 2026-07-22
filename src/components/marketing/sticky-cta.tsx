'use client';
// Mobile sticky CTA. Her traffic is overwhelmingly phones coming off Instagram, and on a page this
// long the one action has to stay in reach instead of living only at the top and the bottom.
// Appears after the hero has scrolled past, mobile only (desktop keeps the CTA in the sticky nav).
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import Link from 'next/link';

export function StickyCta({ label }: { label: string }): ReactElement {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let ticking = false;
    const compute = (): void => {
      ticking = false;
      setShown((cur) => {
        const next = window.scrollY > window.innerHeight * 0.9;
        return cur === next ? cur : next;
      });
    };
    const onScroll = (): void => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white/95 p-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-300 lg:hidden ${
        shown ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <Link
        href="/join"
        tabIndex={shown ? undefined : -1}
        aria-hidden={shown ? undefined : true}
        className="tf-press block w-full bg-ink py-4 text-center text-[13px] font-semibold uppercase tracking-[2px] text-white"
      >
        {label}
      </Link>
    </div>
  );
}
