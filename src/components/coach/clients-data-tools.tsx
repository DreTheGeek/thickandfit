'use client';
// Add client + Export/Import CSV controls for the coach clients list. Export hits the streaming route;
// import reads a local file and posts its text to the import action; Add opens an inline create form.
import { useRef, useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icons';
import { importClientsCsvAction, type ImportResult } from '@/lib/csv/import-clients';
import { createContactAction } from '@/lib/coach/contact-actions';

export function ClientsDataTools(): ReactElement {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [addErr, setAddErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const addClient = (): void => {
    if (!form.email.trim() || pending) return;
    setAddErr(null);
    start(async () => {
      const res = await createContactAction(form);
      if (res.ok && res.id) {
        setAddOpen(false);
        setForm({ firstName: '', lastName: '', email: '', phone: '' });
        router.push(`/coach/clients/${res.id}`);
      } else {
        setAddErr(res.error === 'duplicate' ? 'A client with that email already exists.' : res.error === 'invalid' ? 'Enter a valid email.' : 'Could not add client.');
      }
    });
  };

  const onFile = (file: File): void => {
    if (file.size > 5_000_000) { setResult({ ok: false, error: 'too_large' }); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      start(async () => {
        const res = await importClientsCsvAction(text);
        setResult(res);
      });
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="tf-press inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-2 text-[12px] font-semibold text-surface"
      >
        <Icon name="plus" size={14} /> Add client
      </button>
      <a
        href="/api/coach/clients/export"
        className="tf-press inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink"
      >
        <Icon name="download" size={14} /> Export CSV
      </a>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={pending}
        className="tf-press inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink disabled:opacity-50"
      >
        <Icon name="file" size={14} /> {pending ? 'Importing...' : 'Import CSV'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
      />
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAddOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-display text-lg uppercase tracking-tight">Add client</h3>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="First name" className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-ink" />
                <input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Last name" className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-ink" />
              </div>
              <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} type="email" placeholder="Email (required)" className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-ink" />
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-ink" />
            </div>
            {addErr && <p className="mt-2 text-[12px] text-alert-ink">{addErr}</p>}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={addClient} disabled={pending || !form.email.trim()} className="tf-press flex-1 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-surface disabled:opacity-40">
                {pending ? 'Adding...' : 'Add client'}
              </button>
              <button type="button" onClick={() => setAddOpen(false)} className="tf-press rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-muted">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setResult(null)}>
          <div className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 font-display text-lg uppercase tracking-tight">Import result</h3>
            {result.ok ? (
              <>
                <p className="text-[14px] text-ink">
                  <strong>{result.created ?? 0}</strong> added, <strong>{result.updated ?? 0}</strong> updated
                  {result.skipped ? <>, <strong>{result.skipped}</strong> skipped</> : null}.
                </p>
                {result.errors && result.errors.length > 0 && (
                  <ul className="mt-3 space-y-1 text-[12px] text-alert-ink">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-[14px] text-alert-ink">
                {result.error === 'empty' ? 'That CSV had no rows.' : result.error === 'too_large' || result.error === 'too_many' ? 'That file is too big (max 5,000 rows).' : result.error === 'parse_failed' ? 'Could not read that CSV.' : 'Import failed.'}
              </p>
            )}
            <p className="mt-3 text-[11px] text-faint">Columns: first_name, last_name, email (required), phone, language, product. Matched by email.</p>
            <button type="button" onClick={() => setResult(null)} className="tf-press mt-4 w-full rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-surface">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
