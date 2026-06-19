import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { PageTitle } from '@/components/ui/section';
import { Tag } from '@/components/ui/badge';

/** On-brand placeholder for Phase 2/3 surfaces that aren't built yet. */
export async function ComingSoon({ title }: { title: string }): Promise<ReactElement> {
  const t = await getTranslations('app.common');
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-8 text-center">
      <PageTitle>{title}</PageTitle>
      <p className="mt-3 max-w-xs text-[14px] text-muted">{t('comingSoonBody')}</p>
      <span className="mt-5">
        <Tag>{t('comingSoon')}</Tag>
      </span>
    </div>
  );
}
