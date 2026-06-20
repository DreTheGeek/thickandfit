'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';

type Mode = 'light' | 'dark' | 'system';
const MODES: Mode[] = ['light', 'dark', 'system'];

// Sun / moon / monitor glyphs (inline so the toggle is self-contained).
const GLYPH: Record<Mode, ReactElement> = {
  light: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  dark: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
  system: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  ),
};

/** Segmented light / dark / system switch. */
export function ThemeToggle(): ReactElement {
  const { theme, setTheme } = useTheme();
  const t = useTranslations('app.common');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const active = (mounted ? theme : 'light') as Mode;

  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-line p-0.5">
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setTheme(m)}
          aria-label={t(`theme_${m}`)}
          aria-pressed={active === m}
          className={[
            'tf-press flex h-7 w-8 items-center justify-center rounded-full transition-colors',
            active === m ? 'bg-ink text-bg' : 'text-faint hover:text-ink',
          ].join(' ')}
        >
          {GLYPH[m]}
        </button>
      ))}
    </div>
  );
}
