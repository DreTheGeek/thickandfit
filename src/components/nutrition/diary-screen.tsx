'use client';

import { useRef, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { PortalCard, PortalLabel } from '@/components/portal/today-cards';
import {
  PortalScreen,
  PortalHeader,
  PortalIconButton,
  PortalTabs,
  PortalButton,
  PortalMeter,
  PortalStatRow,
} from '@/components/portal/portal-chrome';
import { PhotoScan } from '@/components/nutrition/photo-scan';
import { CoachMomentCard } from '@/components/nutrition/coach-moment-card';
import type { CoachMoment } from '@/lib/nutrition/coach-moment';
import { searchFoodsAction, getFoodDetailAction, logFoodAction, deleteFoodLogAction, lookupBarcodeAction, toggleFavoriteAction } from '@/lib/nutrition/diary-actions';
import { MEAL_SLOTS, macrosForGrams, effectiveGrams, dayScore, type DiaryDay, type FoodLite, type FoodPortion, type FoodState, type MealSlot } from '@/lib/nutrition/macros';

export function DiaryScreen({
  diary,
  recents,
  favorites,
  favoriteIds,
  date,
  prevDate,
  nextDate,
  isToday,
}: {
  diary: DiaryDay;
  recents: FoodLite[];
  favorites: FoodLite[];
  favoriteIds: string[];
  date: string;
  prevDate: string;
  nextDate: string | null;
  isToday: boolean;
}): ReactElement {
  const t = useTranslations('app.nutrition');
  const tn = useTranslations('app.nav');
  const locale = useLocale();
  const router = useRouter();
  const [favSet, setFavSet] = useState<Set<string>>(() => new Set(favoriteIds));

  async function toggleFavorite(id: string): Promise<void> {
    const currently = favSet.has(id);
    setFavSet((prev) => {
      const n = new Set(prev);
      if (currently) n.delete(id);
      else n.add(id);
      return n;
    });
    const res = await toggleFavoriteAction(id);
    if (!res.ok) {
      setFavSet((prev) => {
        const n = new Set(prev);
        if (currently) n.add(id);
        else n.delete(id);
        return n;
      });
    }
  }
  const dateLabel = isToday
    ? t('today')
    : (() => {
        const [y, m, d] = date.split('-').map(Number);
        return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(
          new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1),
        );
      })();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<FoodLite[]>([]);
  const [sel, setSel] = useState<FoodLite | null>(null);
  /**
   * The one way in she has chosen, out of the five this app actually offers.
   *
   * It replaces a search/barcode pill that lived INSIDE the find card, with the scanner, the
   * favourites and the recents as three more blocks stacked around it. Every one of these already
   * shipped; four of the five were just not presented as a choice, so a member scanning a packaged
   * food had to back out of the scanner and hunt for the barcode field.
   */
  const [addMode, setAddMode] = useState<'scan' | 'describe' | 'search' | 'barcode' | 'favorites'>('scan');
  const [barcode, setBarcode] = useState('');
  const [scanState, setScanState] = useState<'idle' | 'loading' | 'not_found'>('idle');
  const [grams, setGrams] = useState(100);
  const [slot, setSlot] = useState<MealSlot>('breakfast');
  // The add-food block is closed by default. It used to be four always-open entry points stacked
  // above the day's meals, which pushed what she had eaten below the fold on the screen whose job
  // is to show it.
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  // Post-log coaching line, returned by the log action itself.
  const [coachMoment, setCoachMoment] = useState<CoachMoment | null>(null);
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
    const res = await logFoodAction({ foodId: sel.id, name: sel.name, mealSlot: slot, grams: effGrams, portionId, source: selSource, logDate: isToday ? undefined : date });
    setBusy(false);
    if (res.ok) {
      setSel(null);
      setQ('');
      setResults([]);
      setBarcode('');
      setScanState('idle');
      setGrams(100);
      // Search and barcode logs earn the same coaching line as a photo scan. The moment is about
      // where her day stands, not about how the food got entered.
      setCoachMoment(res.coachMoment ?? null);
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
  const score = target ? dayScore(totals, target) : null;
  const slotLabel = (s: MealSlot): string => t(s);

  return (
    <PortalScreen>
      {/* The nav label, not t('title'): the tab at the bottom of this screen says Fuel and the
          header said Nutrition, which is two names for one place. The handoff's header is FUEL.
          Train made the same change for the same reason. */}
      <PortalHeader
        title={tn('nutrition')}
        sub={dateLabel}
        right={
          <>
            <PortalIconButton
              icon="chevronRight"
              href={`/nutrition?date=${prevDate}`}
              label={t('prevDay')}
              flip
            />
            {/* Always a PAIR, even on today where there is no tomorrow to go to. A lone back-chevron
                sitting on the right edge reads as "close" rather than as "the day before". */}
            {nextDate ? (
              <PortalIconButton icon="chevronRight" href={`/nutrition?date=${nextDate}`} label={t('nextDay')} />
            ) : (
              <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full text-line">
                <Icon name="chevronRight" size={16} />
              </span>
            )}
          </>
        }
      />

      {/* The contract's wording, on three routes rather than three local views.
          Meals is her meal plan and Nutrition is the food photo record, which are the two things
          this app actually has behind those names. Both existed and were reachable only from the
          You menu, two taps from the place she is thinking about food. */}
      <PortalTabs
        value={'today' as const}
        options={[
          { value: 'today' as const, label: t('tabToday') },
          { value: 'plan' as const, label: t('tabMeals') },
          { value: 'photos' as const, label: t('tabNutrition') },
        ]}
        variant="grid"
        hrefFor={(v) => (v === 'plan' ? '/nutrition/plan' : v === 'photos' ? '/nutrition/photos' : '/nutrition')}
      />

      {!isToday && (
        <Link
          href="/nutrition"
          className="tf-press mb-2.5 inline-block rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-muted hover:text-ink"
        >
          {t('today')}
        </Link>
      )}

      {/* The handoff's `.calorie-line`: one figure against its target, a rail, and the three macros.
          It replaces the ring-plus-three-bars block. Same numbers, and the ring is not deleted from
          the codebase (the coach console still uses it), it just stops being this screen's hero:
          the handoff leads with the number she came to check, not with a chart of it. */}
      <div className="border-y border-line py-3.5">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <PortalLabel>{t('calories')}</PortalLabel>
            <div className="mt-0.5">
              <strong className="text-[26px] tabular-nums leading-none">{Math.round(totals.kcal)}</strong>
              {target ? (
                <span className="ml-1.5 text-[12px] text-muted">/ {Math.round(target.kcal)}</span>
              ) : null}
            </div>
          </div>
          {target ? <span className="flex-none text-[12px] text-muted">{t('kcalLeft', { n: kcalLeft })}</span> : null}
        </div>

        {target ? <PortalMeter className="mt-2.5" pct={(totals.kcal / Math.max(1, target.kcal)) * 100} /> : null}

        {target ? (
          <PortalStatRow
            className="mt-[17px]"
            order="label-first"
            divider
            stats={[
              { key: 'p', label: t('protein'), value: `${Math.round(totals.proteinG)} / ${Math.round(target.proteinG)}g` },
              { key: 'c', label: t('carbs'), value: `${Math.round(totals.carbG)} / ${Math.round(target.carbG)}g` },
              { key: 'f', label: t('fat'), value: `${Math.round(totals.fatG)} / ${Math.round(target.fatG)}g` },
            ]}
          />
        ) : null}
      </div>

      {score != null && (
        <div
          className={[
            'mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
            score >= 7 ? 'bg-accent/12 text-accent' : 'bg-warm text-muted',
          ].join(' ')}
        >
          {/* Was a sparkle. The day score is arithmetic over her own logged macros against her own
              targets, so dressing it as machine-magic both misdescribes it and breaks the brand
              rule. A check reads as "you hit it", which is what it means. */}
          <Icon name="check" size={12} />
          {t('dayScore', { n: score })}
        </div>
      )}

      {diary.targetSource === 'default' && <p className="mt-2 text-[11px] text-faint">{t('defaultTargetNote')}</p>}
      {diary.targetSource === 'onboarding' && (
        <p className="mt-2 text-[11px] text-faint">{t('onboardingTargetNote')}</p>
      )}
      <CoachMomentCard moment={coachMoment} />

      {/* Everything that ADDS food now lives behind the button under the meal list, where the
          handoff puts it. It was a permanently-open scanner, favourites, recents and a search box
          stacked above the day's meals, so the screen opened on four ways to enter food and pushed
          what she had actually eaten below the fold. CaptureFab still offers the scanner globally. */}
      {adding && (
        <div className="mt-5 rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <PortalLabel>{t('addMeal')}</PortalLabel>
            <button
              type="button"
              onClick={() => setAdding(false)}
              aria-label={t('close')}
              className="tf-press text-faint hover:text-ink"
            >
              <Icon name="x" size={16} />
            </button>
          </div>

          {/* Five ways in, all of which already shipped. Scrolls rather than squeezes: five Spanish
              labels at 12px do not fit 390px minus the gutter. */}
          <PortalTabs
            value={addMode}
            onChange={(v) => {
              setAddMode(v);
              setSel(null);
              setScanState('idle');
            }}
            options={[
              { value: 'scan' as const, label: t('modeScan') },
              { value: 'describe' as const, label: t('modeDescribe') },
              { value: 'search' as const, label: t('modeSearch') },
              { value: 'barcode' as const, label: t('modeBarcode') },
              { value: 'favorites' as const, label: t('modeFavorites') },
            ]}
          />

          {(addMode === 'scan' || addMode === 'describe') && (
            <PhotoScan logDate={isToday ? undefined : date} entry={addMode === 'scan' ? 'photo' : 'text'} />
          )}

      {/* Favorites: starred foods, one tap. */}
      {addMode === 'favorites' && favorites.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[1px] text-faint">
            {t('favorites')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {favorites.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => void selectFood(f)}
                className="tf-press rounded-full border border-accent/40 px-3 py-1.5 text-[12px] font-medium text-muted hover:border-ink hover:text-ink"
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recently logged: one tap to re-log a food you eat often. */}
      {addMode === 'favorites' && recents.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[1px] text-faint">
            {t('recentFoods')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recents.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => void selectFood(f)}
                className="tf-press rounded-full border border-line px-3 py-1.5 text-[12px] font-medium text-muted hover:border-ink hover:text-ink"
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Find: search or barcode. Rendered for both, because the selected-food editor below (portion,
          meal slot, Add) is shared by search, barcode AND a favourite, and hiding it per mode would
          strand a food she had already picked. */}
      <div className={(addMode === 'search' || addMode === 'barcode' || sel) ? 'mt-4' : 'hidden'}>
        {addMode === 'search' && (
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
              <Icon name="search" size={16} />
            </span>
            <input
              value={q}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className="w-full rounded-full border border-line bg-bg py-2.5 pl-10 pr-4 text-[14px] outline-none placeholder:text-faint focus:border-ink"
            />
          </div>
        )}
        {addMode === 'barcode' && (
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
                  aria-label={t('barcodePlaceholder')}
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
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0 truncate font-semibold">{sel.name}</div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void toggleFavorite(sel.id)}
                  aria-label={t('favorite')}
                  className="tf-press text-[18px] leading-none"
                >
                  <span className={favSet.has(sel.id) ? 'text-accent' : 'text-line'}>
                    {favSet.has(sel.id) ? '★' : '☆'}
                  </span>
                </button>
                <button type="button" onClick={() => setSel(null)} className="tf-press text-faint hover:text-ink">
                  <Icon name="x" size={16} />
                </button>
              </div>
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

            {/* Cooked / uncooked conversion: the differentiator no competitor ships */}
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
        </div>
      )}

      {/* Meals */}
      <div className="mt-5 flex flex-col gap-4">
        <PortalLabel>{t('mealsLabel')}</PortalLabel>
        {MEAL_SLOTS.map((s) => {
          const rows = entries.filter((e) => e.mealSlot === s);
          if (rows.length === 0) return null;
          const slotKcal = rows.reduce((a, r) => a + r.kcal, 0);
          return (
            // One card per slot with its entries inside, NOT the handoff's single summary row per
            // meal. The handoff draws "Breakfast / Greek Yogurt Bowl / 420 cal" as one line, which
            // reads beautifully and has nowhere to delete an individual food from. Her diary holds
            // several foods per slot and she has to be able to remove the one she got wrong, so the
            // card keeps its rows and takes the 8.0 treatment around them.
            <PortalCard key={s} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[12px] font-semibold uppercase tracking-[1px] text-faint">{slotLabel(s)}</div>
                <div className="text-[12px] tabular-nums text-faint">{Math.round(slotKcal)} kcal</div>
              </div>
              {rows.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 border-b border-divider py-2.5 last:border-0">
                  {/* Her own photo where the row came from a scan, a neutral tile otherwise. Most
                      rows have no image and always will: search, barcode and text logs never had
                      one, and neither did the 8,419 Lenus rows. A broken-image icon on the majority
                      of a diary would be worse than the spreadsheet this replaces. */}
                  {e.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed URL, expires hourly
                    <img
                      src={e.thumbUrl}
                      alt=""
                      loading="lazy"
                      className="h-10 w-10 flex-none rounded-[10px] object-cover"
                    />
                  ) : (
                    <span className="grid h-10 w-10 flex-none place-items-center rounded-[10px] bg-warm text-faint">
                      <Icon name="nutrition" size={15} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
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
            </PortalCard>
          );
        })}
        {entries.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line py-12 text-center text-sm text-faint">{t('noEntriesYet')}</p>
        )}
      </div>

      {!adding && (
        <PortalButton variant="outline" onClick={() => setAdding(true)} className="mt-4">
          {`+ ${t('addMeal')}`}
        </PortalButton>
      )}
    </PortalScreen>
  );
}
