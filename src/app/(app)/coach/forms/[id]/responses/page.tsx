// Coach view of a custom form's submissions. Read-only; requireCoach (assistants may review too).
// Check-in-typed forms also surface on the subscriber profile; this is the general viewer the form
// builder links to so no submission is stranded.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { getForm, fetchResponses } from '@/lib/forms/engine';
import { Icon } from '@/components/ui/icons';

export const dynamic = 'force-dynamic';

type FieldRow = { id: string; label_en: string; label_es: string | null; type: string };
type ResponseRow = { id: string; profile_id: string; answers: Record<string, unknown>; submitted_at: string };

// Labels are passed in so the render inherits the coach's locale. Housekeeping: em-dash literal
// removed per house style (universal `/sweep` rule), replaced by an ASCII glyph. Yes/No pulled
// from i18n so a Spanish-speaking coach sees Sí / No, not English.
type AnswerLabels = { empty: string; yes: string; no: string };
function formatAnswer(value: unknown, labels: AnswerLabels): string {
  if (value === null || value === undefined || value === '') return labels.empty;
  if (typeof value === 'boolean') return value ? labels.yes : labels.no;
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ');
  return String(value);
}

export default async function FormResponsesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations('app.coach');
  const answerLabels = { empty: t('formEmptyAnswer'), yes: t('formYes'), no: t('formNo') };

  const loaded = ctx.companyId ? await getForm(ctx.companyId, id) : null;
  const responses = ctx.companyId ? ((await fetchResponses(ctx.companyId, id)) as ResponseRow[]) : [];
  const fields = ((loaded?.fields ?? []) as FieldRow[]);

  // Resolve responder names in one query.
  const svc = createServiceClient();
  const ids = [...new Set(responses.map((r) => r.profile_id))];
  const { data: people } = ids.length
    ? await svc.from('profiles').select('id, full_name').in('id', ids)
    : { data: [] };
  const nameById = new Map(
    ((people ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? 'Member']),
  );

  const title =
    (locale === 'es' && loaded?.form?.title_es ? loaded.form.title_es : loaded?.form?.title_en) ??
    t('formResponsesTitle');
  const labelOf = (f: FieldRow): string => (locale === 'es' && f.label_es ? f.label_es : f.label_en);
  const dateFmt = new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="mx-auto w-full max-w-[820px] px-5 py-7 sm:px-8">
      <Link
        href="/coach/forms"
        className="tf-press mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink"
      >
        <Icon name="arrowLeft" size={15} /> {t('backToForms')}
      </Link>
      <h1 className="tf-display mb-1 text-[26px]">{title}</h1>
      <p className="mb-5 text-[13px] text-faint">
        {responses.length} {responses.length === 1 ? t('responseOne') : t('responseMany')}
      </p>

      {responses.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-5 py-8 text-center text-[14px] text-muted">
          {t('noResponsesYet')}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {responses.map((r) => (
            <section key={r.id} className="rounded-2xl border border-line bg-surface">
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <span className="text-[14px] font-semibold text-ink">{nameById.get(r.profile_id) ?? 'Member'}</span>
                <span className="text-[12px] text-faint tabular-nums">{dateFmt.format(new Date(r.submitted_at))}</span>
              </div>
              <dl className="flex flex-col gap-3 px-5 py-4">
                {fields.map((f) => (
                  <div key={f.id}>
                    <dt className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">{labelOf(f)}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-[14px] text-ink">{formatAnswer(r.answers?.[f.id], answerLabels)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
