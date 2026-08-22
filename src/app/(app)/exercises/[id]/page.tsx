// One movement, for the member: her filmed demo and her written cues.
//
// THE GAP THIS CLOSES. Train > Library let a member search and filter 1,305 movements and then do
// nothing with any of them. The rows were a `ListRow` with no `href` and no `onClick`, and there was
// no member-facing exercise route to point at even if they had one: the only detail page in the app
// was `/coach/exercises/[id]`, behind requireCoach.
//
// So a member could find "Bent-Arm Barbell Pullover", read three words of metadata, and have no way
// to learn how to do it. Her filmed demos are the reason this is her app rather than a spreadsheet,
// and they reached the workout player and the coach console but never the library a member browses.
// The owner found it the obvious way: "I tried to open a workout that wasn't in the program and I
// can't."
//
// Deliberately NOT the coach page. That one carries the substitution-chain editor, the favourite
// star and the seed/authored provenance, which are her tools for maintaining the library. A member
// wants the video and the cues.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireEntitledOrPaused } from '@/lib/auth/guards';
import { getExercise } from '@/lib/coach/exercises';
import { getExerciseDemoUrl } from '@/lib/exercises/demo-url';
import { slugLabel, type SlugTranslator } from '@/lib/exercises/labels';
import { PortalScreen, PortalHeader } from '@/components/portal/portal-chrome';
import { MemberExerciseDemo } from '@/components/exercises/member-exercise-demo';
import { Icon } from '@/components/ui/icons';

export const dynamic = 'force-dynamic';

export default async function MemberExerciseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params;
  // Paused members keep their records and their library; it is the paid SESSION that closes. Same
  // call /workouts makes, so a member on a break can still look a movement up.
  const ctx = await requireEntitledOrPaused();
  const t = await getTranslations('app.activities');
  // The slug vocabularies (muscles / equipmentTypes / difficulty) live under app.library, which is
  // the same namespace the browser row uses. Reading them from anywhere else prints the key path.
  const tl = await getTranslations('app.library');
  const locale = await getLocale();

  if (!ctx.companyId) notFound();

  const exercise = await getExercise(ctx.companyId, id, locale);
  if (!exercise) notFound();

  const demoUrl = exercise.hasDemo ? await getExerciseDemoUrl(ctx.companyId, id) : null;

  const st = tl as unknown as SlugTranslator;
  const meta = [
    slugLabel(st, exercise.muscleGroup, 'muscles'),
    slugLabel(st, exercise.equipment, 'equipmentTypes'),
    slugLabel(st, exercise.difficulty, 'difficulty'),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <PortalScreen>
      <Link
        href="/workouts?tab=library"
        className="tf-press mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink"
      >
        <Icon name="arrowLeft" size={15} />
        {t('library')}
      </Link>

      <PortalHeader title={exercise.name} sub={meta || null} />

      {/* The demo first. It is the answer to "how do I do this", and on a phone it should be the
          thing under her thumb rather than something she scrolls past the metadata to reach. */}
      <div className="mt-4">
        <MemberExerciseDemo url={demoUrl} name={exercise.name} hasDemo={exercise.hasDemo} />
      </div>

      {exercise.cues && (
        <div className="mt-5">
          <div className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">
            {t('exerciseCues')}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-soft">
            {exercise.cues}
          </p>
        </div>
      )}
    </PortalScreen>
  );
}
