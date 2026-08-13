// Lesson library index: her teaching, grouped the way she categorised it.
//
// Grouped rather than a flat grid because 24 tiles of "1600 calories meal plan (pescatarian)" read
// as noise; her own categories (Nutrition, Workout tips, App tour) are the structure she already
// built, and the nine meal-plan variants belong together. Uncategorised goes last rather than
// first: seven lessons have a blank category on Lenus, and that is a gap, not a heading.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { requireCoach } from '@/lib/auth/guards';
import { listLessons, listLessonPlans } from '@/lib/lessons/lessons';
import { COACH_COPY } from '@/lib/lessons/copy';
import type { LessonSummary } from '@/lib/lessons/types';
import { Eyebrow, PageTitle } from '@/components/ui/section';
import { Icon } from '@/components/ui/icons';

export const dynamic = 'force-dynamic';

function sentLabel(n: number): string {
  if (n === 0) return COACH_COPY.neverSent;
  if (n === 1) return COACH_COPY.sentToOne;
  return COACH_COPY.sentToMany.replace('{n}', String(n));
}

function assetLabel(l: LessonSummary): string {
  const parts: string[] = [];
  if (l.videoCount) parts.push(`${l.videoCount} ${l.videoCount === 1 ? COACH_COPY.video : COACH_COPY.videos}`);
  if (l.documentCount) {
    parts.push(`${l.documentCount} ${l.documentCount === 1 ? COACH_COPY.document : COACH_COPY.documents}`);
  }
  return parts.join(' · ');
}

export default async function CoachLessonsPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return <div className="p-8 text-sm text-muted">{COACH_COPY.empty}</div>;

  const [lessons, plans] = await Promise.all([listLessons(ctx.companyId), listLessonPlans(ctx.companyId)]);

  const groups = new Map<string, LessonSummary[]>();
  for (const l of lessons) {
    const key = l.category ?? COACH_COPY.uncategorised;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }
  const ordered = [...groups.entries()].sort((a, b) => {
    if (a[0] === COACH_COPY.uncategorised) return 1;
    if (b[0] === COACH_COPY.uncategorised) return -1;
    return b[1].length - a[1].length;
  });

  return (
    <div>
      <Eyebrow>{COACH_COPY.eyebrow}</Eyebrow>
      <PageTitle className="mb-1 mt-1">{COACH_COPY.title}</PageTitle>
      <p className="tf-measure mb-5 text-[13px] leading-relaxed text-muted">{COACH_COPY.subtitle}</p>

      {lessons.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-[14px] text-ink">{COACH_COPY.empty}</p>
          <p className="mt-1 text-[13px] text-faint">{COACH_COPY.emptyDetail}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Said once, at the top, rather than repeated as a badge on all 24 cards. */}
          <p className="tf-measure text-[12px] text-faint">{COACH_COPY.notLiveNote}</p>

          {ordered.map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
                {category} <span className="text-line">·</span> {items.length}
              </h2>
              <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                {items.map((l) => (
                  <Link
                    key={l.id}
                    href={`/coach/tool/lessons/${l.id}`}
                    className="tf-press flex items-center justify-between gap-4 rounded-2xl bg-surface px-4 py-3.5 hover:shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  >
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium leading-snug text-ink">{l.title}</span>
                      <span className="mt-0.5 block text-[12px] text-muted">
                        {assetLabel(l)}
                        {assetLabel(l) ? ' · ' : ''}
                        {sentLabel(l.sentCount)}
                      </span>
                    </span>
                    <Icon name="chevronRight" size={16} className="shrink-0 text-line" />
                  </Link>
                ))}
              </div>
            </section>
          ))}

          {plans.length > 0 && (
            <section>
              <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
                {COACH_COPY.sequencesTitle}
              </h2>
              <p className="tf-measure mb-2.5 text-[12px] text-muted">{COACH_COPY.sequencesNote}</p>
              <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                {plans.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-4 rounded-2xl bg-surface px-4 py-3.5">
                    <span className="text-[14px] font-medium text-ink">{p.name}</span>
                    <span className="shrink-0 text-[12px] text-muted">{p.lessonCount}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
