// Native marketing footer. The lifted Webflow footer is retired with the rest of the blob.
// Monochrome, bilingual, and it links the pages answer engines and humans both look for.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@/components/ui/wordmark';

export async function MarketingFooter(): Promise<ReactElement> {
  const t = await getTranslations('marketing');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Wordmark height={20} />
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-soft">{t('footer.tagline')}</p>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">
            {t('footer.product')}
          </div>
          <ul className="mt-4 flex flex-col gap-2.5 text-[14px] text-soft">
            <li>
              <Link href="/pricing" className="hover:text-ink">
                {t('nav.pricing')}
              </Link>
            </li>
            <li>
              <Link href="/faq" className="hover:text-ink">
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
          &copy; {year} Thick &amp; Fit Coaching LLC. {t('footer.rights')}
        </div>
      </div>
    </footer>
  );
}
