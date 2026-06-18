'use client';
// Client-facing form renderer. Renders each field type and submits to /api/forms/[id]/submit.
import { useState } from 'react';

type Field = { id: string; type: string; label_en: string; label_es?: string; required: boolean };

export function FormRenderer({ formId, fields }: { formId: string; fields: Field[] }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');

  const set = (id: string, value: unknown) => setAnswers((a) => ({ ...a, [id]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('loading');
    const res = await fetch(`/api/forms/${formId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    setState(res.ok ? 'success' : 'error');
  }

  if (state === 'success') {
    return <p className="text-sm text-neutral-700">Thank you. Your response was recorded.</p>;
  }

  const input = 'rounded-none border border-black bg-white px-3 py-2 text-sm';

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {fields.map((f) => (
        <label key={f.id} className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            {f.label_en}
            {f.required ? ' *' : ''}
          </span>
          {f.type === 'multiline' ? (
            <textarea
              className={input}
              required={f.required}
              onChange={(e) => set(f.id, e.target.value)}
            />
          ) : f.type === 'rating' || f.type === 'sleep_duration' ? (
            <input
              type="number"
              className={input}
              required={f.required}
              onChange={(e) => set(f.id, e.target.value)}
            />
          ) : (
            <input
              type="text"
              className={input}
              required={f.required}
              onChange={(e) => set(f.id, e.target.value)}
            />
          )}
        </label>
      ))}
      <button type="submit" disabled={state === 'loading'} className="rounded-none bg-black px-5 py-2 text-sm font-medium text-white">
        Submit
      </button>
      {state === 'error' ? <p className="text-sm text-red-600">Could not submit.</p> : null}
    </form>
  );
}
