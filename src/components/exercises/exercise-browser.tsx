'use client';
// Exercise library browser: search + muscle/equipment filters, list rows, four UI states.
// Re-skinned to the design-handoff prototype (light monochrome list).
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Skeleton } from '@/components/states/skeleton';
import { ErrorState } from '@/components/states/error-state';
import { EmptyState } from '@/components/states/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Icon } from '@/components/ui/icons';

type Exercise = {
  id: string;
  name_en: string;
  name_es?: string | null;
  muscle_group?: string | null;
  equipment?: string | null;
  difficulty?: string | null;
  video_mux_id?: string | null;
  is_own_demo: boolean;
};

// The VALUE stays the English slug (the /api/exercises filter keys on it); only the visible LABEL is
// localized via app.library.muscles.* / equipmentTypes.* so a Spanish member sees Spanish options.
const MUSCLES = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals', 'lats',
];
const EQUIPMENT = [
  'body only', 'barbell', 'dumbbell', 'machine', 'cable', 'kettlebells', 'bands',
];
// slug -> i18n key ('body only' -> 'bodyOnly', 'e-z curl bar' -> 'eZCurlBar').
const labelKey = (slug: string): string =>
  slug
    .split(/[\s-]+/)
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');

// Title-case the raw slug as a last resort. The library carries 17 muscle groups, 13 equipment
// types and 3 difficulty levels, and the catalog will always trail the data by a row or two, so an
// unlabelled value must degrade to "Middle Back" rather than to a crash or a blank.
const humanize = (slug: string): string =>
  slug.replace(/[\s-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function ExerciseBrowser({
  locale = 'en',
  onlyFavorites = false,
}: {
  locale?: string;
  /** Narrow to her starred movements. Drives the Favorites tab on Train. */
  onlyFavorites?: boolean;
}): ReactElement {
  const t = useTranslations('app.library');
  // t() on a missing key renders the key path itself, which is how "library.muscles.neck" would end
  // up printed on a card. t.has() is the guard, humanize() is the readable fallback.
  const label = (slug: string | null | undefined, group: string): string => {
    if (!slug) return '';
    const key = `${group}.${labelKey(slug)}`;
    return t.has(key as never) ? t(key as never) : humanize(slug);
  };
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [items, setItems] = useState<Exercise[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'idle'>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setState('loading');
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (muscle) p.set('muscle', muscle);
    if (equipment) p.set('equipment', equipment);
    if (onlyFavorites) p.set('favorites', '1');
    fetch(`/api/exercises?${p.toString()}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        setItems(j?.data?.exercises ?? []);
        setState('idle');
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setState('error');
      });
    return () => ctrl.abort();
  }, [q, muscle, equipment, reloadKey, onlyFavorites]);

  const select =
    'border border-line bg-surface px-3 py-2.5 text-[13px] text-ink outline-none focus:border-ink';

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="flex items-center gap-2 border border-line px-3.5 py-3">
        <Icon name="search" size={18} className="text-faint" />
        <input
          className="w-full bg-transparent text-[14px] text-ink placeholder:text-faint outline-none"
          placeholder={t('searchPlaceholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <select
          className={`${select} flex-1`}
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
        >
          <option value="">{t('allMuscles')}</option>
          {MUSCLES.map((m) => (
            <option key={m} value={m}>
              {t(`muscles.${labelKey(m)}` as never)}
            </option>
          ))}
        </select>
        <select
          className={`${select} flex-1`}
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
        >
          <option value="">{t('allEquipment')}</option>
          {EQUIPMENT.map((eq) => (
            <option key={eq} value={eq}>
              {t(`equipmentTypes.${labelKey(eq)}` as never)}
            </option>
          ))}
        </select>
      </div>

      {state === 'loading' ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : state === 'error' ? (
        <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />
      ) : items.length === 0 ? (
        <EmptyState title={t('noResults')} message={t('noResultsBody')} />
      ) : (
        <div>
          {items.map((ex, i) => (
            <ListRow
              key={ex.id}
              divider={i < items.length - 1}
              leading={
                <div
                  className="h-[46px] w-[46px] flex-none rounded-[10px]"
                  style={{ background: 'linear-gradient(135deg,#3a3a3a,#111)' }}
                />
              }
              title={(locale === 'es' && ex.name_es) || ex.name_en}
              // The filter chips above have always been localized; this subtitle was not, so every
              // card on a Spanish member's screen read "abdominals · body only · beginner" in
              // English underneath a Spanish name. Same catalog, same key function, now applied
              // where she actually reads it.
              sub={[
                label(ex.muscle_group, 'muscles'),
                label(ex.equipment, 'equipmentTypes'),
                label(ex.difficulty, 'difficulty'),
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
