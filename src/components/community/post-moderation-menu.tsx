'use client';
// Per-post Report + Block control. Two of the four controls App Store guideline 1.2 requires when a
// community ships (the other two are the content filter and published contact info at /support).
//
// Deliberately a plain disclosure rather than a popover library: it has to work on a phone, with a
// keyboard, and inside a feed that re-renders on every reaction. Blocking confirms first because it
// is a state change the member cannot see the effect of (the blocked person just quietly disappears).
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { blockMemberAction, reportPostAction } from '@/lib/community/actions';

const REASONS = ['spam', 'harassment', 'self_harm', 'nudity', 'misinformation', 'other'] as const;
type Reason = (typeof REASONS)[number];

export function PostModerationMenu({
  postId,
  authorProfileId,
  authorName,
}: {
  postId: string;
  authorProfileId: string;
  authorName: string;
}): ReactElement {
  const t = useTranslations('app.community');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [done, setDone] = useState<'reported' | 'blocked' | null>(null);
  const [pending, start] = useTransition();

  const report = (reason: Reason): void => {
    start(async () => {
      const res = await reportPostAction({ postId, reason });
      setDone(res.ok ? 'reported' : null);
      setOpen(false);
      setReporting(false);
    });
  };

  const block = (): void => {
    if (!window.confirm(t('blockConfirm', { name: authorName }))) return;
    start(async () => {
      const res = await blockMemberAction(authorProfileId);
      if (res.ok) {
        setDone('blocked');
        setOpen(false);
        // The feed is server-rendered, so refresh to drop their posts immediately.
        router.refresh();
      }
    });
  };

  if (done) {
    return (
      <span className="text-[12px] text-faint">
        {done === 'reported' ? t('reported') : t('blocked')}
      </span>
    );
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setReporting(false);
        }}
        disabled={pending}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('postOptions')}
        className="tf-press rounded-full px-2 py-1 text-[16px] leading-none text-faint hover:text-ink disabled:opacity-50"
      >
        &#8943;
      </button>

      {open && (
        <span
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 flex w-[210px] flex-col overflow-hidden rounded-[12px] border border-line bg-surface py-1 shadow-lg"
        >
          {!reporting ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => setReporting(true)}
                className="tf-press px-3.5 py-2 text-left text-[13px] text-ink hover:bg-warm"
              >
                {t('report')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={block}
                disabled={pending}
                className="tf-press px-3.5 py-2 text-left text-[13px] text-ink hover:bg-warm disabled:opacity-50"
              >
                {t('block')}
              </button>
            </>
          ) : (
            <>
              <span className="px-3.5 py-1.5 text-[11px] uppercase tracking-[1px] text-faint">
                {t('reportReason')}
              </span>
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="menuitem"
                  onClick={() => report(r)}
                  disabled={pending}
                  className="tf-press px-3.5 py-2 text-left text-[13px] text-ink hover:bg-warm disabled:opacity-50"
                >
                  {t(`reason_${r}`)}
                </button>
              ))}
            </>
          )}
        </span>
      )}
    </span>
  );
}
