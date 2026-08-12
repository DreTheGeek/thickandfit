'use client';
// Client-facing form renderer. Renders EVERY field type the builder offers (text, multiline, rating,
// sleep_duration, select, measurement, photo) and submits to /api/forms/[id]/submit. Photo fields
// upload to the private progress-photos bucket under the member's own folder and store the object path.
import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

type Field = {
  id: string;
  type: string;
  label_en: string;
  label_es?: string;
  required: boolean;
  config?: Record<string, unknown>;
};

const input =
  'w-full border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-ink';

function optionsOf(config: Record<string, unknown> | undefined): string[] {
  const raw = config?.options;
  if (Array.isArray(raw)) return raw.map((o) => String(o)).filter(Boolean);
  if (typeof raw === 'string') return raw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  return [];
}

export function FormRenderer({
  formId,
  fields,
  viewerId,
}: {
  formId: string;
  fields: Field[];
  viewerId: string;
}): ReactElement {
  const t = useTranslations('app.forms');
  const locale = useLocale();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');

  const set = (id: string, value: unknown): void => setAnswers((a) => ({ ...a, [id]: value }));

  async function uploadPhoto(fieldId: string, file: File): Promise<void> {
    setUploading((u) => ({ ...u, [fieldId]: true }));
    try {
      const sb = createClient();
      const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${viewerId}/form-${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from('progress-photos').upload(path, file, { contentType: file.type, upsert: false });
      if (!error) set(fieldId, path);
    } finally {
      setUploading((u) => ({ ...u, [fieldId]: false }));
    }
  }

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
    // A confirmation with no way out is a dead end, and this one sat at the end of the single most
    // important thing a member does each week: she finishes her check-in, reads "thank you", and the
    // app gives her nothing to tap. Home is the way back, and telling her Steph will read it is the
    // honest close, since the coach now actually gets a notification for it.
    return (
      <div className="rounded-xl bg-warm px-4 py-4 text-center">
        <p className="text-sm text-soft">{t('success')}</p>
        <p className="mt-1 text-[13px] text-faint">{t('successNext')}</p>
        <Link
          href="/dashboard"
          className="tf-press mt-4 inline-block rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-bg"
        >
          {t('backHome')}
        </Link>
      </div>
    );
  }

  const anyUploading = Object.values(uploading).some(Boolean);

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
          ) : f.type === 'rating' || f.type === 'sleep_duration' || f.type === 'measurement' ? (
            <div className="flex items-center gap-2">
              <input type="number" step="any" className={input} required={f.required} onChange={(e) => set(f.id, e.target.value)} />
              {typeof f.config?.unit === 'string' && f.config.unit ? <span className="text-[12px] text-faint">{String(f.config.unit)}</span> : null}
            </div>
          ) : f.type === 'select' ? (
            <select className={input} required={f.required} defaultValue="" onChange={(e) => set(f.id, e.target.value)}>
              <option value="" disabled>
                {t('selectPlaceholder')}
              </option>
              {optionsOf(f.config).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : f.type === 'photo' ? (
            <div className="flex flex-col gap-1.5">
              <input
                type="file"
                accept="image/*"
                required={f.required && !answers[f.id]}
                className="text-[13px]"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadPhoto(f.id, file); }}
              />
              {uploading[f.id] ? <span className="text-[12px] text-faint">{t('photoUploading')}</span> : answers[f.id] ? <span className="text-[12px] text-good-ink">{t('photoUploaded')}</span> : null}
            </div>
          ) : (
            <input type="text" className={input} required={f.required} onChange={(e) => set(f.id, e.target.value)} />
          )}
        </label>
      ))}
      <Button type="submit" size="block" disabled={state === 'loading' || anyUploading} className="mt-1">
        {t('submit')}
      </Button>
      {state === 'error' ? <p className="text-sm text-alert-ink">{t('error')}</p> : null}
    </form>
  );
}
