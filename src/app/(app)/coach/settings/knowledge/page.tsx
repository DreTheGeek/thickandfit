// Coach Knowledge Base page. A coach pastes Stephanie's voice / method / FAQ text; it is chunked,
// embedded (when the AI key is present), and stored company-scoped for the AI coach to ground its
// replies. RSC lists the ingested sources; the client builder handles paste + delete. Coach-gated.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { listKnowledgeSources } from '@/lib/coach-ai/knowledge';
import { isConfigured } from '@/lib/coach-ai/chat';
import { getInterviewAnswers } from '@/lib/coach/interview';
import { countAnswered } from '@/lib/coach/interview-bank';
import { Icon } from '@/components/ui/icons';
import { PageTitle } from '@/components/ui/section';
import { KnowledgeBuilder } from '@/components/coach-ai/knowledge-builder';

export const dynamic = 'force-dynamic';

export default async function CoachKnowledgePage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coachKnowledge');
  const tc = await getTranslations('app.coach');
  const sources = ctx.companyId ? await listKnowledgeSources(ctx.companyId) : [];
  const answers = ctx.companyId ? await getInterviewAnswers(ctx.companyId) : {};
  const { answered, total } = countAnswered(answers);
  const aiConfigured = isConfigured();

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 lg:py-10">
      <PageTitle className="mb-2">{t('pageTitle')}</PageTitle>
      <p className="mb-6 text-[14px] text-muted">{t('pageIntro')}</p>

      {/* Guided interview: the fastest way to train the knowledge base. */}
      <Link
        href="/coach/settings/knowledge/interview"
        className="tf-press mb-6 flex items-center justify-between gap-4 rounded-2xl border border-ink bg-ink p-5 text-bg"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon name="sparkles" size={16} />
            <span className="font-display text-[19px]">{tc('interviewCardTitle')}</span>
          </div>
          <p className="mt-1 text-[13px] text-bg/70">{tc('interviewCardHint')}</p>
        </div>
        <span className="shrink-0 text-right">
          <span className="font-display text-[22px]">{answered}/{total}</span>
          <Icon name="chevronRight" size={18} className="ml-1 inline align-middle" />
        </span>
      </Link>

      {!aiConfigured && (
        <div className="mb-5 rounded-2xl border border-line bg-warm/40 px-4 py-3 text-[13px] text-muted">
          {t('noKeyNotice')}
        </div>
      )}

      <KnowledgeBuilder sources={sources} />
    </div>
  );
}
