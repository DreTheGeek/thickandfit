// Where a paused member lands instead of a paywall.
//
// Stephanie offers pauses and has several running right now (2026-08-13: "I have a few clients that
// are paused... to resume on 9-8"). Before this the app had no idea what a pause was, so the only
// place to put one of those women was 'canceled' — which tells her she left.
//
// The job of this page is to not re-open a decision she already made in our favour. She asked for a
// break, she has a date, and everything she has built is still here. A checkout wall on this screen
// would be the app arguing with an agreement her coach made.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/guards';
import { isPaused } from '@/lib/billing/entitlement';
import { redirect } from 'next/navigation';
import { PageTitle } from '@/components/ui/section';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';

export const dynamic = 'force-dynamic';

// What she keeps. Every one of these is guarded with requireAuthOrPaused, so the links work.
const OPEN: { href: string; icon: 'pulse' | 'clipboard' | 'community' | 'gear'; key: string }[] = [
  { href: '/progress', icon: 'pulse', key: 'linkProgress' },
  { href: '/history', icon: 'clipboard', key: 'linkHistory' },
  { href: '/inbox', icon: 'community', key: 'linkMessages' },
  { href: '/account', icon: 'gear', key: 'linkAccount' },
];

export default async function PausedPage(): Promise<ReactElement> {
  const ctx = await requireAuth();
  const t = await getTranslations('app.paused');
  const locale = await getLocale();
  const { paused, resumesOn } = await isPaused(ctx.userId);

  // Not paused? Then this page is not about her. Sending her to the dashboard rather than rendering
  // a break she is not on: a stale link must never tell a paying member her account is on hold.
  if (!paused) redirect('/dashboard');

  const resumeLabel = resumesOn
    ? new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', {
        month: 'long',
        day: 'numeric',
      }).format(new Date(resumesOn))
    : null;

  return (
    <div className="px-[22px] pb-7 pt-3">
      <PageTitle className="mb-4">{t('title')}</PageTitle>

      <Card className="p-5">
        <p className="text-[15px] leading-relaxed text-ink">
          {resumeLabel ? t('bodyWithDate', { date: resumeLabel }) : t('bodyOpenEnded')}
        </p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-soft">{t('reassurance')}</p>
      </Card>

      <h2 className="mb-2.5 mt-6 text-[12px] uppercase tracking-[2px] text-faint">
        {t('stillYours')}
      </h2>
      <div className="flex flex-col gap-2">
        {OPEN.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className="tf-press flex items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-3.5 hover:border-ink"
          >
            <Icon name={o.icon} size={18} className="text-muted" />
            <span className="text-[15px] text-ink">{t(o.key)}</span>
          </Link>
        ))}
      </div>

      {/* Resuming is her coach's action, not a self-serve button. Stephanie agrees a pause and a
          resume date with the member directly; putting a "resume now" control here would let a
          member restart billing early by accident and would contradict whatever they arranged. */}
      <p className="mt-6 text-[13px] leading-relaxed text-faint">{t('comeBackEarly')}</p>
    </div>
  );
}
