// Native marketing nav. Replaces the lifted Webflow navbar (which needed a pile of !important CSS
// hacks to stop the buttons stacking and the logo collapsing on phones). Monochrome, responsive:
// text links collapse on small screens, logo + primary CTA always stay.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@/components/ui/wordmark';
import { twinPathFor, withLocalePrefix } from '@/lib/seo/locale-alternates';

export async function MarketingNav(): Promise<ReactElement> {
  const t = await getTranslations('marketing.nav');
  // A real link to the other language, not a cookie toggle. Half her audience reads Spanish, and
  // without this there is no path from the English page to /es for a visitor OR a crawler.
  const pathname = (await headers()).get('x-pathname');
  const twin = twinPathFor(pathname);
  const lp = (target: string): string => withLocalePrefix(pathname, target);
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-6 py-4">
        <Link href={lp('/')} aria-label="Thick & Fit" className="tf-press shrink-0">
          <Wordmark height={18} />
        </Link>

        <div className="flex items-center gap-2 sm:gap-5">
          <Link
            href={lp('/pricing')}
            className="hidden text-[13px] font-semibold uppercase tracking-[1.5px] text-soft hover:text-ink sm:block"
          >
            {t('pricing')}
          </Link>
          <Link
            href={lp('/faq')}
            className="hidden text-[13px] font-semibold uppercase tracking-[1.5px] text-soft hover:text-ink sm:block"
          >
            {t('faq')}
          </Link>
          {twin ? (
            <Link
              href={twin.href}
              hrefLang={twin.to}
              lang={twin.to}
              aria-label={twin.to === 'es' ? 'Ver en espanol' : 'View in English'}
              className="text-[12px] font-semibold uppercase tracking-[1.5px] text-soft hover:text-ink sm:text-[13px]"
            >
              {twin.to === 'es' ? 'ES' : 'EN'}
            </Link>
          ) : null}
          <Link
            href="/auth/sign-in"
            className="text-[12px] font-semibold uppercase tracking-[1.5px] text-soft hover:text-ink sm:text-[13px]"
          >
            {t('login')}
          </Link>
          <Link
            href="/join"
            className="tf-press whitespace-nowrap bg-ink px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[1.5px] text-white sm:px-6 sm:py-3 sm:text-[12px] sm:tracking-[2px]"
          >
            {t('cta')}
          </Link>
        </div>
      </nav>
    </header>
  );
}
