'use client';

import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { CoachNav, CoachTopWordmark } from '@/components/nav/coach-nav';
import { CommandPalette } from '@/components/nav/command-palette';
import { Icon } from '@/components/ui/icons';
import { ThemeToggle } from '@/components/ui/theme-toggle';

/**
 * Responsive coach console shell.
 * - lg+ : fixed left sidebar.
 * - < lg: top bar with a hamburger that opens a slide-in drawer.
 */
export function CoachShell({ children, bell }: { children: ReactNode; bell?: ReactNode }): ReactElement {
  const [open, setOpen] = useState(false);
  const c = useTranslations('app.common');

  return (
    <div className="flex min-h-screen bg-bg text-ink">
      {/* Desktop sidebar: viewport-height + sticky so the nav scrolls internally and Sign out stays pinned. */}
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface lg:sticky lg:top-0 lg:block lg:h-screen">
        <CoachNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar (all sizes): wordmark + hamburger on mobile, theme toggle always on the right */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4">
          <div className="lg:hidden">
            <CoachTopWordmark />
          </div>
          <div className="ml-auto flex items-center gap-3">
            {/* Thirty-one nav items in six collapsible sections is a lot to scan when you already
                know where you are going. */}
            <CommandPalette audience="coach" />
            {bell}
            <ThemeToggle />
            <button
              type="button"
              aria-label="Menu"
              onClick={() => setOpen(true)}
              className="tf-press text-ink lg:hidden"
            >
              <Icon name="menu" size={24} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={c('back')}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[80%] bg-surface shadow-xl">
            <CoachNav onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}
