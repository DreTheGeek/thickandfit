import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { PageTitle } from '@/components/ui/section';
import { Tag } from '@/components/ui/badge';

/** On-brand placeholder for admin areas/tools whose backend lands in a later phase. */
export async function AdminPlaceholder({ title }: { title: string }): Promise<ReactElement> {
  const t = await getTranslations('app.coach');
  const locale = await getLocale();
  const note =
    locale === 'es'
      ? 'Estamos construyendo esto. La estructura ya está organizada; la funcionalidad llega pronto.'
      : "We're building this. The structure is laid out and organized; functionality lands soon.";
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageTitle>{title}</PageTitle>
      <div className="mt-6 rounded-2xl border border-dashed border-line p-12 text-center">
        <Tag>{t('comingSoonShort')}</Tag>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted">{note}</p>
      </div>
    </div>
  );
}
