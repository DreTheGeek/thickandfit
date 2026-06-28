// Health / assumption-of-risk disclaimer. The entitlement guard routes any client who has not yet
// acknowledged here before they can reach training content. Accepting records a timestamp (0038).
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/guards';
import { acceptHealthAction } from '@/lib/account/actions';
import { PageTitle } from '@/components/ui/section';

export const dynamic = 'force-dynamic';

export default async function DisclaimerPage(): Promise<ReactElement> {
  await requireAuth();
  const t = await getTranslations('app.disclaimer');
  return (
    <div className="mx-auto max-w-lg px-[22px] py-10">
      <PageTitle className="mb-4">{t('title')}</PageTitle>
      <div className="space-y-3 text-[14px] leading-relaxed text-soft">
        <p>{t('p1')}</p>
        <p>{t('p2')}</p>
        <p>{t('p3')}</p>
      </div>
      <form action={acceptHealthAction} className="mt-8">
        <button
          type="submit"
          className="tf-press w-full rounded-full bg-ink py-3.5 text-[13px] font-semibold uppercase tracking-[2px] text-bg"
        >
          {t('accept')}
        </button>
      </form>
    </div>
  );
}
