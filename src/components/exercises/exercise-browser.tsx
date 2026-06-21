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

const MUSCLES = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals', 'lats',
];
const EQUIPMENT = [
  'body only', 'barbell', 'dumbbell', 'machine', 'cable', 'kettlebells', 'bands',
];

export function ExerciseBrowser({ locale = 'en' }: { locale?: string }): ReactElement {
  const t = useTranslations('app.library');
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
  }, [q, muscle, equipment, reloadKey]);

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
            <option key={m} value={m} className="capitalize">
              {m}
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
              {eq}
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
              sub={[ex.muscle_group, ex.equipment, ex.difficulty]
                .filter(Boolean)
                .join(' · ')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
