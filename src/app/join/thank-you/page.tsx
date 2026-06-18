// Waitlist thank-you. Bilingual. Public.
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export const metadata: Metadata = { title: 'Thank you | Thick & Fit' };

export default async function WaitlistThankYouPage() {
  const t = await getTranslations('waitlist');
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-black">
      <div className="max-w-md border-l-2 border-[#5EBE62] pl-5">
        <h1 className="text-3xl font-bold uppercase tracking-tight">{t('successTitle')}</h1>
        <p className="mt-2 text-neutral-700">{t('successBody')}</p>
      </div>
    </main>
  );
}
