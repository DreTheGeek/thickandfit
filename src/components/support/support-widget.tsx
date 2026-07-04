'use client';
// Floating "Support" tab (right edge) that opens a New Support Ticket modal. Submits to the support
// queue that flows into the operator admin portal. Bilingual.
import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { submitSupportTicketAction } from '@/lib/support/ticket-actions';

const CATEGORIES = ['question', 'bug', 'feature_request', 'billing', 'other'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export function SupportWidget(): ReactElement {
  const t = useTranslations('app.support');
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('question');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('medium');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const close = (): void => { setOpen(false); setDone(false); setSubject(''); setBody(''); setErr(null); };
  const submit = (): void => {
    if (!subject.trim() || pending) return;
    setErr(null);
    start(async () => {
      const res = await submitSupportTicketAction({ subject, body, category, priority });
      if (res.ok) setDone(true);
      else setErr(res.error === 'rate_limited' ? t('rateLimited') : t('failed'));
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 z-40 -translate-y-1/2 rounded-l-lg bg-accent px-2 py-4 text-[11px] font-semibold uppercase tracking-[1px] text-accent-ink shadow-lg [writing-mode:vertical-rl]"
        aria-label={t('title')}
      >
        {t('tab')}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={close}>
          <div className="w-full max-w-md rounded-t-2xl bg-surface p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            {done ? (
              <div className="py-6 text-center">
                <div className="mb-2 text-2xl">✓</div>
                <h3 className="font-display text-lg uppercase tracking-tight">{t('sentTitle')}</h3>
                <p className="mt-1 text-[13px] text-muted">{t('sentBody')}</p>
                <button type="button" onClick={close} className="tf-press mt-4 w-full rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-surface">{t('close')}</button>
              </div>
            ) : (
              <>
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="font-display text-lg uppercase tracking-tight">{t('title')}</h3>
                  <button type="button" onClick={close} aria-label={t('close')} className="tf-press text-faint">✕</button>
                </div>
                <p className="mb-3 text-[12px] text-muted">{t('subtitle')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[12px] font-medium text-soft">
                    {t('category')}
                    <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-ink">
                      {CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat_${c}`)}</option>)}
                    </select>
                  </label>
                  <label className="text-[12px] font-medium text-soft">
                    {t('priority')}
                    <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-ink">
                      {PRIORITIES.map((p) => <option key={p} value={p}>{t(`pri_${p}`)}</option>)}
                    </select>
                  </label>
                </div>
                <label className="mt-3 block text-[12px] font-medium text-soft">
                  {t('subject')}
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('subjectPlaceholder')} className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-ink" />
                </label>
                <label className="mt-3 block text-[12px] font-medium text-soft">
                  {t('description')}
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder={t('descriptionPlaceholder')} className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-ink" />
                </label>
                {err && <p className="mt-2 text-[12px] text-alert-ink">{err}</p>}
                <button type="button" onClick={submit} disabled={pending || !subject.trim()} className="tf-press mt-4 w-full rounded-xl bg-accent px-4 py-3 text-[14px] font-semibold text-accent-ink disabled:opacity-40">
                  {pending ? t('sending') : t('submit')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
