// Spanish for her movements: what is missing, and the review desk for filling it in.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { Eyebrow, PageTitle } from '@/components/ui/section';
import { SpanishReview } from '@/components/coach/spanish-review';

export const dynamic = 'force-dynamic';

export default async function CoachSpanishPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  if (!ctx.companyId) return <div className="p-8 text-sm text-muted">{t('exercisesEmpty')}</div>;

  const svc = createServiceClient();
  const [{ count: missing }, { count: total }] = await Promise.all([
    svc.from('exercises').select('id', { count: 'exact', head: true }).is('name_es', null),
    svc.from('exercises').select('id', { count: 'exact', head: true }),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Eyebrow>{t('bucketToolbox')}</Eyebrow>
      <PageTitle className="mb-1 mt-1">{t('esTitle')}</PageTitle>
      <p className="tf-measure mb-5 text-[13px] text-muted">{t('esIntro')}</p>
      <SpanishReview missing={missing ?? 0} total={total ?? 0} />
    </div>
  );
}
