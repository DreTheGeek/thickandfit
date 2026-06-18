'use client';
// Coach form builder: block palette, up/down reorder, per-field config, save + publish.
// Calls the proven /api/forms routes with the cookie session.
import { useState } from 'react';

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

type Initial = { id?: string; title_en: string; title_es?: string; fields: Field[] };

export function FormBuilder({ initial }: { initial?: Initial }) {
  const [id, setId] = useState<string | undefined>(initial?.id);
  const [titleEn, setTitleEn] = useState(initial?.title_en ?? '');
  const [titleEs, setTitleEs] = useState(initial?.title_es ?? '');
  const [fields, setFields] = useState<Field[]>(initial?.fields ?? []);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const addField = (type: string) =>
    setFields((f) => [...f, { type, label_en: '', required: false }]);
  const remove = (i: number) => setFields((f) => f.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<Field>) =>
    setFields((f) => f.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const move = (i: number, dir: -1 | 1) =>
    setFields((f) => {
      const next = [...f];
      const j = i + dir;
      if (j < 0 || j >= next.length) return next;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  async function save() {
    setBusy(true);
    setStatus('');
    const res = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title_en: titleEn, title_es: titleEs || undefined, fields }),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.data?.formId) {
      setId(json.data.formId);
      setStatus('Saved');
    } else {
      setStatus('Save failed');
    }
    setBusy(false);
  }

  async function publish() {
    if (!id) {
      setStatus('Save first');
      return;
    }
    const res = await fetch(`/api/forms/${id}/publish`, { method: 'POST' });
    setStatus(res.ok ? 'Published' : 'Publish failed');
  }

  const input = 'rounded-none border border-black bg-white px-3 py-2 text-sm';
  const btn = 'rounded-none border border-black px-3 py-1 text-sm';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <input className={input} placeholder="Title (EN)" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
        <input className={input} placeholder="Título (ES)" value={titleEs} onChange={(e) => setTitleEs(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {BLOCK_TYPES.map((t) => (
          <button key={t} type="button" className={btn} onClick={() => addField(t)}>
            + {t}
          </button>
        ))}
      </div>

      <ol className="flex flex-col gap-3">
        {fields.map((f, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 border border-neutral-200 p-3">
            <span className="text-xs uppercase text-neutral-500">{f.type}</span>
            <input
              className={`${input} flex-1`}
              placeholder="Label (EN)"
              value={f.label_en}
              onChange={(e) => update(i, { label_en: e.target.value })}
            />
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={f.required} onChange={(e) => update(i, { required: e.target.checked })} />
              required
            </label>
            <button type="button" className={btn} onClick={() => move(i, -1)} aria-label="up">↑</button>
            <button type="button" className={btn} onClick={() => move(i, 1)} aria-label="down">↓</button>
            <button type="button" className={btn} onClick={() => remove(i)} aria-label="remove">✕</button>
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-3">
        <button type="button" disabled={busy} className="rounded-none bg-black px-5 py-2 text-sm font-medium text-white" onClick={save}>
          Save
        </button>
        <button type="button" className="rounded-none border border-black px-5 py-2 text-sm font-medium" onClick={publish}>
          Publish
        </button>
        {status ? <span className="text-sm text-neutral-600">{status}</span> : null}
      </div>
    </div>
  );
}
