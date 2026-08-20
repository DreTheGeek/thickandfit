'use client';

// Member-facing physique read on a progress photo: a button on each photo that runs the analyzer and
// shows a supportive coach's-eye body-comp estimate + staged plan in Stephanie's voice. Body-fat is
// always shown as a RANGE with a "not a medical measurement" disclaimer.
import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { analyzePhysiqueAction } from '@/lib/coach-ai/physique-actions';
import type { PhysiqueAnalysis } from '@/lib/coach-ai/physique';

const KG_TO_LB = 2.20462;

export function PhysiqueAnalysisButton({
  imageUrl,
  photoId,
  weightKg,
}: {
  imageUrl: string | null;
  photoId: string;
  weightKg: number | null;
}): ReactElement {
  const t = useTranslations('app.progress');
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<PhysiqueAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function analyze(): void {
    if (!imageUrl) return;
    setOpen(true);
    setError(null);
    setResult(null);
    start(async () => {
      const res = await analyzePhysiqueAction({
        imageUrl,
        weightLb: weightKg != null ? Math.round(weightKg * KG_TO_LB) : null,
        progressPhotoId: photoId,
      });
      if (res.status === 'ok') setResult(res.analysis);
      else setError(res.status === 'notConfigured' ? t('aiNotReady') : t('analyzeFailed'));
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={analyze}
        disabled={!imageUrl}
        className="tf-press mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-full border border-line py-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-muted disabled:opacity-40"
      >
        {/* ruler, not sparkles: this is a measurement read off her photo, presented as a range
            with a disclaimer. Dressing it as magic oversells exactly the number that needs the
            most hedging. */}
        <Icon name="ruler" size={13} />
        {t('analyzePhoto')}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="tf-scroll max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-5 sm:rounded-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-[20px]">{t('analyzeTitle')}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('close')} className="tf-press text-faint">
                <Icon name="x" size={20} />
              </button>
            </div>

            {pending && <p className="py-8 text-center text-[14px] text-faint">{t('analyzing')}</p>}
            {error && <p className="py-8 text-center text-[14px] text-alert-ink">{error}</p>}

            {result && (
              <div className="flex flex-col gap-4">
                {result.bfLow != null && result.bfHigh != null && (
                  <div className="rounded-xl border border-divider p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">{t('estimateLabel')}</div>
                    <div className="mt-1 font-display text-[26px]">~{result.bfLow}-{result.bfHigh}%</div>
                    <p className="mt-1 text-[12px] leading-relaxed text-faint">{t('estimateDisclaimer')}</p>
                  </div>
                )}

                <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{result.narrative}</p>

                {result.assessment.strengths.length > 0 && (
                  <Section title={t('whatsWorking')} items={result.assessment.strengths} accent />
                )}
                {result.assessment.focusAreas.length > 0 && (
                  <Section title={t('focusOn')} items={result.assessment.focusAreas} />
                )}

                {(result.goals.staged.length > 0 || result.goals.timeline || result.goals.approach) && (
                  <div className="rounded-xl border border-divider p-4">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[1px] text-faint">{t('thePlan')}</div>
                    {result.goals.staged.map((g, i) => (
                      <div key={i} className="flex items-start gap-2 py-1 text-[14px]">
                        <span className="mt-0.5 text-accent">{i + 1}.</span>
                        <span>{g}</span>
                      </div>
                    ))}
                    {result.goals.timeline && (
                      <p className="mt-2 text-[13px] text-muted">
                        <span className="font-semibold">{t('timeline')}: </span>{result.goals.timeline}
                      </p>
                    )}
                    {result.goals.approach && (
                      <p className="mt-1 text-[13px] text-muted">
                        <span className="font-semibold">{t('approach')}: </span>{result.goals.approach}
                      </p>
                    )}
                  </div>
                )}

                {result.flagged && (
                  <div className="rounded-xl border border-accent/40 bg-warm p-3 text-[13px] leading-relaxed">
                    {t('flaggedNote')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, items, accent = false }: { title: string; items: string[]; accent?: boolean }): ReactElement {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-faint">{title}</div>
      <ul className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-[14px]">
            <span className={accent ? 'mt-0.5 text-accent' : 'mt-0.5 text-faint'}>•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
