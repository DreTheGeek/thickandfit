'use client';
// The nav menu panel the v2 landing was always meant to have: the sticky bar stays logo-only (the
// Ladder grammar the client picked), and the burger opens a full-width panel with the real links.
// Before this, the burger had no handler and every link was href="#", so there was no way to reach
// Log in or any page from the landing. Hrefs are computed locale-aware by the server SiteNav and
// passed in, so a Spanish visitor stays in Spanish.
import { useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';

export type NavLink = {
  label: string;
  href: string;
  hrefLang?: string;
  lang?: string;
  ariaLabel?: string;
};

export function NavMenu({
  links,
  cta,
}: {
  links: readonly NavLink[];
  cta: NavLink;
}): ReactElement {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => setOpen((v) => !v)}
        className="relative z-50 flex h-10 w-10 flex-col items-center justify-center gap-[5px]"
      >
        <span
          className={`block h-[2px] w-6 bg-white transition-transform duration-200 ${open ? 'translate-y-[7px] rotate-45' : ''}`}
        />
        <span
          className={`block h-[2px] w-6 bg-white transition-opacity duration-200 ${open ? 'opacity-0' : ''}`}
        />
        <span
          className={`block h-[2px] w-6 bg-white transition-transform duration-200 ${open ? '-translate-y-[7px] -rotate-45' : ''}`}
        />
      </button>

      {open && (
        <>
          {/* Backdrop below the 64px bar; click anywhere to close. */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-x-0 bottom-0 top-[64px] z-40 cursor-default bg-black/60"
          />
          <div
            id="site-menu"
            className="absolute inset-x-0 top-full z-40 border-b border-white/10 bg-[#0e0e0e] px-5 py-6 sm:px-8"
          >
            <div className="mx-auto flex w-full max-w-[1200px] flex-col">
              {links.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  hrefLang={l.hrefLang}
                  lang={l.lang}
                  aria-label={l.ariaLabel}
                  onClick={() => setOpen(false)}
                  className="border-b border-white/5 py-3.5 text-[17px] font-semibold text-white transition-opacity hover:opacity-70"
                >
                  {l.label}
                </Link>
              ))}
              <Link
                href={cta.href}
                onClick={() => setOpen(false)}
                className="mt-5 inline-block rounded-full bg-[#ff2d55] px-9 py-4 text-center text-[15px] font-bold uppercase tracking-[0.02em] text-[#0e0e0e] transition-opacity hover:opacity-90"
              >
                {cta.label}
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
