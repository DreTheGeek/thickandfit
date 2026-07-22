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
    <header className="sticky top-0 z-50 border-b border-line bg-bg">
      <nav className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-6 py-4">
        <Link href={lp('/')} aria-label="Thick & Fit" className="tf-press shrink-0">
          <Wordmark height={18} />
        </Link>

        <div className="flex items-center gap-2 sm:gap-5">
          <Link
            href={lp('/pricing')}
            className="hidden text-[15px] font-medium text-muted hover:text-ink sm:block"
          >
            {t('pricing')}
          </Link>
          <Link
            href={lp('/faq')}
            className="hidden text-[15px] font-medium text-muted hover:text-ink sm:block"
          >
            {t('faq')}
          </Link>
          {twin ? (
            <Link
              href={twin.href}
              hrefLang={twin.to}
              lang={twin.to}
              aria-label={twin.to === 'es' ? 'Ver en espanol' : 'View in English'}
              className="whitespace-nowrap text-[15px] font-medium text-muted hover:text-ink"
            >
              {twin.to === 'es' ? 'ES' : 'EN'}
            </Link>
          ) : null}
          {/* whitespace-nowrap: at 390px "Log in" / "Iniciar sesion" broke mid-phrase onto two
              lines and pushed the bar to double height. */}
          <Link
            href="/auth/sign-in"
            className="whitespace-nowrap text-[15px] font-medium text-muted hover:text-ink"
          >
            {t('login')}
          </Link>
          <Link
            href="/join"
            className="tf-press tf-cta whitespace-nowrap !px-6 !py-3 !text-[14px]"
          >
            {t('cta')}
          </Link>
        </div>
      </nav>
    </header>
  );
}
