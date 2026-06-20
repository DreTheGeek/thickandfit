'use client';

import { useRef, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { MacroRing } from '@/components/coach/macro-ring';
import { PhotoScan } from '@/components/nutrition/photo-scan';
import { searchFoodsAction, getFoodDetailAction, logFoodAction, deleteFoodLogAction, lookupBarcodeAction } from '@/lib/nutrition/diary-actions';
import { MEAL_SLOTS, macrosForGrams, effectiveGrams, type DiaryDay, type FoodLite, type FoodPortion, type FoodState, type MealSlot } from '@/lib/nutrition/macros';

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }): ReactElement {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const over = target > 0 && value > target;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="font-semibold uppercase tracking-[0.5px] text-faint">{label}</span>
        <span className="tabular-nums text-soft">
          {Math.round(value)} / {Math.round(target)}g
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-warm">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: over ? 'var(--color-alert)' : color }} />
      </div>
    </div>
  );
}

export function DiaryScreen({ diary }: { diary: DiaryDay }): ReactElement {
  const t = useTranslations('app.nutrition');
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<FoodLite[]>([]);
  const [sel, setSel] = useState<FoodLite | null>(null);
  const [mode, setMode] = useState<'search' | 'barcode'>('search');
  const [barcode, setBarcode] = useState('');
  const [scanState, setScanState] = useState<'idle' | 'loading' | 'not_found'>('idle');
  const [grams, setGrams] = useState(100);
  const [slot, setSlot] = useState<MealSlot>('breakfast');
  const [busy, setBusy] = useState(false);
  const [portions, setPortions] = useState<FoodPortion[]>([]);
  const [cookedFactor, setCookedFactor] = useState<number | null>(null);
  const [foodState, setFoodState] = useState<FoodState | null>(null);
  const [weighed, setWeighed] = useState<FoodState>('cooked');
  const [portionId, setPortionId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onSearch(v: string): void {
    setQ(v);
    setSel(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setResults(await searchFoodsAction(v));
    }, 250);
  }
  const [selSource, setSelSource] = useState<'search' | 'barcode'>('search');
  async function selectFood(f: FoodLite, src: 'search' | 'barcode' = 'search'): Promise<void> {
    setSel(f);
    setSelSource(src);
    setGrams(100);
    setPortionId(null);
    setPortions([]);
    setCookedFactor(null);
    setFoodState(null);
    const d = await getFoodDetailAction(f.id);
    if (d) {
      setPortions(d.portions);
      setCookedFactor(d.cookedFactor);
      setFoodState(d.foodState);
      setWeighed(d.foodState ?? 'cooked');
      const def = d.portions.find((p) => p.isDefault);
      if (def) {
        setGrams(def.grams);
        setPortionId(def.id);
      }
    }
  }

  async function onBarcodeLookup(): Promise<void> {
    const code = barcode.trim();
    if (!code) return;
    setScanState('loading');
    const res = await lookupBarcodeAction(code);
    if (res.ok && res.food) {
      setScanState('idle');
      await selectFood(res.food, 'barcode');
    } else {
      setScanState('not_found');
    }
  }

  const showConvert = cookedFactor != null && foodState != null;
  const effGrams = showConvert && weighed !== foodState ? effectiveGrams(grams, weighed, foodState as FoodState, cookedFactor as number) : grams;

  async function add(): Promise<void> {
    if (!sel || effGrams <= 0) return;
    setBusy(true);
    const res = await logFoodAction({ foodId: sel.id, name: sel.name, mealSlot: slot, grams: effGrams, portionId, source: selSource });
    setBusy(false);
    if (res.ok) {
      setSel(null);
      setQ('');
      setResults([]);
      setBarcode('');
      setScanState('idle');
      setGrams(100);
      router.refresh();
    }
  }
  async function remove(id: string): Promise<void> {
    await deleteFoodLogAction(id);
    router.refresh();
  }

  const { totals, target, entries } = diary;
  const preview = sel ? macrosForGrams(sel, effGrams) : null;
  const kcalLeft = target ? Math.max(0, target.kcal - totals.kcal) : 0;
  const slotLabel = (s: MealSlot): string => t(s);

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6">
      <h1 className="tf-display mb-5 text-[26px]">{t('title')}</h1>

      {/* Daily summary */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <MacroRing proteinG={totals.proteinG} carbG={totals.carbG} fatG={totals.fatG} kcal={totals.kcal} size={92} />
            <div>
              <div className="font-display text-[24px] leading-none tabular-nums">{Math.round(totals.kcal)}</div>
              <div className="text-[12px] text-faint">
                {target ? t('ofTargetKcal', { target: Math.round(target.kcal) }) : t('kcalToday')}
              </div>
              {target && <div className="mt-1 text-[12px] font-semibold text-accent-ink">{t('kcalLeft', { n: kcalLeft })}</div>}
            </div>
          </div>
          {target && (
            <div className="flex flex-1 flex-col gap-2.5">
              <MacroBar label={t('protein')} value={totals.proteinG} target={target.proteinG} color="var(--color-macro-protein)" />
              <MacroBar label={t('carbs')} value={totals.carbG} target={target.carbG} color="var(--color-macro-carbs)" />
              <MacroBar label={t('fat')} value={totals.fatG} target={target.fatG} color="var(--color-macro-fat)" />
            </div>
          )}
        </div>
        {diary.targetSource === 'default' && <p className="mt-3 text-[11px] text-faint">{t('defaultTargetNote')}</p>}
      </div>

      {/* Photo-to-macro: the wedge. Snap a meal, confirm, log. */}
      <div className="mt-5">
        <PhotoScan />
      </div>

      {/* Add food */}
      <div className="mt-5 rounded-2xl border border-line bg-surface p-5">
        {/* Search / barcode mode toggle */}
        <div className="mb-3 flex w-fit overflow-hidden rounded-full border border-line">
          {(['search', 'barcode'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setSel(null);
                setScanState('idle');
              }}
              className={['tf-press flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-semibold', mode === m ? 'bg-ink text-bg' : 'text-muted'].join(' ')}
            >
              <Icon name={m === 'search' ? 'search' : 'barcode'} size={14} />
              {t(m === 'search' ? 'searchMode' : 'barcodeMode')}
            </button>
          ))}
        </div>

        {mode === 'search' ? (
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
              <Icon name="search" size={16} />
            </span>
            <input
              value={q}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-full border border-line bg-bg py-2.5 pl-10 pr-4 text-[14px] outline-none placeholder:text-faint focus:border-ink"
            />
          </div>
        ) : (
          <div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
                  <Icon name="barcode" size={16} />
                </span>
                <input
                  value={barcode}
                  onChange={(e) => {
                    setBarcode(e.target.value);
                    if (scanState === 'not_found') setScanState('idle');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void onBarcodeLookup();
                  }}
                  inputMode="numeric"
                  placeholder={t('barcodePlaceholder')}
                  className="w-full rounded-full border border-line bg-bg py-2.5 pl-10 pr-4 text-[14px] tabular-nums outline-none placeholder:text-faint focus:border-ink"
                />
              </div>
              <button
                type="button"
                disabled={scanState === 'loading' || !barcode.trim()}
                onClick={onBarcodeLookup}
                className="tf-press shrink-0 rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-bg disabled:opacity-50"
              >
                {scanState === 'loading' ? t('barcodeLooking') : t('barcodeLookup')}
              </button>
            </div>
            {scanState === 'not_found' && <p className="mt-2 text-[12px] text-alert-ink">{t('barcodeNotFound')}</p>}
          </div>
        )}

        {sel ? (
          <div className="mt-4 rounded-xl border border-line p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-semibold">{sel.name}</div>
              <button type="button" onClick={() => setSel(null)} className="tf-press text-faint hover:text-ink">
                <Icon name="x" size={16} />
              </button>
            </div>

            {/* Portion picker (household measures -> grams) */}
            {portions.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {portions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setGrams(p.grams);
                      setPortionId(p.id);
                    }}
                    className={['tf-press rounded-full border px-3 py-1 text-[12px] font-medium', portionId === p.id ? 'border-ink bg-ink text-bg' : 'border-line text-muted'].join(' ')}
                  >
                    {p.label} · {p.grams}g
                  </button>
                ))}
              </div>
            )}

            {/* Cooked / uncooked conversion — the differentiator no competitor ships */}
            {showConvert && (
              <div className="mb-3 rounded-lg bg-warm/60 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-faint">{t('weighedAs')}</span>
                  <div className="flex overflow-hidden rounded-full border border-line">
                    {(['cooked', 'raw'] as FoodState[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setWeighed(s)}
                        className={['tf-press px-3 py-1 text-[12px] font-semibold', weighed === s ? 'bg-ink text-bg' : 'text-muted'].join(' ')}
                      >
                        {t(s)}
                      </button>
                    ))}
                  </div>
                </div>
                {weighed !== foodState && (
                  <div className="mt-1.5 text-[12px] text-accent-ink">
                    {t('loggingEquiv', { grams: effGrams, state: t(foodState as FoodState) })}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.5px] text-faint">
                {t('grams')}
                <input
                  type="number"
                  min={1}
                  value={grams}
                  onChange={(e) => {
                    setGrams(Math.max(0, Number(e.target.value)));
                    setPortionId(null);
                  }}
                  className="w-24 rounded-lg border border-line bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.5px] text-faint">
                {t('meal')}
                <select
                  value={slot}
                  onChange={(e) => setSlot(e.target.value as MealSlot)}
                  className="rounded-lg border border-line bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-ink"
                >
                  {MEAL_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {slotLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={busy || effGrams <= 0}
                onClick={add}
                className="tf-press ml-auto rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-bg disabled:opacity-50"
              >
                {t('add')}
              </button>
            </div>
            {preview && (
              <div className="mt-3 text-[12px] text-muted">
                {preview.kcal} kcal · {preview.proteinG}p / {preview.carbG}c / {preview.fatG}f
              </div>
            )}
          </div>
        ) : (
          results.length > 0 && (
            <div className="mt-3 flex max-h-72 flex-col overflow-y-auto">
              {results.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => selectFood(f)}
                  className="tf-press flex items-center justify-between gap-3 border-b border-divider py-2.5 text-left last:border-0 hover:bg-warm/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">{f.name}</span>
                    {f.category && <span className="text-[11px] capitalize text-faint">{f.category}</span>}
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-faint">{Math.round(f.kcal)} kcal/100g</span>
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {/* Meals */}
      <div className="mt-5 flex flex-col gap-4">
        {MEAL_SLOTS.map((s) => {
          const rows = entries.filter((e) => e.mealSlot === s);
          if (rows.length === 0) return null;
          const slotKcal = rows.reduce((a, r) => a + r.kcal, 0);
          return (
            <div key={s} className="rounded-2xl border border-line bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[12px] font-semibold uppercase tracking-[1px] text-faint">{slotLabel(s)}</div>
                <div className="text-[12px] tabular-nums text-faint">{Math.round(slotKcal)} kcal</div>
              </div>
              {rows.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 border-b border-divider py-2.5 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium">{e.name}</div>
                    <div className="text-[12px] text-faint">
                      {e.grams != null ? `${Math.round(e.grams)}g · ` : ''}
                      {e.kcal} kcal · {e.proteinG}p / {e.carbG}c / {e.fatG}f
                    </div>
                  </div>
                  <button type="button" onClick={() => remove(e.id)} className="tf-press shrink-0 text-faint hover:text-alert-ink">
                    <Icon name="x" size={16} />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
        {entries.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line py-12 text-center text-sm text-faint">{t('noEntriesYet')}</p>
        )}
      </div>
    </div>
  );
}
