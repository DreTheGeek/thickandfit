import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Auth pages are noindex (robots.ts also disallows /auth/), and each sets its own title so search
// engines never see the root title duplicated across sign-in / sign-up / reset.
export const metadata: Metadata = {
  title: { template: '%s | Thick & Fit', default: 'Account | Thick & Fit' },
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }): ReactNode {
  return children;
}
