// The 60-second waitlist quiz page. Reads the lead identity from the cookie set at signup so the
// URL is clean and shareable. A missing cookie sends the visitor back to /join, not into a broken
// state. The quiz form on submit bounces to /join/thanks so the entry count re-reads server-side.
import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { getUiLocale } from '@/lib/i18n/locale';
import { localeAlternates } from '@/lib/seo/locale-alternates';
import { getLeadStats } from '@/lib/funnel/service';
import { QuizForm } from '@/components/funnel/quiz-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('funnel');
  return {
    title: `${t('quizTitle')} · Thick & Fit`,
    description: t('quizSubline'),
    alternates: await localeAlternates('/join/quiz'),
    robots: { index: false, follow: false },
  };
}

export default async function QuizPage(): Promise<ReactElement> {
  const t = await getTranslations('funnel');
  const locale = await getUiLocale();
  const leadId = (await cookies()).get('funnel_lead')?.value ?? null;

  // If the lead is already done, tell them so; do not silently re-award or block.
  const stats = leadId ? await getLeadStats(leadId) : null;

  if (!leadId) {
    return (
      <main className="min-h-screen bg-[#0e0e0e] text-white">
        <section className="mx-auto max-w-2xl px-5 py-24 sm:px-8">
          <h1 className="text-[36px] font-extrabold uppercase leading-[0.98] tracking-[-0.01em] sm:text-[44px]">
            {t('quizTitle')}
          </h1>
          <p className="mt-4 text-[16px] leading-snug text-white/85">{t('quizMissingLead')}</p>
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

  return (
    <main className="min-h-screen bg-[#0e0e0e] text-white">
      <section className="mx-auto w-full max-w-[720px] px-5 py-14 sm:px-8 sm:py-20">
        <p className="text-[13px] font-bold uppercase leading-tight tracking-[0.18em] text-[#ff2d55]">
          {t('eyebrow')}
        </p>
        <h1 className="mt-3 text-[36px] font-extrabold uppercase leading-[0.98] tracking-[-0.01em] sm:text-[44px]">
          {t('quizTitle')}
        </h1>
        <p className="mt-3 max-w-[52ch] text-[16px] leading-snug text-white/85">
          {t('quizSubline')}
        </p>

        {stats?.quizDone ? (
          <div className="mt-8 rounded-2xl border border-white/15 bg-[#141414] p-6">
            <p className="text-[15px] text-white">{t('earnQuizDone')}</p>
            <Link
              href="/join/thanks"
              className="mt-5 inline-block rounded-full bg-white px-6 py-3 text-[13px] font-bold uppercase tracking-[0.12em] text-[#0e0e0e] transition-opacity hover:opacity-90"
            >
              {t('returnToJoin')}
            </Link>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl bg-black/40 p-6 sm:p-8">
            <QuizForm leadId={leadId} locale={locale} />
          </div>
        )}
      </section>
    </main>
  );
}
