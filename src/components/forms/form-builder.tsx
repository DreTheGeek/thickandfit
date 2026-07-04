'use client';
// Coach form builder: block palette, up/down reorder, per-field config, save + publish.
// Calls the proven /api/forms routes with the cookie session.
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';

type Field = {
  type: string;
  label_en: string;
  label_es?: string;
  required: boolean;
};

const BLOCK_TYPES = [
  'text',
  'multiline',
  'select',
  'rating',
  'sleep_duration',
  'photo',
  'measurement',
] as const;

type Initial = { id?: string; title_en: string; title_es?: string; type?: string; fields: Field[] };

const input =
  'border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-ink';

export function FormBuilder({ initial }: { initial?: Initial }): ReactElement {
  const t = useTranslations('app.coach');
  const [id, setId] = useState<string | undefined>(initial?.id);
  const [titleEn, setTitleEn] = useState(initial?.title_en ?? '');
  const [titleEs, setTitleEs] = useState(initial?.title_es ?? '');
  // check_in forms power the member check-in loop (assign -> submit -> coach review); the builder
  // previously never sent a type, so every authored form saved as 'custom' and could not be a check-in.
  const [isCheckin, setIsCheckin] = useState(initial?.type === 'check_in');
  const [fields, setFields] = useState<Field[]>(initial?.fields ?? []);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const addField = (type: string): void =>
    setFields((f) => [...f, { type, label_en: '', required: false }]);
  const remove = (i: number): void => setFields((f) => f.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<Field>): void =>
    setFields((f) => f.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const move = (i: number, dir: -1 | 1): void =>
    setFields((f) => {
      const next = [...f];
      const j = i + dir;
      if (j < 0 || j >= next.length) return next;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  async function save(): Promise<void> {
    // The API rejects blank labels; catch it here with a clear message instead of an opaque failure.
    if (fields.some((f) => f.label_en.trim().length === 0)) {
      setStatus(t('formLabelsRequired'));
      return;
    }
    setBusy(true);
    setStatus('');
    const res = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        title_en: titleEn,
        title_es: titleEs || undefined,
        type: isCheckin ? 'check_in' : 'custom',
        fields,
      }),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.data?.formId) {
      setId(json.data.formId);
      setStatus(t('formSaved'));
    } else {
      setStatus(t('formSaveFailed'));
    }
    setBusy(false);
  }

  async function publish(): Promise<void> {
    if (!id) {
      setStatus(t('formSaveFirst'));
      return;
    }
    const res = await fetch(`/api/forms/${id}/publish`, { method: 'POST' });
    setStatus(res.ok ? t('formPublished') : t('formPublishFailed'));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <input className={input} placeholder="Title (EN)" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
        <input className={input} placeholder="Título (ES)" value={titleEs} onChange={(e) => setTitleEs(e.target.value)} />
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" checked={isCheckin} onChange={(e) => setIsCheckin(e.target.checked)} />
          {t('formIsCheckin')}
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {BLOCK_TYPES.map((bt) => (
          <button
            key={bt}
            type="button"
            className="tf-press border border-line px-3 py-1.5 text-[12px] uppercase tracking-[1px] text-muted hover:border-ink hover:text-ink"
            onClick={() => addField(bt)}
          >
            + {bt}
          </button>
        ))}
      </div>

      <ol className="flex flex-col gap-2.5">
        {fields.map((f, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3">
            <span className="text-[11px] uppercase tracking-[1px] text-faint">{f.type}</span>
            <input
              className={`${input} flex-1`}
              placeholder="Label (EN)"
              value={f.label_en}
              onChange={(e) => update(i, { label_en: e.target.value })}
            />
            <label className="flex items-center gap-1 text-[12px] text-muted">
              <input type="checkbox" checked={f.required} onChange={(e) => update(i, { required: e.target.checked })} />
              required
            </label>
            <button type="button" className="tf-press p-1 text-muted hover:text-ink" onClick={() => move(i, -1)} aria-label="up">
              <Icon name="chevronLeft" size={16} className="rotate-90" />
            </button>
            <button type="button" className="tf-press p-1 text-muted hover:text-ink" onClick={() => move(i, 1)} aria-label="down">
              <Icon name="chevronRight" size={16} className="rotate-90" />
            </button>
            <button type="button" className="tf-press p-1 text-muted hover:text-ink" onClick={() => remove(i)} aria-label="remove">
              <Icon name="x" size={16} />
            </button>
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-3">
        <Button size="sm" disabled={busy} onClick={save}>
          {t('save')}
        </Button>
        <Button variant="outline" size="sm" onClick={publish}>
          {t('publish')}
        </Button>
        {status ? <span className="text-[13px] text-muted">{status}</span> : null}
      </div>
    </div>
  );
}
