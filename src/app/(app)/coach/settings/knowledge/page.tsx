// Coach Knowledge Base page. A coach pastes Stephanie's voice / method / FAQ text; it is chunked,
// embedded (when the AI key is present), and stored company-scoped for the AI coach to ground its
// replies. RSC lists the ingested sources; the client builder handles paste + delete. Coach-gated.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { listKnowledgeSources } from '@/lib/coach-ai/knowledge';
import { isConfigured } from '@/lib/coach-ai/chat';
import { PageTitle } from '@/components/ui/section';
import { KnowledgeBuilder } from '@/components/coach-ai/knowledge-builder';

export const dynamic = 'force-dynamic';

export default async function CoachKnowledgePage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coachKnowledge');
  const sources = ctx.companyId ? await listKnowledgeSources(ctx.companyId) : [];
  const aiConfigured = isConfigured();

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 lg:py-10">
      <PageTitle className="mb-2">{t('pageTitle')}</PageTitle>
      <p className="mb-6 text-[14px] text-muted">{t('pageIntro')}</p>

      {!aiConfigured && (
        <div className="mb-5 rounded-2xl border border-line bg-warm/40 px-4 py-3 text-[13px] text-muted">
          {t('noKeyNotice')}
        </div>
      )}

      <KnowledgeBuilder sources={sources} />
    </div>
  );
}
