// The single public face while the site is dark.
//
// Every gated path redirects here once the waitlist is closed, which makes this page load-bearing in
// one specific way: it must NEVER itself be gated, or the redirect loops on the only page a visitor
// can reach. isGatedPath() checks HOLDING_PATH first and returns false for exactly that reason.
//
// Deliberately bare. No email capture, no dates, no "join" call to action:
//   * capturing emails here would be a second, unmanaged waitlist competing with the real one, and
//     those addresses would never enter the GHL drip that the Aug 4 campaign is built around.
//   * announcing a date pre-empts the campaign that is supposed to announce it.
// When the waitlist opens (PRELAUNCH_WAITLIST_CLOSED removed) nothing points here any more and /join
// becomes the public face again. This page stays for the next dark period.
import type { ReactElement } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const es = (await getLocale()) === 'es';
  return {
    title: es ? 'Muy pronto · Thick & Fit' : 'Coming soon · Thick & Fit',
    description: es
      ? 'Thick & Fit llega muy pronto.'
      : 'Thick & Fit is coming soon.',
    // Nothing here should be indexed: the page exists only while the real site is hidden, and an
    // indexed "coming soon" would outrank the actual landing page for the brand name at launch.
    robots: { index: false, follow: false },
  };
}

export default async function SoonPage(): Promise<ReactElement> {
  const es = (await getLocale()) === 'es';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <Image
        src="/brand/logo-black.svg"
        alt="Thick &amp; Fit"
        width={168}
        height={48}
        priority
        className="h-auto w-[168px]"
      />

      <h1 className="mt-10 font-display text-[34px] leading-[1.1] sm:text-[44px]">
        {es ? 'Muy pronto.' : 'Coming soon.'}
      </h1>

      <p className="mt-4 max-w-[42ch] text-[15px] leading-[1.6] text-soft">
        {es
          ? 'Estamos poniendo todo a punto. Vuelve pronto.'
          : 'We are putting the finishing touches on it. Check back soon.'}
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-muted">
        <Link href={es ? '/es/support' : '/support'} className="underline underline-offset-4">
          {es ? 'Soporte' : 'Support'}
        </Link>
        <Link href={es ? '/es/privacy' : '/privacy'} className="underline underline-offset-4">
          {es ? 'Privacidad' : 'Privacy'}
        </Link>
        <Link href={es ? '/es/terms' : '/terms'} className="underline underline-offset-4">
          {es ? 'Términos' : 'Terms'}
        </Link>
      </div>
    </main>
  );
}
