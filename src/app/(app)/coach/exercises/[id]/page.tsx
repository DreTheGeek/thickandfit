// Exercise detail + substitution-chain editor. RSC loads the exercise, its resolved chains for
// every context, the reason-tag vocabulary, and a candidate pool of exercises to pick from. The
// editing UI is delegated to a client island that calls the saveChain server action.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import {
  getExercise,
  getAllChains,
  getReasonTags,
  getExercisesPage,
  NO_EXERCISE_FILTERS,
} from '@/lib/coach/exercises';
import { Eyebrow } from '@/components/ui/section';
import { Icon } from '@/components/ui/icons';
import { SubstitutionEditor } from '@/components/coach/substitution-editor';
import { ExerciseFavoriteButton } from '@/components/coach/exercise-favorite-button';

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

  const exercise = await getExercise(ctx.companyId, id, locale, ctx.userId);
  if (!exercise) notFound();

  const [chains, reasonTags, candidatePage] = await Promise.all([
    getAllChains(ctx.companyId, id, locale),
    getReasonTags(locale),
    // Bias the picker toward same-muscle exercises; cap the pool for a snappy client search.
    // NO_EXERCISE_FILTERS on purpose: a substitution candidate pool must span the whole corpus, so
    // the list screen's default of "my exercises only" must not leak in here and hide the seed rows.
    getExercisesPage(
      ctx.companyId,
      { ...NO_EXERCISE_FILTERS, muscle: exercise.muscleGroup ? [exercise.muscleGroup] : [], pageSize: 300 },
      locale,
    ),
  ]);

  // Same-muscle candidates first, then everything else, excluding the exercise itself.
  const sameMuscle = candidatePage.rows.filter((r) => r.id !== id).map((r) => ({ id: r.id, name: r.name, muscleGroup: r.muscleGroup, equipment: r.equipment }));
  const allPool = await getExercisesPage(
    ctx.companyId,
    { ...NO_EXERCISE_FILTERS, muscle: [], pageSize: 800 },
    locale,
  );
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
          <div className="mt-1 flex items-center gap-2">
            <h1 className="tf-display text-[30px]">{exercise.name}</h1>
            <ExerciseFavoriteButton exerciseId={exercise.id} initial={exercise.isFavorite} size={20} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] capitalize text-muted">
            {[exercise.muscleGroup, exercise.equipment, exercise.difficulty].filter(Boolean).join(' · ')}
            {exercise.isCoachAuthored && (
              <span className="rounded-full bg-warm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-soft">
                {t('exercisesOwnedByMe')}
              </span>
            )}
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
