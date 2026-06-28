import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

// Root 404. Rendered for any unmatched route (outside the app shell), so it stands alone and
// on-brand. Bilingual via the request locale the proxy sets.
export default async function NotFound(): Promise<ReactElement> {
  const t = await getTranslations('notFound');
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
      <p className="font-display text-[56px] leading-none text-ink">404</p>
      <h1 className="text-[18px] font-semibold text-ink">{t('title')}</h1>
      <p className="max-w-sm text-[14px] text-faint">{t('body')}</p>
      <Link
        href="/"
        className="tf-press mt-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-bg"
      >
        {t('cta')}
      </Link>
    </main>
  );
}
