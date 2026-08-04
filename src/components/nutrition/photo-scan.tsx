'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { CoachMomentCard } from '@/components/nutrition/coach-moment-card';
import type { CoachMoment } from '@/lib/nutrition/coach-moment';
import {
  logPhotoFoodAction,
  parseTextToMacroAction,
  lookupBarcodeAction,
  logFoodAction,
  deleteFoodLogAction,
} from '@/lib/nutrition/diary-actions';
import {
  MEAL_SLOTS,
  macrosForGrams,
  gramsFromAmount,
  SERVING_UNITS,
  type MealSlot,
  type FoodLite,
  type ServingUnit,
} from '@/lib/nutrition/macros';
import { decodeBarcodeFromImage } from '@/lib/nutrition/barcode-scan';
import { measureImageQuality, type ImageQuality } from '@/lib/nutrition/image-quality';
// No-ops on the web and imports nothing into the browser bundle; see the header of bridge.ts.
import { capturePhoto, tapFeedback } from '@/lib/native/bridge';

// Client-safe mirror of the server pipeline's response shape (server module is server-only).
type Macros = { kcal: number; proteinG: number; carbG: number; fatG: number };
type Candidate = {
  predictedName: string;
  grams: number;
  confidence: number;
  matched: boolean;
  food: { id: string; name: string } | null;
  macros: Macros | null;
  /** K5 (trust surface): the model's stated portion-reasoning; nice UX per item when we have it. */
  basis?: string;
};
type ApiResult =
  | { status: 'ok'; candidates: Candidate[]; totals: Macros; inferenceId?: string }
  | { status: 'product'; food: FoodLite; clarify: string | null; inferenceId?: string }
  | { status: 'clarify'; clarify: string }
  | { status: 'notConfigured' }
  | { status: 'noFood' }
  | { status: 'error' };

const MAX_BYTES = 8_000_000; // 8MB upload ceiling before encoding.

// Fire-and-forget prewarm so the vision Lambda is hot by the time the user submits the photo (biggest
// prod latency win: it removes the cold start from the critical path). Never awaited.
function warmupScan(): void {
  void fetch('/api/nutrition/photo/warmup', { method: 'GET', keepalive: true }).catch(() => {});
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('read_failed'));
    r.readAsDataURL(file);
  });
}

