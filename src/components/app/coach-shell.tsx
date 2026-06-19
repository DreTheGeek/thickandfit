'use client';

import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { CoachNav, CoachTopWordmark } from '@/components/nav/coach-nav';
import { Icon } from '@/components/ui/icons';

/**
 * Responsive coach console shell.
 * - lg+ : fixed left sidebar.
 * - < lg: top bar with a hamburger that opens a slide-in drawer.
 */
export function CoachShell({ children }: { children: ReactNode }): ReactElement {
  const [open, setOpen] = useState(false);
  const c = useTranslations('app.common');

  return (
    <div className="flex min-h-screen bg-bg text-ink">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface lg:block">
        <CoachNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile/tablet top bar */}
        <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
          <CoachTopWordmark />
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setOpen(true)}
            className="tf-press text-ink"
          >
            <Icon name="menu" size={24} />
          </button>
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
