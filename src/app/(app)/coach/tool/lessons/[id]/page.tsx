// One lesson: the video plays, the guides download, and it says who already has it.
//
// Her lesson bodies arrive as authored HTML from Lenus. They are rendered rather than escaped,
// because escaping turns her paragraphs into visible <p> tags, and stripping the markup runs the
// nine meal-plan explanations together into a wall. The content is her own, written by her, stored
// by us, and never member-submitted, so the injection surface here is her own account.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCoach } from '@/lib/auth/guards';
import { getLesson } from '@/lib/lessons/lessons';
import { COACH_COPY } from '@/lib/lessons/copy';
import { formatBytes, formatDuration } from '@/lib/lessons/types';
import { Eyebrow, PageTitle } from '@/components/ui/section';
import { Icon } from '@/components/ui/icons';
import { LessonVideo } from '@/components/coach/lesson-video';

export const dynamic = 'force-dynamic';

export default async function CoachLessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  const { id } = await params;
  if (!ctx.companyId) notFound();

  const lesson = await getLesson(ctx.companyId, id);
  if (!lesson) notFound();

  const videos = lesson.assets.filter((a) => a.kind === 'video');
  const docs = lesson.assets.filter((a) => a.kind === 'document');

  const sent =
    lesson.sentCount === 0
      ? COACH_COPY.neverSent
      : lesson.sentCount === 1
        ? COACH_COPY.sentToOne
        : COACH_COPY.sentToMany.replace('{n}', String(lesson.sentCount));

  return (
    <div>
      <Link href="/coach/tool/lessons" className="mb-3 inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink">
        <Icon name="chevronLeft" size={14} />
        {COACH_COPY.back}
      </Link>

      <Eyebrow>{lesson.category ?? COACH_COPY.uncategorised}</Eyebrow>
      <PageTitle className="mb-1 mt-1">{lesson.title}</PageTitle>
      <p className="mb-5 text-[13px] text-muted">
        {sent}
        {lesson.planNames.length > 0 && (
          <>
            {' · '}
            {COACH_COPY.inSequence} {lesson.planNames.join(', ')}
          </>
        )}
        {' · '}
        {lesson.isPublished ? COACH_COPY.live : COACH_COPY.notLive}
      </p>

      <div className="flex flex-col gap-6">
        {videos.map((v) => (
          <LessonVideo key={v.id} url={v.url} title={lesson.title} />
        ))}

        {lesson.bodyHtml && (
          <div
            className="tf-measure text-[14px] leading-relaxed text-ink [&_a]:underline [&_p]:mb-3"
            dangerouslySetInnerHTML={{ __html: lesson.bodyHtml }}
          />
        )}

        {docs.length > 0 && (
          <div className="flex flex-col gap-2">
            {docs.map((d) => {
              const meta = [formatBytes(d.bytes), formatDuration(d.durationSeconds)].filter(Boolean).join(' · ');
              return d.url ? (
                <a
                  key={d.id}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tf-press flex items-center justify-between gap-4 rounded-2xl bg-surface px-4 py-3.5 hover:shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                >
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium text-ink">{COACH_COPY.download}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted">
                      {d.fileName}
                      {meta ? ` · ${meta}` : ''}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={16} className="shrink-0 text-line" />
                </a>
              ) : (
                <div key={d.id} className="rounded-2xl bg-warm px-4 py-3.5 text-[13px] text-muted">
                  {COACH_COPY.assetMissing}
                </div>
              );
            })}
          </div>
        )}

        {lesson.assets.length === 0 && (
          <p className="text-[13px] text-muted">{COACH_COPY.noAssets}</p>
        )}

        <p className="tf-measure text-[12px] text-faint">
          {lesson.esStatus === 'approved'
            ? COACH_COPY.esApproved
            : lesson.esStatus === 'draft'
              ? `${COACH_COPY.esDraft}. ${COACH_COPY.esNote}`
              : `${COACH_COPY.esMissing}. ${COACH_COPY.esNote}`}
        </p>
      </div>
    </div>
  );
}
