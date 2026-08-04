// Native marketing footer. The lifted Webflow footer is retired with the rest of the blob.
// Monochrome, bilingual, and it links the pages answer engines and humans both look for.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { withLocalePrefix } from '@/lib/seo/locale-alternates';
import { Wordmark } from '@/components/ui/wordmark';

export async function MarketingFooter(): Promise<ReactElement> {
  const t = await getTranslations('marketing');
  // Footer nav stays in the language the visitor is reading. See withLocalePrefix.
  const pathname = (await headers()).get('x-pathname');
  const lp = (target: string): string => withLocalePrefix(pathname, target);
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Wordmark height={20} />
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-soft">{t('footer.tagline')}</p>
          {/* Her real creator page. Outbound links to the places she actually publishes are both a
              human trust signal and the citation signal generative engines weight, and this is the
              only profile URL verified so far. Add the rest here as the handles are confirmed:
              never guess a social URL, since a wrong one points her brand at someone else. */}
          <a
            href="https://www.solin.stream/stephsblessedd"
            target="_blank"
            rel="noopener noreferrer me"
            className="mt-4 inline-block text-[14px] font-semibold text-ink underline underline-offset-4 hover:text-soft"
          >
            {t('footer.creatorLink')}
          </a>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">
            {t('footer.product')}
          </div>
          <ul className="mt-4 flex flex-col gap-2.5 text-[14px] text-soft">
            <li>
              <Link href={lp('/pricing')} className="hover:text-ink">
                {t('nav.pricing')}
              </Link>
            </li>
            <li>
              <Link href={lp('/faq')} className="hover:text-ink">
                {t('nav.faq')}
              </Link>
            </li>
            <li>
              <Link href="/join" className="hover:text-ink">
                {t('nav.cta')}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">
            {t('footer.legalLabel')}
          </div>
          <ul className="mt-4 flex flex-col gap-2.5 text-[14px] text-soft">
            <li>
              <Link href="/terms" className="hover:text-ink">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-ink">
                Privacy
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-neutral-200">
        <div className="mx-auto max-w-[1180px] px-6 py-6 text-[12px] text-faint">
          {/* The registered entity has NO ampersand. "Thick & Fit" is the brand; "Thick Fit
              Coaching LLC" is the company that takes the money, and a copyright line is a legal
              notice, so it names the company. Matches marketing.footerCopyright in the message
              bundle, src/app/join/page.tsx LEGAL_ENTITY, and src/lib/admin/launch-runway.ts. */}
          &copy; {year} Thick Fit Coaching LLC. {t('footer.rights')}
        </div>
      </div>
    </footer>
  );
}
