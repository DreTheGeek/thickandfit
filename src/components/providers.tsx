'use client';

import type { ReactElement, ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';

/** App-wide client providers. next-themes drives light/dark via the data-theme attribute. */
export function Providers({ children }: { children: ReactNode }): ReactElement {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
