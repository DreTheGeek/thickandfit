// Coach forms index. Coach-guarded. Lists the company's forms + a New form action.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/ui/page-header';
import { ButtonLink } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';

export const dynamic = 'force-dynamic';

type FormRow = { id: string; title_en: string; updated_at: string };

export default async function CoachFormsPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');

  let forms: FormRow[] = [];
  if (ctx.companyId) {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('forms')
      .select('id, title_en, updated_at')
      .eq('company_id', ctx.companyId)
      .order('updated_at', { ascending: false });
    forms = (data ?? []) as FormRow[];
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-10">
      <div className="mb-8 flex items-end justify-between">
        <PageHeader title={t('forms')} />
        <ButtonLink href="/coach/forms/new" size="sm" className="mb-1">
          {t('newForm')}
        </ButtonLink>
      </div>
      {forms.length === 0 ? (
        <p className="text-sm text-muted">{t('noForms')}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          {forms.map((f, i) => (
            <Link
              key={f.id}
              href={`/coach/forms/${f.id}`}
              className={[
                'tf-press flex items-center justify-between bg-surface px-4 py-3.5',
                i < forms.length - 1 ? 'border-b border-divider' : '',
              ].join(' ')}
            >
              <span className="font-medium">{f.title_en || 'Untitled form'}</span>
              <Icon name="chevronRight" size={16} className="text-line" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
