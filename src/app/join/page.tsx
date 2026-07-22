// Pre-registration waitlist landing. Bilingual, design-doctrine (MONOCHROME warm cream + near-black,
// editorial headline, no banned patterns; green is functional-only). Public + crawlable (no auth).
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getUiLocale } from '@/lib/i18n/locale';
import { WaitlistForm } from '@/components/marketing/waitlist-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('waitlist');
  return {
    title: `${t('cta')} | Thick & Fit`,
    description: t('subhead'),
    alternates: { canonical: '/join' },
    // Include the image explicitly: a page-level openGraph replaces the parent's, so without this
    // /join would ship no og:image.
    openGraph: {
      url: '/join',
      title: `${t('cta')} | Thick & Fit`,
      description: t('subhead'),
      images: ['/assets/images/open-graph.jpg'],
    },
  };
}

export default async function JoinPage() {
  const t = await getTranslations('waitlist');
  const locale = await getUiLocale();

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="mx-auto max-w-3xl px-6 py-24 sm:py-32">
        <h1 className="text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-7xl">
          {t('headline')}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-neutral-700">{t('subhead')}</p>
        <div className="mt-10 max-w-xl">
          <WaitlistForm locale={locale} />
        </div>
      </section>
    </main>
  );
}
