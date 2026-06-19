import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { ComingSoon } from '@/components/app/coming-soon';

export const dynamic = 'force-dynamic';

export default async function NutritionPage(): Promise<ReactElement> {
  const t = await getTranslations('app.nav');
  return <ComingSoon title={t('nutrition')} />;
}
