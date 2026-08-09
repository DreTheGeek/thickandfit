// Coach forms index. Coach-guarded. Lists the company's forms + a New form action, and lets the
// coach assign any form to a client inline (the assign endpoint previously had no UI caller, which
// made the check-in loop undrivable from the console).
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/ui/page-header';
import { ButtonLink } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { AssignFormControl } from '@/components/coach/assign-form-control';

export const dynamic = 'force-dynamic';

type FormRow = { id: string; title_en: string; type: string; updated_at: string };

export default async function CoachFormsPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');

  let forms: FormRow[] = [];
  let clients: { id: string; name: string }[] = [];
  if (ctx.companyId) {
    const supabase = createServiceClient();
    const [{ data }, { data: members }] = await Promise.all([
      supabase
        .from('forms')
        .select('id, title_en, type, updated_at')
        .eq('company_id', ctx.companyId)
        .order('updated_at', { ascending: false }),
      // Assignable clients for the per-form assign control (members only, not coach roles).
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('company_id', ctx.companyId)
        .in('role', ['subscriber', 'free'])
        .order('full_name', { ascending: true })
        .limit(500),
    ]);
    forms = (data ?? []) as FormRow[];
    clients = ((members ?? []) as { id: string; full_name: string | null; email: string | null }[]).map(
      (m) => ({ id: m.id, name: (m.full_name ?? m.email ?? '').trim() || m.id.slice(0, 8) }),
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
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
            <div
              key={f.id}
              className={[
                'flex flex-wrap items-center justify-between gap-3 bg-surface px-4 py-3.5',
                i < forms.length - 1 ? 'border-b border-divider' : '',
              ].join(' ')}
            >
              <Link href={`/coach/forms/${f.id}`} className="tf-press flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{f.title_en || 'Untitled form'}</span>
                {f.type === 'check_in' && (
                  <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[1px] text-muted">
                    {t('formCheckinTag')}
                  </span>
                )}
                <Icon name="chevronRight" size={16} className="shrink-0 text-line" />
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/coach/forms/${f.id}/responses`}
                  className="tf-press rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink"
                >
                  {t('viewResponses')}
                </Link>
                <AssignFormControl formId={f.id} clients={clients} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
