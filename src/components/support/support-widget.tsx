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
  // A screenshot OF THE PROBLEM. The public support form has had this since it shipped and the
  // server action has always accepted it; only this modal never offered the control, so a member
  // reporting a visual bug from inside the app had no way to show it. Reported by Rodney on
  // 2026-08-03: "I don't see a spot to upload an image".
  const [shot, setShot] = useState<string | null>(null);
  const [shotName, setShotName] = useState('');
  const [shotErr, setShotErr] = useState('');

  const close = (): void => {
    setOpen(false); setDone(false); setSubject(''); setBody(''); setErr(null);
    setShot(null); setShotName(''); setShotErr('');
  };
  const submit = (): void => {
    if (!subject.trim() || pending) return;
    setErr(null);
    start(async () => {
      const res = await submitSupportTicketAction({ subject, body, category, priority, attachment: shot ?? undefined });
      if (res.ok) setDone(true);
      else setErr(res.error === 'rate_limited' ? t('rateLimited') : t('failed'));
    });
  };

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0];
    setShotErr('');
    if (!f) { setShot(null); setShotName(''); return; }
    // 10MB matches the bucket limit. Checked here so a member on a phone learns instantly instead of
    // waiting out a long upload the server was always going to reject.
    if (f.size > 10 * 1024 * 1024) { setShotErr(t('attachTooBig')); setShot(null); setShotName(''); return; }
    const r = new FileReader();
    r.onload = () => { setShot(String(r.result)); setShotName(f.name); };
    r.onerror = () => setShotErr(t('attachReadFail'));
    r.readAsDataURL(f);
  };

  return (
    <>
      {/* Ink, not accent. Green is a functional signal only (streaks, positive deltas, success), and
          a support tab is navigation, not a status, so bg-accent here was a decorative-green brand
          violation. Also moved off the vertical centre (top-1/2), where a fixed solid tab crossed
          the middle of every content card, down to just above the bottom nav where nothing sits. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tf-press fixed right-0 bottom-[168px] z-40 rounded-l-lg bg-ink px-2 py-4 text-[11px] font-semibold uppercase tracking-[1px] text-white shadow-lg [writing-mode:vertical-rl] lg:bottom-28"
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
                <div className="mt-3">
                  <label className="block cursor-pointer rounded-xl border border-dashed border-line px-3 py-2.5 text-[13px] text-soft hover:border-ink hover:text-ink">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/heic,image/heif,image/gif"
                      className="hidden"
                      onChange={pickFile}
                    />
                    {shotName ? `📎 ${shotName}` : t('attach')}
                  </label>
                  {shot && (
                    // Show it back. A member who attached the wrong screenshot should find that out
                    // here, not after support replies asking for a different one.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shot} alt="" className="mt-2 max-h-32 rounded-lg border border-line object-contain" />
                  )}
                  {shotErr && <p className="mt-1 text-[12px] text-alert-ink">{shotErr}</p>}
                </div>
                {err && <p className="mt-2 text-[12px] text-alert-ink">{err}</p>}
                <button type="button" onClick={submit} disabled={pending || !subject.trim()} className="tf-press mt-4 w-full rounded-xl bg-ink px-4 py-3 text-[14px] font-semibold text-surface disabled:opacity-40">
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
