'use client';
// Exercise library browser: search + muscle/equipment filters, cards, four UI states.
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/states/skeleton';
import { ErrorState } from '@/components/states/error-state';
import { EmptyState } from '@/components/states/empty-state';

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

const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals', 'lats'];
const EQUIPMENT = ['body only', 'barbell', 'dumbbell', 'machine', 'cable', 'kettlebells', 'bands'];

export function ExerciseBrowser({ locale = 'en' }: { locale?: string }) {
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [items, setItems] = useState<Exercise[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'idle'>('loading');

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
  }, [q, muscle, equipment]);

  const control = 'rounded-none border border-black bg-white px-3 py-2 text-sm';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <input className={`${control} flex-1`} placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={control} value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          <option value="">All muscles</option>
          {MUSCLES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select className={control} value={equipment} onChange={(e) => setEquipment(e.target.value)}>
          <option value="">All equipment</option>
          {EQUIPMENT.map((eq) => (
            <option key={eq} value={eq}>
              {eq}
            </option>
          ))}
        </select>
      </div>

      {state === 'loading' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : state === 'error' ? (
        <ErrorState onRetry={() => setQ((s) => s)} />
      ) : items.length === 0 ? (
        <EmptyState title="No exercises" message="Try a different search or filter." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((ex) => (
            <li key={ex.id} className="border border-neutral-200 p-4">
              <p className="font-medium">{(locale === 'es' && ex.name_es) || ex.name_en}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                {[ex.muscle_group, ex.equipment, ex.difficulty].filter(Boolean).join(' · ')}
              </p>
              {ex.video_mux_id ? (
                <span className="mt-2 inline-block bg-[#5EBE62] px-2 py-0.5 text-xs text-black">Demo</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
