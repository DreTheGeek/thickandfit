import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { ComingSoon } from '@/components/app/coming-soon';

export const dynamic = 'force-dynamic';

export default async function ProgressPage(): Promise<ReactElement> {
  const t = await getTranslations('app.you');
  return <ComingSoon title={t('progress')} />;
}
