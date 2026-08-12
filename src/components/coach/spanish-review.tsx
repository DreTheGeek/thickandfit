'use client';

// The review desk: draft a batch of Spanish, edit anything that is off, approve it.
//
// Twenty at a time rather than all 360, because a review screen that cannot be finished in one
// sitting does not get finished at all, and because each approved batch is written before the next
// is drafted. Closing the tab halfway through costs the current batch, never the work already done.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { draftSpanishAction, approveSpanishAction, type DraftRow } from '@/app/(app)/coach/spanish/spanish-actions';

const BATCH = 20;

const inputCls =
  'w-full rounded-lg border border-line bg-bg px-2.5 py-1.5 text-[13px] outline-none focus:border-ink';

export function SpanishReview({ missing, total }: { missing: number; total: number }): ReactElement {
  const t = useTranslations('app.coach');
  const router = useRouter();
  const [rows, setRows] = useState<DraftRow[] | null>(null);
  const [left, setLeft] = useState(missing);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();

  function edit(id: string, field: 'name_es' | 'cues_es', value: string): void {
    // Functional updater, not a splice of the captured array: typing in two fields quickly enough
    // that React batches the renders would otherwise drop the first edit.
    setRows((cur) => (cur ?? []).map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function draft(): void {
    setErr('');
    setNote('');
    start(async () => {
      const res = await draftSpanishAction({ limit: BATCH });
      if (!res.ok) {
        setErr(t(res.error === 'notConfigured' ? 'esNotConfigured' : res.error === 'none' ? 'esAllDone' : 'esFailed'));
        return;
      }
      setRows(res.rows);
      setLeft(res.remaining);
    });
  }

  function approve(): void {
    if (!rows) return;
    setErr('');
    setNote('');
    start(async () => {
      const res = await approveSpanishAction({
        rows: rows.map((r) => ({ id: r.id, name_es: r.name_es.trim(), cues_es: r.cues_es.trim() })),
      });
      if (!res.ok) {
        setErr(t('esFailed'));
        return;
      }
      setRows(null);
      setLeft(res.remaining);
      setNote(t('esApproved', { n: res.written, left: res.remaining }));
      router.refresh();
    });
  }

  const done = total - left;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-display text-[26px] leading-none tabular-nums">
            {done}
            <span className="text-faint">/{total}</span>
          </span>
          <span className="text-[13px] text-muted">{t('esProgress', { left })}</span>
        </div>
        {/* A bare "360 missing" is a number; the bar is how much of her library a Spanish-speaking
            member can actually read. */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-warm">
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-500"
            style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%` }}
          />
        </div>
      </div>

      {err ? <p className="text-[13px] text-alert-ink">{err}</p> : null}
      {note ? <p className="text-[13px] text-accent-ink">{note}</p> : null}

      {rows === null ? (
        <div className="rounded-2xl bg-surface p-8 text-center">
          <p className="tf-measure mx-auto mb-4 text-[13px] text-muted">
            {left > 0 ? t('esDraftHint', { n: Math.min(BATCH, left) }) : t('esAllDone')}
          </p>
          {left > 0 && (
            <button
              type="button"
              onClick={draft}
              disabled={pending}
              className="tf-press rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-bg disabled:opacity-40"
            >
              {pending ? t('esDrafting') : t('esDraft', { n: Math.min(BATCH, left) })}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-2xl bg-surface p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {/* English on the left, always, and not editable here. The question she is
                      answering is "does the Spanish mean this movement", which needs both in view. */}
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                      {t('esEnglish')}
                    </p>
                    <p className="mt-1 text-[14px] font-semibold text-ink">{r.nameEn}</p>
                    {r.cuesEn ? <p className="mt-1 text-[12px] leading-relaxed text-muted">{r.cuesEn}</p> : null}
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                      {t('esSpanish')}
                    </p>
                    <input
                      className={inputCls}
                      value={r.name_es}
                      aria-label={`${t('esSpanish')}: ${r.nameEn}`}
                      onChange={(e) => edit(r.id, 'name_es', e.target.value)}
                      maxLength={200}
                    />
                    <textarea
                      className={`${inputCls} mt-2 min-h-[64px] resize-y leading-relaxed`}
                      value={r.cues_es}
                      aria-label={`${t('esCues')}: ${r.nameEn}`}
                      onChange={(e) => edit(r.id, 'cues_es', e.target.value)}
                      maxLength={4000}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="sticky bottom-3 flex flex-wrap items-center gap-2 rounded-full bg-ink px-4 py-3 text-bg">
            <button
              type="button"
              onClick={approve}
              disabled={pending || rows.some((r) => r.name_es.trim().length === 0)}
              className="tf-press rounded-full bg-bg px-4 py-2 text-[13px] font-semibold text-ink disabled:opacity-40"
            >
              {pending ? t('esApproving') : t('esApprove', { n: rows.length })}
            </button>
            <button
              type="button"
              onClick={() => setRows(null)}
              disabled={pending}
              className="tf-press px-2 text-[13px] font-semibold text-bg/70 hover:text-bg"
            >
              {t('esDiscard')}
            </button>
            <span className="ml-auto text-[12px] text-bg/60">{t('esReviewHint')}</span>
          </div>
        </>
      )}
    </div>
  );
}
