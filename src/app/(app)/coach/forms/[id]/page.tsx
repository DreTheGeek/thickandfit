// Coach form builder page. Coach-guarded. id === 'new' starts blank, otherwise loads the form.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { getForm } from '@/lib/forms/engine';
import { FormBuilder } from '@/components/forms/form-builder';
import { PageHeader } from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

type Initial = {
  id?: string;
  title_en: string;
  title_es?: string;
  type?: string;
  fields: { type: string; label_en: string; label_es?: string; required: boolean }[];
};

export default async function FormBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  const { id } = await params;

  let initial: Initial = { title_en: '', fields: [] };
  if (id !== 'new' && ctx.companyId) {
    const loaded = await getForm(ctx.companyId, id);
    if (loaded) {
      initial = {
        id: loaded.form.id,
        title_en: loaded.form.title_en,
        title_es: loaded.form.title_es ?? undefined,
        type: loaded.form.type,
        fields: loaded.fields.map((f) => ({
          type: f.type,
          label_en: f.label_en,
          label_es: f.label_es ?? undefined,
          required: f.required,
        })),
      };
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title={t('formBuilder')} />
      <FormBuilder initial={initial} />
    </div>
  );
}
