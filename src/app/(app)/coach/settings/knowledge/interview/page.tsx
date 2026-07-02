// Coach Interview page. Stephanie (or her assistant Dani) answers the question bank; each saved section
// trains coach_knowledge so the AI can coach as her. Coach-gated (requireCoach = coach/assistant/operator).
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { getInterviewAnswers } from '@/lib/coach/interview';
import { Icon } from '@/components/ui/icons';
import { PageTitle } from '@/components/ui/section';
import { CoachInterview } from '@/components/coach/coach-interview';

export const dynamic = 'force-dynamic';

export default async function CoachInterviewPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  const answers = ctx.companyId ? await getInterviewAnswers(ctx.companyId) : {};

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 lg:py-10">
      <Link href="/coach/settings/knowledge" className="tf-press mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink">
        <Icon name="arrowLeft" size={15} /> {t('navKnowledge')}
      </Link>
      <PageTitle className="mb-2">{t('interviewTitle')}</PageTitle>
      <p className="mb-6 text-[14px] leading-relaxed text-muted">{t('interviewIntro')}</p>
      <CoachInterview initial={answers} />
    </div>
  );
}
