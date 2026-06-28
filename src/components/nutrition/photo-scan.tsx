'use client';

import { useRef, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { logPhotoFoodAction, parseTextToMacroAction } from '@/lib/nutrition/diary-actions';
import { MEAL_SLOTS, type MealSlot } from '@/lib/nutrition/macros';

// Client-safe mirror of the server pipeline's response shape (server module is server-only).
type Macros = { kcal: number; proteinG: number; carbG: number; fatG: number };
type Candidate = {
  predictedName: string;
  grams: number;
  confidence: number;
  matched: boolean;
  food: { id: string; name: string } | null;
  macros: Macros | null;
};
type ApiResult =
  | { status: 'ok'; candidates: Candidate[]; totals: Macros }
  | { status: 'notConfigured' }
  | { status: 'noFood' }
  | { status: 'error' };

const MAX_BYTES = 8_000_000; // 8MB upload ceiling before encoding.

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('read_failed'));
    r.readAsDataURL(file);
  });
}

function confidenceTone(c: number): string {
  if (c >= 0.75) return 'text-accent-ink';
  if (c >= 0.45) return 'text-soft';
  return 'text-faint';
}

export function PhotoScan(): ReactElement {
  const t = useTranslations('app.nutrition');
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'review' | 'notConfigured' | 'noFood' | 'error'>('idle');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [slot, setSlot] = useState<MealSlot>('lunch');
  const [logged, setLogged] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [desc, setDesc] = useState('');

  function reset(): void {
    setPreview(null);
    setPhase('idle');
    setCandidates([]);
    setLogged({});
    setBusy(null);
    setDesc('');
    if (fileRef.current) fileRef.current.value = '';
  }

  // Text-to-macro: parse a natural-language description into the same candidate review flow as photo.
  async function onDescribe(): Promise<void> {
    const text = desc.trim();
    if (text.length < 2) return;
    setPreview(null);
    setPhase('analyzing');
    setCandidates([]);
    setLogged({});
    try {
      const data = (await parseTextToMacroAction(text)) as ApiResult;
      if (data.status === 'ok') {
        setCandidates(data.candidates);
        setPhase('review');
      } else {
        setPhase(data.status);
      }
    } catch {
      setPhase('error');
    }
  }

  async function onFile(file: File): Promise<void> {
    if (file.size > MAX_BYTES) {
      setPhase('error');
      return;
    }
    const dataUrl = await readAsDataUrl(file);
    setPreview(dataUrl);
    setPhase('analyzing');
    setCandidates([]);
    setLogged({});
    try {
      const res = await fetch('/api/nutrition/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      const json = (await res.json()) as { ok: boolean; data?: ApiResult };
      const data = json.data;
      if (!json.ok || !data) {
        setPhase('error');
        return;
      }
      if (data.status === 'ok') {
        setCandidates(data.candidates);
        setPhase('review');
      } else {
        setPhase(data.status);
      }
    } catch {
      setPhase('error');
    }
  }

  async function logOne(i: number): Promise<void> {
    const c = candidates[i];
    if (!c || !c.food || !c.matched) return;
    setBusy(i);
    const res = await logPhotoFoodAction({
      foodId: c.food.id,
      name: c.food.name,
      predictedName: c.predictedName,
      mealSlot: slot,
      grams: c.grams,
    });
    setBusy(null);
    if (res.ok) {
      setLogged((prev) => ({ ...prev, [i]: true }));
      router.refresh();
    }
  }

  async function logAll(): Promise<void> {
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i]?.matched && !logged[i]) {
        // eslint-disable-next-line no-await-in-loop
        await logOne(i);
      }
    }
  }

  const matchedCount = candidates.filter((c) => c.matched).length;
  const remaining = candidates.filter((c, i) => c.matched && !logged[i]).length;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />

      {/* Entry button on the diary */}
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          reset();
        }}
        className="tf-press flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left hover:border-ink"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-bg">
          <Icon name="camera" size={18} />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[14px] font-semibold">
            {t('photoScanTitle')}
            <Icon name="sparkles" size={14} />
          </span>
          <span className="block text-[12px] text-faint">{t('photoScanSubtitle')}</span>
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div
            className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl bg-bg p-5 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-[20px]">{t('photoScanTitle')}</h2>
              <button type="button" onClick={() => setOpen(false)} className="tf-press text-faint hover:text-ink">
                <Icon name="x" size={18} />
              </button>
            </div>

            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="mb-4 max-h-56 w-full rounded-2xl object-cover" />
            )}

            {phase === 'idle' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="tf-press flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-8 text-faint hover:border-ink hover:text-ink"
                >
                  <Icon name="camera" size={28} />
                  <span className="text-[13px] font-medium">{t('photoTakeOrUpload')}</span>
                </button>
                <p className="text-center text-[11px] uppercase tracking-wide text-faint">{t('textScanOr')}</p>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={2}
                  placeholder={t('textScanPlaceholder')}
                  className="w-full resize-none rounded-2xl border border-line bg-bg p-3 text-[14px] outline-none placeholder:text-faint focus:border-ink"
                />
                <button
                  type="button"
                  onClick={() => void onDescribe()}
                  disabled={desc.trim().length < 2}
                  className="tf-press w-full rounded-full bg-ink py-2.5 text-[13px] font-semibold text-bg disabled:opacity-40"
                >
                  {t('textScanCta')}
                </button>
              </div>
            )}

            {phase === 'analyzing' && (
              <div className="flex flex-col items-center gap-2 py-10 text-faint">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ink" />
                <span className="text-[13px]">{t('photoAnalyzing')}</span>
              </div>
            )}

            {phase === 'notConfigured' && (
              <div className="rounded-2xl border border-line bg-surface p-5 text-center">
                <p className="text-[14px] font-semibold">{t('photoNotConfigured')}</p>
                <p className="mt-1 text-[12px] text-faint">{t('photoNotConfiguredNote')}</p>
                <button type="button" onClick={reset} className="tf-press mt-4 rounded-full border border-line px-4 py-2 text-[13px] font-semibold">
                  {t('photoTryAgain')}
                </button>
              </div>
            )}

            {phase === 'noFood' && (
              <div className="rounded-2xl border border-line bg-surface p-5 text-center">
                <p className="text-[14px] font-semibold">{t('photoNoFood')}</p>
                <button type="button" onClick={reset} className="tf-press mt-4 rounded-full border border-line px-4 py-2 text-[13px] font-semibold">
                  {t('photoTryAgain')}
                </button>
              </div>
            )}

            {phase === 'error' && (
              <div className="rounded-2xl border border-line bg-surface p-5 text-center">
                <p className="text-[14px] font-semibold text-alert-ink">{t('photoError')}</p>
                <button type="button" onClick={reset} className="tf-press mt-4 rounded-full border border-line px-4 py-2 text-[13px] font-semibold">
                  {t('photoTryAgain')}
                </button>
              </div>
            )}

            {phase === 'review' && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-faint">{t('meal')}</span>
                  <select
                    value={slot}
                    onChange={(e) => setSlot(e.target.value as MealSlot)}
                    className="rounded-lg border border-line bg-bg px-3 py-1.5 text-[13px] text-ink outline-none focus:border-ink"
                  >
                    {MEAL_SLOTS.map((s) => (
                      <option key={s} value={s}>
                        {t(s)}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="mb-2 text-[12px] text-faint">{t('photoConfirmHint')}</p>

                <div className="flex flex-col gap-2">
                  {candidates.map((c, i) => (
                    <div key={`${c.predictedName}-${i}`} className="rounded-xl border border-line p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[14px] font-semibold">{c.matched && c.food ? c.food.name : c.predictedName}</span>
                            <span className={['text-[11px] font-medium', confidenceTone(c.confidence)].join(' ')}>
                              {Math.round(c.confidence * 100)}%
                            </span>
                          </div>
                          {c.matched && c.food && c.food.name.toLowerCase() !== c.predictedName.toLowerCase() && (
                            <div className="text-[11px] text-faint">{t('photoDetectedAs', { name: c.predictedName })}</div>
                          )}
                          <div className="mt-0.5 text-[12px] text-muted">
                            {c.matched && c.macros ? (
                              <>
                                {Math.round(c.grams)}g · {c.macros.kcal} kcal · {c.macros.proteinG}p / {c.macros.carbG}c / {c.macros.fatG}f
                              </>
                            ) : (
                              <span className="text-faint">{t('photoNoMatch')}</span>
                            )}
                          </div>
                        </div>
                        {c.matched ? (
                          logged[i] ? (
                            <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-accent-ink">
                              <Icon name="check" size={14} />
                              {t('photoLogged')}
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={busy === i}
                              onClick={() => logOne(i)}
                              className="tf-press shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-bg disabled:opacity-50"
                            >
                              <Icon name="plus" size={14} />
                            </button>
                          )
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  {matchedCount > 0 && remaining > 0 && (
                    <button type="button" onClick={logAll} className="tf-press flex-1 rounded-full bg-ink py-2.5 text-[13px] font-semibold text-bg">
                      {t('photoLogAll', { n: remaining })}
                    </button>
                  )}
                  <button type="button" onClick={reset} className="tf-press rounded-full border border-line px-4 py-2.5 text-[13px] font-semibold">
                    {t('photoNewPhoto')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
