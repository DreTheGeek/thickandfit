import type { ReactElement } from 'react';
import { getLocale } from 'next-intl/server';
import { ComingSoon } from '@/components/app/coming-soon';

export const dynamic = 'force-dynamic';

export default async function CheckinPage(): Promise<ReactElement> {
  const locale = await getLocale();
  return <ComingSoon title={locale === 'es' ? 'Check-In' : 'Check-In'} />;
}