// Downscale a captured image before sending it to the vision model: smaller image = far faster scan
// and cheaper tokens, with no meaningful loss for food recognition. Barcode decoding stays on the
// full-res original (it needs the detail). Falls back to the original on any failure.
function resizeImage(dataUrl: string, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      if (scale >= 1) {
        resolve(dataUrl);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Confidence tiers (the friction dial). >=HIGH logs silently; MID gets a subtle double-check hint;
// <LOW gets real attention (ring + confirm-tap) because that is exactly the item someone should
// eyeball. Low confidence renders in the alert tone, never faint: faint visually DEMOTES the one
// row that needs eyes.
const CONF_HIGH = 0.9;
const CONF_LOW = 0.7;

/**
 * Confidence-gated auto-accept (PRD-D). DEFAULT OFF: absent env var = today's confirm-first flow,
 * byte-identical.
 *
 * No mainstream competitor ships this (Cal AI logs-then-fix, MacroFactor is review-first), which is
 * the opportunity AND the reason for the flag: skipping the confirm screen is only defensible once
 * the eval says high-confidence scans are actually right. It stays off until the fat-bias baseline
 * and F1/MAPE bars in PRD-D5 are met for the active model.
 *
 * Client-readable env is correct here: a UX switch, not a secret.
 */
const AUTO_ACCEPT = process.env.NEXT_PUBLIC_SCAN_AUTO_ACCEPT === '1';

function confidenceTone(c: number): string {
  if (c >= CONF_HIGH) return 'text-accent-ink';
  if (c >= CONF_LOW) return 'text-soft';
  return 'text-alert';
}

// Macros are linear in grams, so scaling the predicted macros by (edited / predicted) grams is exact -
// lets the review row show live totals as the user adjusts a portion without a server round-trip.
function scaleMacros(m: Macros, factor: number): Macros {
  return {
    kcal: Math.round(m.kcal * factor),
    proteinG: Math.round(m.proteinG * factor),
    carbG: Math.round(m.carbG * factor),
    fatG: Math.round(m.fatG * factor),
  };
}

function unitLabel(u: ServingUnit, t: ReturnType<typeof useTranslations>): string {
  switch (u) {
    case 'oz':
      return 'oz';
    case 'ml':
      return 'mL';
    case 'floz':
      return t('unitFloz');
    case 'cup':
      return t('unitCup');
    case 'tbsp':
      return t('unitTbsp');
    default:
      return 'g';
  }
}

export function PhotoScan({
  open: openProp,
  onOpenChange,
  hideTrigger = false,
  logDate,
}: {
  /** Controlled open state (e.g. driven by the global capture FAB). Omit for the self-contained diary card. */
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  /** Hide the inline diary entry button (when the FAB owns the trigger). */
  hideTrigger?: boolean;
  /** ISO date of the day being viewed; omit for today. Logs land on this day, not always today. */
  logDate?: string;
} = {}): ReactElement {
  const t = useTranslations('app.nutrition');
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  function setOpen(v: boolean): void {
    if (onOpenChange) onOpenChange(v);
    else setOpenInternal(v);
  }
  // Warm the scan Lambda the moment the sheet opens (covers the FAB-controlled path too), so the
  // user's framing time is spent warming the exact instance the real scan will hit.
  useEffect(() => {
    if (open) warmupScan();
  }, [open]);
  const [preview, setPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'lowQuality' | 'review' | 'product' | 'clarify' | 'notConfigured' | 'noFood' | 'error'>('idle');
  // K2: when a captured photo trips the quality gate we stash it here so [Scan anyway] can proceed
  // without a re-encode. Cleared on retake / new photo. `qualityInfo` drives the message tone.
  const [qualityInfo, setQualityInfo] = useState<ImageQuality | null>(null);
  const [stashedScanImage, setStashedScanImage] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  // Provenance id of the scan that produced these candidates + the ORIGINAL predicted grams per row, so
  // logging can send the predicted-vs-edited delta (the correction signal) back to the inference.
  const [inferenceId, setInferenceId] = useState<string | null>(null);
  const [predictedGrams, setPredictedGrams] = useState<number[]>([]);
  // The food id each candidate ORIGINALLY matched, so a swap to a different food is detectable
  // server-side as an identity correction (names are noise; only the id comparison is signal).
  const [predictedFoodIds, setPredictedFoodIds] = useState<(string | null)[]>([]);
  // Confidence-tier state: touched = the user adjusted this portion (editing IS confirming);
  // armed = a low-confidence Add was tapped once (the second tap logs). High/mid tiers never gate.
  const [touched, setTouched] = useState<Record<number, boolean>>({});
  const [armed, setArmed] = useState<Record<number, boolean>>({});
  const gramsRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [slot, setSlot] = useState<MealSlot>('lunch');
  const [logged, setLogged] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState<number | null>(null);
  // The post-log coaching line, returned by the log action itself (no extra round trip).
  const [coachMoment, setCoachMoment] = useState<CoachMoment | null>(null);
  // Auto-accept (PRD-D): what was logged without a confirm screen, and the ids Undo would remove.
  const [autoLogged, setAutoLogged] = useState<{ names: string[]; logIds: string[] } | null>(null);
  const [desc, setDesc] = useState('');
  // Barcode / packaged-product result (a single food + a real amount to confirm).
  const [productFood, setProductFood] = useState<FoodLite | null>(null);
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState<ServingUnit>('g');
  const [productLogged, setProductLogged] = useState(false);
  const [productBusy, setProductBusy] = useState(false);
  const [clarify, setClarify] = useState<string | null>(null);

  function reset(): void {
    setPreview(null);
    setPhase('idle');
    setCandidates([]);
    setInferenceId(null);
    setPredictedGrams([]);
    setPredictedFoodIds([]);
    setTouched({});
    setArmed({});
    setLogged({});
    setBusy(null);
    setDesc('');
    setProductFood(null);
    setQty('1');
    setUnit('g');
    setProductLogged(false);
    setClarify(null);
    setQualityInfo(null);
    setStashedScanImage(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function logProduct(): Promise<void> {
    if (!productFood) return;
    const grams = gramsFromAmount(Number(qty), unit, productFood.densityGPerMl);
    if (grams <= 0) return;
    setProductBusy(true);
    // A vision-read product (label/packaging) is a PHOTO log with provenance; only a decoded
    // barcode is source 'barcode'. Mislabeling killed provenance for every label scan.
    const res = await logFoodAction({
      foodId: productFood.id,
      name: productFood.name,
      mealSlot: slot,
      grams,
      source: inferenceId ? 'photo' : 'barcode',
      aiInferenceId: inferenceId ?? undefined,
      logDate,
    });
    setProductBusy(false);
    if (res.ok) {
      setProductLogged(true);
      // The product/barcode path deserves the same moment as a meal scan: the member logged food,
      // and how she got there is our implementation detail, not her concern.
      if (res.coachMoment) setCoachMoment(res.coachMoment);
      router.refresh();
    }
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
        setPredictedGrams(data.candidates.map((c) => c.grams));
        setPredictedFoodIds(data.candidates.map((c) => c.food?.id ?? null));
        setInferenceId(data.inferenceId ?? null); // text predictions now carry provenance too
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
    warmupScan(); // belt-and-suspenders: warms during the barcode-decode + downscale window (~1-2s)
    await onDataUrl(await readAsDataUrl(file));
  }

  /**
   * The scan pipeline, from an image that is already a data URL.
   *
   * Split out from onFile so the iOS camera can feed it directly. Capacitor hands back a data URL,
   * not a File, and round-tripping it through a Blob only to read it back would be work done twice.
   * Everything from here down is identical whichever way the photo arrived.
   */
  async function onDataUrl(dataUrl: string): Promise<void> {
    warmupScan();
    setPreview(dataUrl);
    setPhase('analyzing');
    setCandidates([]);
    setLogged({});
    // A picture of a package / barcode: decode it first -> the exact product via Open Food Facts.
    const code = await decodeBarcodeFromImage(dataUrl);
    if (code) {
      const bc = await lookupBarcodeAction(code);
      if (bc.ok && bc.food) {
        setInferenceId(null); // barcode path has no vision inference; never leak a stale meal-scan id
        setProductFood(bc.food);
        const drink =
          bc.food.densityGPerMl != null ||
          /juice|milk|drink|soda|water|tea|coffee|smoothie|shake/i.test(bc.food.name);
        setQty(drink ? '1' : '100');
        setUnit(drink ? 'cup' : 'g');
        setProductLogged(false);
        setPhase('product');
        return;
      }
      // Barcode present but not in Open Food Facts -> fall through to the vision pipeline.
    }
    // Downscale for the vision call (the barcode was already read from the full-res original above).
    const scanImage = await resizeImage(dataUrl, 1280, 0.82);

    // K2 image-quality gate: cheap client-side check on the resized pixels the model will see.
    // If it trips, stash the image and surface the retake/proceed choice — but never block a photo
    // we can't measure (older phones, weird formats), and never block on non-lowQuality metrics.
    const quality = await measureImageQuality(scanImage);
    if (quality?.lowQuality) {
      setQualityInfo(quality);
      setStashedScanImage(scanImage);
      setPhase('lowQuality');
      return;
    }
    await runVisionScan(scanImage);
  }

  /** The vision-model round-trip + response routing, extracted so [Scan anyway] can re-enter it
   *  without a duplicate downscale or a second quality check. Keeps the API/state flow in one place. */
  async function runVisionScan(scanImage: string): Promise<void> {
    setPhase('analyzing');
    try {
      const res = await fetch('/api/nutrition/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: scanImage }),
      });
      const json = (await res.json()) as { ok: boolean; data?: ApiResult };
      const data = json.data;
      if (!json.ok || !data) {
        setPhase('error');
        return;
      }
      if (data.status === 'ok') {
        setCandidates(data.candidates);
        setPredictedGrams(data.candidates.map((c) => c.grams));
        setPredictedFoodIds(data.candidates.map((c) => c.food?.id ?? null));
        setInferenceId(data.inferenceId ?? null);
        setPhase('review');
        // Every item confident AND resolved, or the member reviews it. One unmatched or uncertain
        // item is enough to fall through: silently logging a guess is exactly the behavior that
        // makes people stop trusting a tracker.
        if (AUTO_ACCEPT && data.candidates.length > 0 && data.candidates.every((c) => c.matched && c.confidence >= CONF_HIGH)) {
          void autoAccept(data.candidates, data.inferenceId ?? null);
        }
      } else if (data.status === 'product') {
        // The photo was a single packaged product / label -> confirm the amount. Keep the inference
        // id so the log links back to the scan (provenance + correction capture).
        setInferenceId(data.inferenceId ?? null);
        setProductFood(data.food);
        setClarify(data.clarify);
        const drink =
          data.food.densityGPerMl != null ||
          /juice|milk|drink|soda|water|tea|coffee|smoothie|shake/i.test(data.food.name);
        setQty(drink ? '1' : '100');
        setUnit(drink ? 'cup' : 'g');
        setProductLogged(false);
        setPhase('product');
      } else if (data.status === 'clarify') {
        setClarify(data.clarify);
        setPhase('clarify');
      } else {
        setPhase(data.status);
      }
    } catch {
      setPhase('error');
    }
  }

  // Adjust a detected portion in place. The predicted grams are kept separately (predictedGrams[i]) so
  // the change becomes the correction signal on log; macros rescale live off the predicted macros.
  // Editing the portion IS confirming it (clears the low-confidence gate for this row).
  function updateGrams(i: number, next: number): void {
    const g = Math.max(1, Math.min(5000, Math.round(next || 0)));
    setTouched((prev) => ({ ...prev, [i]: true }));
    setCandidates((prev) => prev.map((c, idx) => (idx === i ? { ...c, grams: g } : c)));
  }

  /**
   * Log every item as predicted, with no confirm screen.
   *
   * Accepted-as-is flows through the EXISTING correction capture with `fields: []`, which
   * recordItemOutcome already treats as a confirmed-correct prediction. So auto-accept does not
   * blind the learning loop; it feeds it the positive signal it was already designed to record.
   *
   * predictedFoodId/predictedGrams are the same values being logged, which is what makes that
   * possible: nothing is invented, so provenance stays intact (AC-4).
   */
  async function autoAccept(cands: Candidate[], infId: string | null): Promise<void> {
    const names: string[] = [];
    const logIds: string[] = [];
    let lastMoment: CoachMoment | null = null;
    for (const c of cands) {
      if (!c.food) continue;
      const res = await logPhotoFoodAction({
        foodId: c.food.id,
        name: c.food.name,
        predictedName: c.predictedName,
        mealSlot: slot,
        grams: c.grams,
        predictedGrams: c.grams,
        predictedFoodId: c.food.id,
        confidence: c.confidence,
        aiInferenceId: infId ?? undefined,
        logDate,
      });
      if (res.ok) {
        names.push(c.food.name);
        if (res.logId) logIds.push(res.logId);
        if (res.coachMoment) lastMoment = res.coachMoment;
      }
    }
    if (!names.length) return; // every write failed: leave the confirm UI up rather than lie
    setLogged(Object.fromEntries(cands.map((_, i) => [i, true])));
    setAutoLogged({ names, logIds });
    setCoachMoment(lastMoment);
    router.refresh();
  }

  /** Remove everything auto-accept just wrote. The escape hatch that makes skipping confirm fair. */
  async function undoAutoAccept(): Promise<void> {
    const ids = autoLogged?.logIds ?? [];
    setAutoLogged(null);
    setCoachMoment(null);
    setLogged({});
    for (const id of ids) await deleteFoodLogAction(id);
    router.refresh();
  }

  async function logOne(i: number): Promise<void> {
    const c = candidates[i];
    if (!c || !c.food || !c.matched) return;
    // Low-confidence gate: the first Add tap arms the row (focus the portion, switch the button to
    // an explicit confirm) instead of logging a portion nobody looked at. Second tap logs normally.
    // High/mid confidence never gates - the one-tap thesis stays intact where the model is sure.
    if (c.confidence < CONF_LOW && !touched[i] && !armed[i]) {
      setArmed((prev) => ({ ...prev, [i]: true }));
      gramsRefs.current[i]?.focus();
      return;
    }
    setBusy(i);
    const res = await logPhotoFoodAction({
      foodId: c.food.id,
      name: c.food.name,
      predictedName: c.predictedName,
      mealSlot: slot,
      grams: c.grams,
      predictedGrams: predictedGrams[i] ?? c.grams,
      predictedFoodId: predictedFoodIds[i] ?? undefined,
      confidence: c.confidence,
      aiInferenceId: inferenceId ?? undefined,
      logDate,
    });
    setBusy(null);
    if (res.ok) {
      setLogged((prev) => ({ ...prev, [i]: true }));
      // Last write wins during a bulk log: each item recomputes today's totals, so the final one
      // holds the true end-of-log numbers. Showing an intermediate line would understate her day.
      if (res.coachMoment) setCoachMoment(res.coachMoment);
      router.refresh();
    }
  }

  // Bulk-log confident items; low-confidence rows the user never looked at (not touched, not
  // armed) stay listed with their attention treatment instead of being silently bulk-logged.
  async function logAll(): Promise<void> {
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (!c?.matched || logged[i]) continue;
      if (c.confidence < CONF_LOW && !touched[i] && !armed[i]) continue;
      await logOne(i);
    }
  }

  const matchedCount = candidates.filter((c) => c.matched).length;
  const remaining = candidates.filter((c, i) => c.matched && !logged[i]).length;
  const lowSkipped = candidates.filter(
    (c, i) => c.matched && !logged[i] && c.confidence < CONF_LOW && !touched[i] && !armed[i],
  ).length;

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

      {/* Entry button on the diary (hidden when the global capture FAB owns the trigger) */}
      {!hideTrigger && (
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(true);
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
      )}

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
                  onClick={() => {
                    // Real camera on iOS, file input everywhere else. capturePhoto() returns null on
                    // the web AND when she cancels, and both mean the same thing here: fall through
                    // to the input, which on mobile Safari opens the same camera sheet she expects.
                    void (async () => {
                      const shot = await capturePhoto();
                      if (shot) {
                        void tapFeedback('light');
                        await onDataUrl(shot);
                        return;
                      }
                      fileRef.current?.click();
                    })();
                  }}
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

            {phase === 'lowQuality' && (
              <div className="rounded-2xl border border-line bg-surface p-5 text-center">
                <p className="text-[14px] font-semibold">
                  {qualityInfo?.tooDark && qualityInfo?.tooBlurry
                    ? t('photoLowQualityBoth')
                    : qualityInfo?.tooDark
                      ? t('photoLowQualityDark')
                      : qualityInfo?.tooBlurry
                        ? t('photoLowQualityBlur')
                        : t('photoLowQuality')}
                </p>
                <p className="mt-1 text-[12px] text-faint">{t('photoLowQualityHelp')}</p>
                <div className="mt-4 flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="tf-press rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-surface"
                  >
                    {t('photoLowQualityRetake')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!stashedScanImage) return;
                      void runVisionScan(stashedScanImage);
                    }}
                    className="tf-press text-[12px] font-medium text-faint underline underline-offset-2"
                  >
                    {t('photoLowQualityProceed')}
                  </button>
                </div>
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
                          {/* K5 trust surface: the model's own portion reasoning ("dinner plate ~26cm,
                              food covers ~1/3, thickness ~2cm"). Shown at text-muted so it carries a
                              bit more weight than the "detected as" breadcrumb — it's WHY, not
                              plumbing. Only rendered when the model actually returned one. */}
                          {c.basis && (
                            <div className="mt-1 text-[11px] leading-snug text-muted">{c.basis}</div>
                          )}
                          {c.matched && c.macros ? (
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min="1"
                                  step="5"
                                  value={Math.round(c.grams)}
                                  onChange={(e) => updateGrams(i, Number(e.target.value))}
                                  ref={(el) => {
                                    gramsRefs.current[i] = el;
                                  }}
                                  aria-label={t('productAmount')}
                                  className={[
                                    'w-16 rounded-lg border bg-bg px-2 py-1 text-[13px] tabular-nums outline-none focus:border-ink',
                                    c.confidence < CONF_LOW && !touched[i] && !armed[i]
                                      ? 'border-alert ring-1 ring-alert/30'
                                      : 'border-line',
                                  ].join(' ')}
                                />
                                <span className="text-[12px] text-faint">g</span>
                              </span>
                              {(() => {
                                const base = predictedGrams[i] ?? c.grams;
                                const sm = scaleMacros(c.macros, base > 0 ? c.grams / base : 1);
                                return (
                                  <span className="text-[12px] text-muted">
                                    {sm.kcal} kcal · {sm.proteinG}p / {sm.carbG}c / {sm.fatG}f
                                  </span>
                                );
                              })()}
                            </div>
                          ) : (
                            <div className="mt-0.5 text-[12px] text-faint">{t('photoNoMatch')}</div>
                          )}
                          {c.matched && c.macros && c.confidence < CONF_LOW && !logged[i] ? (
                            <div className="mt-1 text-[11px] text-alert">{t('photoLowConfidence')}</div>
                          ) : c.matched && c.macros && c.confidence < CONF_HIGH && !logged[i] ? (
                            <div className="mt-1 text-[11px] text-faint">{t('photoCheckPortion')}</div>
                          ) : null}
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
                              {armed[i] && !touched[i] ? t('photoConfirmAdd') : <Icon name="plus" size={14} />}
                            </button>
                          )
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {lowSkipped > 0 && remaining > lowSkipped ? (
                  <p className="mt-2 text-[11px] text-faint">{t('photoLowSkipped', { n: lowSkipped })}</p>
                ) : null}
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
                {/* Auto-accept summary + Undo. ONE surface: the coach moment renders inside this
                    block rather than as a second competing toast. Persistent until dismissed, not a
                    timed disappearance, because the whole bargain of skipping the confirm screen is
                    that reversing it must be at least as easy as confirming would have been. */}
                {autoLogged && (
                  <div className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 text-[13px] text-ink">
                        {t('autoLogged', { items: autoLogged.names.join(', ') })}
                      </p>
                      <button
                        type="button"
                        onClick={() => void undoAutoAccept()}
                        className="tf-press shrink-0 rounded-full border border-line px-3 py-1 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink"
                      >
                        {t('autoUndo')}
                      </button>
                    </div>
                    <CoachMomentCard moment={coachMoment} />
                  </div>
                )}

                {/* Under the confirmation, not over it: the member came here to log a meal, and the
                    coaching line is the reward for finishing, not an interruption. */}
                {!autoLogged && <CoachMomentCard moment={coachMoment} />}
              </div>
            )}

            {phase === 'clarify' && (
              <div>
                <p className="mb-3 text-[15px] font-medium">{clarify}</p>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={2}
                  placeholder={t('clarifyPlaceholder')}
                  className="mb-3 w-full resize-none rounded-2xl border border-line bg-bg p-3 text-[14px] outline-none placeholder:text-faint focus:border-ink"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void onDescribe()}
                    disabled={desc.trim().length < 2}
                    className="tf-press flex-1 rounded-full bg-ink py-2.5 text-[13px] font-semibold text-bg disabled:opacity-40"
                  >
                    {t('textScanCta')}
                  </button>
                  <button type="button" onClick={reset} className="tf-press rounded-full border border-line px-4 py-2.5 text-[13px] font-semibold">
                    {t('photoNewPhoto')}
                  </button>
                </div>
              </div>
            )}

            {phase === 'product' && productFood && (
              <div>
                <div className="text-[17px] font-semibold">{productFood.name}</div>
                <div className="mb-4 text-[12px] text-faint">{productFood.brand ?? ''}</div>

                {clarify ? (
                  <p className="mb-3 rounded-lg bg-warm p-2.5 text-[12px] leading-relaxed text-muted">{clarify}</p>
                ) : null}

                {/* How much? Confirm/adjust the amount before logging (this is the "ask" for quantity). */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.25"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    aria-label={t('productAmount')}
                    className="w-20 rounded-lg border border-line bg-bg px-3 py-2 text-[15px] outline-none focus:border-ink"
                  />
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as ServingUnit)}
                    className="rounded-lg border border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-ink"
                  >
                    {SERVING_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {unitLabel(u, t)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={slot}
                    onChange={(e) => setSlot(e.target.value as MealSlot)}
                    className="ml-auto rounded-lg border border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-ink"
                  >
                    {MEAL_SLOTS.map((s) => (
                      <option key={s} value={s}>
                        {t(s)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4 rounded-xl border border-line p-3">
                  {(() => {
                    const g = gramsFromAmount(Number(qty), unit, productFood.densityGPerMl);
                    const m = macrosForGrams(productFood, g);
                    return (
                      <div className="text-[13px]">
                        <span className="text-[16px] font-semibold">{m.kcal} kcal</span>
                        <span className="text-muted"> · {m.proteinG}p / {m.carbG}c / {m.fatG}f</span>
                        <span className="text-faint"> · {g} g</span>
                      </div>
                    );
                  })()}
                </div>

                {productLogged ? (
                  <>
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold text-accent-ink">
                      <Icon name="check" size={16} />
                      {t('photoLogged')}
                    </div>
                    <CoachMomentCard moment={coachMoment} />
                  </>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void logProduct()}
                      disabled={productBusy || !(Number(qty) > 0)}
                      className="tf-press flex-1 rounded-full bg-ink py-2.5 text-[13px] font-semibold text-bg disabled:opacity-40"
                    >
                      {t('productLogCta')}
                    </button>
                    <button type="button" onClick={reset} className="tf-press rounded-full border border-line px-4 py-2.5 text-[13px] font-semibold">
                      {t('photoNewPhoto')}
                    </button>
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
