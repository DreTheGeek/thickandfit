'use client';

import type { ReactElement, ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';

/**
 * App-wide client providers. next-themes drives light/dark via the data-theme attribute.
 * The 7.1 handoff is a light (warm-cream) design, so light is the pinned default; dark stays
 * available via the toggle but we do NOT auto-follow the OS (no enableSystem) so the app matches
 * the handoff out of the box.
 */
export function Providers({ children }: { children: ReactNode }): ReactElement {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="light" disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
