import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { AdminPlaceholder } from '@/components/coach/admin-placeholder';

export const dynamic = 'force-dynamic';

export default async function CoachCommunityPage(): Promise<ReactElement> {
  await requireCoach();
  const t = await getTranslations('app.coach');
  return <AdminPlaceholder title={t('communityTitle')} />;
}
