'use client';
// App Router has no automatic pageview, so we fire $pageview on every path/query change. Mounted in
// the root layout inside Providers. Inert without a PostHog key: posthog.init never ran, so
// posthog.__loaded is false and we no-op. useSearchParams forces this into a Suspense boundary, so
// the layout wraps it accordingly.
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import type { ReactElement } from 'react';

export function PostHogPageview(): ReactElement | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthog.__loaded) return; // no key configured: do nothing
    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
