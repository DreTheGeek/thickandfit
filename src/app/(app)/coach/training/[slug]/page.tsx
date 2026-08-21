// One how-to article. Ends on the screen it teaches, so reading it and doing it are one motion.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCoach } from '@/lib/auth/guards';
import { Icon } from '@/components/ui/icons';
import { trainingBySlug } from '@/lib/coach/training-articles';

export const dynamic = 'force-dynamic';

export default async function TrainingArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<ReactElement> {
  await requireCoach();
  const { slug } = await params;
  const a = trainingBySlug(slug);
  if (!a) notFound();

  return (
    <div className="max-w-[68ch]">
      <Link href="/coach/training" className="tf-press mb-4 inline-flex items-center gap-2 text-[13px] text-muted">
        <Icon name="arrowLeft" size={16} /> All how-tos
      </Link>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-warm px-2.5 py-1 text-[11px] font-semibold text-muted">{a.category}</span>
        <span className="flex items-center gap-1 text-[11px] tabular-nums text-faint">
          <Icon name="clock" size={12} />
          {a.minutes} min
        </span>
      </div>

      <h1 className="font-display text-2xl uppercase tracking-tight sm:text-3xl">{a.title}</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-soft">{a.intro}</p>

      <ol className="mt-6 flex flex-col gap-5">
        {a.steps.map((s, i) => (
          <li key={i} className="flex gap-3.5">
            <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-warm text-[12px] font-bold text-muted">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-ink">{s.title}</div>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* WORTH KNOWING, before she hits it rather than after. Every entry here is something that
          actually caught somebody; a gotcha invented to fill the section trains people to skip it. */}
      {a.gotchas && a.gotchas.length > 0 && (
        <div className="mt-7 rounded-2xl border border-line bg-warm/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-ink">
            <Icon name="alert" size={15} />
            Worth knowing
          </div>
          <ul className="flex flex-col gap-2">
            {a.gotchas.map((g, i) => (
              <li key={i} className="text-[13px] leading-relaxed text-soft">
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}

      {a.route && (
        <Link
          href={a.route}
          className="tf-press mt-7 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-bg"
        >
          Open it
          <Icon name="chevronRight" size={15} />
        </Link>
      )}
    </div>
  );
}
