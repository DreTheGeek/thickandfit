// The thank-you page — the product, pre-launch, per kb-funnels doctrine 1: dopamine peaks in the
// first 30 seconds after signup, so position number is huge, share mechanic is above the fold,
// and the "earn more" path is one tap away. No email-verification gate before this screen; if a
// visitor lost their cookie we render the unknown-lead fallback rather than blocking them.
import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { getLeadStats } from '@/lib/funnel/service';
import { localeAlternates } from '@/lib/seo/locale-alternates';
import { ShareLink } from '@/components/funnel/share-link';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('funnel');
  return {
    title: `${t('thanksTitle')} · Thick & Fit`,
    description: t('thanksSubline'),
    alternates: await localeAlternates('/join/thanks'),
    robots: { index: false, follow: false },
  };
}

/** Build the absolute share URL for this lead's referral code from the incoming request host. */
async function resolveShareUrl(refCode: string): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'www.teamthickandfit.com';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}/join?r=${encodeURIComponent(refCode)}`;
}

export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const t = await getTranslations('funnel');
  const jar = await cookies();
  const leadId = jar.get('funnel_lead')?.value ?? null;
  const refCode = jar.get('funnel_ref')?.value ?? null;
  const sp = await searchParams;
  // Confirmation-arrival state from /api/funnel/confirm redirect: '1' = success, '0' = failed.
  const justConfirmed = sp.confirmed === '1';
  const confirmFailed = sp.confirmed === '0';

  const stats = leadId ? await getLeadStats(leadId) : null;

  if (!stats || !refCode) {
    return (
      <main className="min-h-screen bg-[#0e0e0e] text-white">
        <section className="mx-auto max-w-2xl px-5 py-24 sm:px-8">
          <h1 className="text-[36px] font-extrabold uppercase leading-[0.98] tracking-[-0.01em] sm:text-[44px]">
            {t('thanksTitle')}
          </h1>
          <p className="mt-4 text-[16px] leading-snug text-white/85">{t('unknownLead')}</p>
          <Link
            href="/join"
            className="mt-8 inline-block rounded-full bg-[#ff2d55] px-8 py-3.5 text-[14px] font-bold uppercase tracking-[0.02em] text-[#0e0e0e] transition-opacity hover:opacity-90"
          >
            {t('returnToJoin')}
          </Link>
        </section>
      </main>
    );
  }

  const shareUrl = await resolveShareUrl(refCode);

  return (
    <main className="min-h-screen bg-[#0e0e0e] text-white">
      <section className="mx-auto w-full max-w-[860px] px-5 py-14 sm:px-8 sm:py-20">
        {/* Hero: position + entry count. Above the fold on every phone. */}
        <p className="text-[13px] font-bold uppercase leading-tight tracking-[0.18em] text-[#ff2d55]">
          {t('eyebrow')}
        </p>
        <h1 className="mt-3 text-[40px] font-extrabold uppercase leading-[0.98] tracking-[-0.01em] sm:text-[54px]">
          {t('thanksTitle')}
        </h1>
        <p className="mt-3 max-w-[52ch] text-[16px] leading-snug text-white/85 sm:text-[18px]">
          {t('thanksSubline')}
        </p>

        {/* Double-opt-in confirmation state (kb-funnels doctrine: only affects deliverability, never
            blocks the page from loading). Three visible states, one small banner:
              - justConfirmed=1  → success (green ish, "you're set")
              - confirmFailed=0  → bad/expired link (asks to re-request)
              - default: unconfirmed but no query param → "check your inbox" nudge */}
        {justConfirmed && stats.confirmed && (
          <p className="mt-6 rounded-md border border-white/15 bg-[#141414] px-4 py-3 text-[14px] text-white">
            {t('confirmedBanner')}
          </p>
        )}
        {confirmFailed && (
          <p className="mt-6 rounded-md border border-[#ff2d55]/40 bg-[#ff2d55]/10 px-4 py-3 text-[14px] text-white">
            {t('confirmFailedBanner')}
          </p>
        )}
        {!justConfirmed && !confirmFailed && !stats.confirmed && (
          <p className="mt-6 rounded-md border border-white/15 bg-[#141414] px-4 py-3 text-[14px] text-white/85">
            {t('unconfirmedBanner')}
          </p>
        )}

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5">
          <div className="rounded-2xl bg-[#141414] p-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">
              {t('yourEntries')}
            </div>
            <div
              className="mt-2 font-extrabold leading-none text-white"
              style={{ fontSize: 'clamp(72px, 12vw, 96px)' }}
            >
              {stats.entryCount}
            </div>
          </div>
          <div className="rounded-2xl bg-[#141414] p-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">
              {t('yourPosition')}
            </div>
            <div
              className="mt-2 font-extrabold leading-none text-white"
              style={{ fontSize: 'clamp(72px, 12vw, 96px)' }}
            >
              {stats.position != null ? `#${stats.position}` : '—'}
            </div>
          </div>
        </div>

        {/* Share block — the compounding engine. */}
        <div className="mt-10 rounded-2xl border border-[#ff2d55]/30 bg-black/40 p-6 sm:p-8">
          <h2 className="text-[18px] font-extrabold uppercase leading-tight tracking-[-0.01em] sm:text-[22px]">
            {t('shareTitle')}
          </h2>
          <p className="mt-2 text-[14px] leading-snug text-white/75 sm:text-[15px]">
            {t('shareHelp')}
          </p>
          <ShareLink url={shareUrl} />
        </div>

        {/* Earn-more path — one card per action, quiz first because it's the immediate +2. */}
        <h2 className="mt-10 text-[14px] font-bold uppercase tracking-[0.14em] text-white/75">
          {t('earnMoreTitle')}
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {/* Quiz card */}
          <div className="flex flex-col gap-3 rounded-2xl bg-[#141414] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[16px] font-bold uppercase tracking-tight text-white">
                {t('earnQuizTitle')}
              </div>
              <p className="mt-1.5 max-w-[52ch] text-[14px] leading-snug text-white/70">
                {stats.quizDone ? t('earnQuizDone') : t('earnQuizBody')}
              </p>
            </div>
            {!stats.quizDone && (
              <Link
                href="/join/quiz"
                className="inline-block shrink-0 self-start rounded-full bg-white px-6 py-3 text-[13px] font-bold uppercase tracking-[0.12em] text-[#0e0e0e] transition-opacity hover:opacity-90 sm:self-auto"
              >
                {t('earnQuizCta')}
              </Link>
            )}
          </div>

          {/* Referrals status card */}
          <div className="rounded-2xl bg-[#141414] p-6">
            <div className="text-[16px] font-bold uppercase tracking-tight text-white">
              {t('earnReferTitle')}
            </div>
            <p className="mt-1.5 max-w-[62ch] text-[14px] leading-snug text-white/70">
              {t('earnReferBody', { credited: stats.referralCount })}
            </p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-[#ff2d55]"
                style={{ width: `${Math.min(100, Math.round((stats.referralCount / 20) * 100))}%` }}
                aria-hidden="true"
              />
            </div>
            <div className="mt-2 text-[12px] tabular-nums text-white/55">
              {stats.referralCount} / 20
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
