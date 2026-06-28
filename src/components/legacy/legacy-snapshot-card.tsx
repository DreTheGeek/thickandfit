// Read-only "Your journey so far" card (WP13). Renders the aggregate numbers a claimed legacy client
// brought over from Lenus. Server component: it is given the already-loaded snapshot. It deliberately
// shows aggregates only and a note that day-to-day tracking starts fresh (no fabricated timeline).
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import type { LegacySnapshot } from '@/lib/legacy/snapshot';

export async function LegacySnapshotCard({
  snapshot,
}: {
  snapshot: LegacySnapshot;
}): Promise<ReactElement> {
  const t = await getTranslations('app.legacy');

  const stats: { label: string; value: number }[] = [
    { label: t('mealPlans'), value: snapshot.mealPlans },
    { label: t('measurements'), value: snapshot.measurements },
    { label: t('checkins'), value: snapshot.checkins },
    { label: t('workouts'), value: snapshot.workouts },
  ];

  return (
    <section className="mb-6 rounded-xl bg-warm p-5">
      <h2 className="text-[15px] font-semibold text-ink">{t('cardTitle')}</h2>
      <p className="mt-0.5 text-[12px] text-muted">{t('cardSubtitle')}</p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[11px] font-semibold uppercase tracking-[1px] text-muted">
              {s.label}
            </dt>
            <dd className="text-[22px] font-bold leading-tight text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>

      {snapshot.weightGoal ? (
        <p className="mt-3 text-[12px] text-soft">
          <span className="font-semibold text-muted">{t('goal')}:</span> {snapshot.weightGoal}
        </p>
      ) : null}

      <p className="mt-4 text-[11px] leading-relaxed text-muted">{t('note')}</p>
    </section>
  );
}
