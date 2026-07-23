// Shared chrome for every marketing page (homepage, /vs comparison pages, blog, about): the
// announcement bar, the site nav, and the footer, on the dark ground. Any new marketing page wraps
// its sections in <MarketingShell> and inherits the nav + footer + ground with zero duplication.
import type { ReactElement, ReactNode } from 'react';
import { AnnounceBar, SiteNav } from '@/components/marketing/v2/top';
import { SiteFooter } from '@/components/marketing/v2/social';

export function MarketingShell({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="min-h-screen bg-[#0e0e0e] antialiased">
      <AnnounceBar />
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
