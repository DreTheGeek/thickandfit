// Client form page. Requires auth; the form must be published and assigned to this client.
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/guards';
import { getForm } from '@/lib/forms/engine';
import { createServiceClient } from '@/lib/supabase/service';
import { FormRenderer } from '@/components/forms/form-renderer';

export const dynamic = 'force-dynamic';

export default async function ClientFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const ctx = await requireAuth();
  const { id } = await params;

  const supabase = createServiceClient();
  const { data: assigned } = await supabase
    .from('form_assignments')
    .select('id')
    .eq('form_id', id)
    .eq('profile_id', ctx.userId)
    .maybeSingle();

  const loaded = ctx.companyId ? await getForm(ctx.companyId, id) : null;

  if (!assigned || !loaded || loaded.form.status !== 'published') {
    const t = await getTranslations('app.common');
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-8 text-center">
        <p className="text-muted">{t('comingSoonBody')}</p>
      </div>
    );
  }

  const locale = await getLocale();
  const title = (locale === 'es' && loaded.form.title_es) || loaded.form.title_en;

  return (
    <div className="px-[22px] pb-7 pt-5">
      <h1 className="tf-display mb-6 text-[30px]">{title}</h1>
      <FormRenderer formId={id} fields={loaded.fields} />
    </div>
  );
}
