'use client';
// The intake review queue.
//
// LAYOUT RULE: her words come FIRST and in full, the extraction sits underneath as chips. The model
// is an index over what she wrote, not a replacement for it, and a coach who reads only a paraphrase
// of "I had a c-section in March" is a coach who never actually read it. Nothing here is truncated
// behind a "show more".
import { useState, useTransition, type ReactElement } from 'react';
import { markIntakeReviewedAction } from '@/lib/coach/intake-review-actions';

export type ReviewItem = {
  profileId: string;
  name: string;
  email: string | null;
  notes: string;
  summary: string | null;
  reviewReason: string | null;
  injuries: string[];
  conditions: string[];
  safety: string[];
  avoidFoods: string[];
  constraints: string[];
  createdAt: string | null;
};

function since(iso: string | null): string {
  if (!iso) return '';
  const h = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000));
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function Chips({ label, values, tone }: { label: string; values: string[]; tone?: 'alert' }): ReactElement | null {
  if (values.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[1.1px] text-faint">{label}</span>
      {values.map((v) => (
        <span
          key={v}
          className={`rounded-full px-2.5 py-0.5 text-[11px] ${
            tone === 'alert' ? 'bg-alert text-alert-ink' : 'bg-warm text-soft'
          }`}
        >
          {v.replace(/_/g, ' ')}
        </span>
      ))}
    </div>
  );
}

export function IntakeReviewQueue({ items }: { items: ReviewItem[] }): ReactElement {
  const [done, setDone] = useState<string[]>([]);
  const [pending, start] = useTransition();

  const visible = items.filter((i) => !done.includes(i.profileId));

  if (visible.length === 0) {
    return (
      <div className="rounded-[14px] border border-line px-5 py-8 text-center">
        <p className="text-[15px] text-ink">Nothing to review.</p>
        <p className="mt-1 text-[13px] text-soft">
          New members whose intake note needs a human read will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {visible.map((i) => (
        <article key={i.profileId} className="rounded-[14px] border border-line bg-surface px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-ink">{i.name}</h3>
              {/* `since` is relative to now, so the two renders legitimately disagree. */}
              <p suppressHydrationWarning className="text-[12px] text-faint">
                {i.email ?? 'no email'} · {since(i.createdAt)}
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await markIntakeReviewedAction(i.profileId);
                  // Optimistic only on success. A failed clear that hid the row would silently drop a
                  // safety note, which is the one outcome this queue exists to prevent.
                  if (res.ok) setDone((d) => [...d, i.profileId]);
                })
              }
              className="tf-press shrink-0 rounded-full border border-line px-3.5 py-1.5 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink disabled:opacity-40"
            >
              Mark reviewed
            </button>
          </div>

          {i.reviewReason && (
            <p className="mt-3 rounded-[10px] bg-alert px-3.5 py-2 text-[13px] leading-snug text-alert-ink">
              {i.reviewReason}
            </p>
          )}

          {/* Her words, in full, first. */}
          <p className="mt-3 whitespace-pre-wrap text-[14px] leading-[1.6] text-ink">{i.notes}</p>

          {i.summary && (
            <p className="mt-2.5 border-t border-line pt-2.5 text-[13px] leading-snug text-soft">
              {i.summary}
            </p>
          )}

          <div className="mt-3 flex flex-col gap-1.5">
            <Chips label="Safety" values={i.safety} tone="alert" />
            <Chips label="Injuries" values={i.injuries} />
            <Chips label="Conditions" values={i.conditions} />
            <Chips label="Avoids" values={i.avoidFoods} />
            <Chips label="Setup" values={i.constraints} />
          </div>
        </article>
      ))}
    </div>
  );
}
