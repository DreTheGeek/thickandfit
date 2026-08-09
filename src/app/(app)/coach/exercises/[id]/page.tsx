// Exercise detail + substitution-chain editor. RSC loads the exercise, its resolved chains for
// every context, the reason-tag vocabulary, and a candidate pool of exercises to pick from. The
// editing UI is delegated to a client island that calls the saveChain server action.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { getExercise, getAllChains, getReasonTags, getExercisesPage } from '@/lib/coach/exercises';
import { Eyebrow } from '@/components/ui/section';
import { Icon } from '@/components/ui/icons';
import { SubstitutionEditor } from '@/components/coach/substitution-editor';

export const dynamic = 'force-dynamic';

export default async function CoachExerciseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params;
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  const locale = await getLocale();

  if (!ctx.companyId) notFound();

  const exercise = await getExercise(ctx.companyId, id, locale);
  if (!exercise) notFound();

  const [chains, reasonTags, candidatePage] = await Promise.all([
    getAllChains(ctx.companyId, id, locale),
    getReasonTags(locale),
    // Bias the picker toward same-muscle exercises; cap the pool for a snappy client search.
    getExercisesPage(ctx.companyId, { q: '', muscle: exercise.muscleGroup ? [exercise.muscleGroup] : [], equipment: [], page: 1, pageSize: 300 }, locale),
  ]);

  // Same-muscle candidates first, then everything else, excluding the exercise itself.
  const sameMuscle = candidatePage.rows.filter((r) => r.id !== id).map((r) => ({ id: r.id, name: r.name, muscleGroup: r.muscleGroup, equipment: r.equipment }));
  const allPool = await getExercisesPage(ctx.companyId, { q: '', muscle: [], equipment: [], page: 1, pageSize: 800 }, locale);
  const seen = new Set(sameMuscle.map((c) => c.id));
  seen.add(id);
  const candidates = [
    ...sameMuscle,
    ...allPool.rows.filter((r) => !seen.has(r.id)).map((r) => ({ id: r.id, name: r.name, muscleGroup: r.muscleGroup, equipment: r.equipment })),
  ];

  return (
    <div>
      <Link
        href="/coach/exercises"
        className="tf-press mb-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-ink"
      >
        <Icon name="arrowLeft" size={14} /> {t('exercisesBack')}
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>{t('substitutionChains')}</Eyebrow>
          <h1 className="tf-display mt-1 text-[30px]">{exercise.name}</h1>
          <p className="mt-1 text-[13px] capitalize text-muted">
            {[exercise.muscleGroup, exercise.equipment, exercise.difficulty].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <SubstitutionEditor
        exerciseId={exercise.id}
        chains={chains}
        reasonTags={reasonTags}
        candidates={candidates}
      />
    </div>
  );
}
