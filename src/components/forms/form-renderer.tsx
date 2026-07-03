'use client';
// Client-facing form renderer. Renders each field type and submits to /api/forms/[id]/submit.
import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

type Field = { id: string; type: string; label_en: string; label_es?: string; required: boolean };

const input =
  'w-full border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-ink';

export function FormRenderer({
  formId,
  fields,
}: {
  formId: string;
  fields: Field[];
}): ReactElement {
  const t = useTranslations('app.forms');
  const locale = useLocale();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');

  const set = (id: string, value: unknown): void => setAnswers((a) => ({ ...a, [id]: value }));

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setState('loading');
    // A rejected fetch (offline, network blip) previously left the form stuck on 'loading' forever.
    try {
      const res = await fetch(`/api/forms/${formId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      setState(res.ok ? 'success' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <p className="rounded-xl bg-warm px-4 py-3 text-sm text-soft">{t('success')}</p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {fields.map((f) => (
        <label key={f.id} className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">
            {(locale === 'es' && f.label_es) || f.label_en}
            {f.required ? ' *' : ''}
          </span>
          {f.type === 'multiline' ? (
            <textarea className={input} required={f.required} onChange={(e) => set(f.id, e.target.value)} />
          ) : f.type === 'rating' || f.type === 'sleep_duration' ? (
            <input type="number" className={input} required={f.required} onChange={(e) => set(f.id, e.target.value)} />
          ) : (
            <input type="text" className={input} required={f.required} onChange={(e) => set(f.id, e.target.value)} />
          )}
        </label>
      ))}
      <Button type="submit" size="block" disabled={state === 'loading'} className="mt-1">
        {t('submit')}
      </Button>
      {state === 'error' ? <p className="text-sm text-alert-ink">{t('error')}</p> : null}
    </form>
  );
}
