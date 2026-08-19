// The campaign calendar: dated messages that repeat every year.
//
// .planning/OPERATOR-GAPS.md Part 3 — "a campaign calendar as data rather than as someone's memory".
// The two seasons that matter most to this business are the last week of December, when cancellations
// peak, and the first week of January, when the year's biggest cohort arrives; neither had anything
// behind it.
//
// EMPTY ON PURPOSE. No seed campaign ships. The obvious move is a pre-written "December save" row,
// and that copy would be a guess at Stephanie's offers, her voice and her numbers made by someone
// who has not seen any of them. An empty page that says which two are worth writing first is honest;
// an invented campaign that goes out to 256 women in her name is not.
import type { ReactElement } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { PageTitle } from '@/components/ui/section';
import { isSeasonActive, type CampaignAudience } from '@/lib/campaigns/season-shared';
import { CampaignManager, type CampaignView } from '@/components/coach/campaign-manager';

export const dynamic = 'force-dynamic';

export default async function CoachCampaignsPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  if (!ctx.companyId) notFound();
  const t = await getTranslations('app.coach');
  const today = new Date().toISOString().slice(0, 10);

  const svc = createServiceClient();
  const { data } = await svc
    .from('seasonal_campaigns')
    .select(
      'id, key, title, starts_md, ends_md, audience, min_tenure_days, title_en, body_en, title_es, body_es, link, is_active',
    )
    .eq('company_id', ctx.companyId)
    .order('starts_md', { ascending: true })
    .limit(200);

  const campaigns: CampaignView[] = (
    (data ?? []) as {
      id: string;
      key: string;
      title: string;
      starts_md: string;
      ends_md: string;
      audience: string;
      min_tenure_days: number;
      title_en: string;
      body_en: string;
      title_es: string;
      body_es: string;
      link: string;
      is_active: boolean;
    }[]
  ).map((c) => ({
    id: c.id,
    key: c.key,
    title: c.title,
    startsMd: c.starts_md,
    endsMd: c.ends_md,
    audience: c.audience as CampaignAudience,
    minTenureDays: c.min_tenure_days,
    titleEn: c.title_en,
    bodyEn: c.body_en,
    titleEs: c.title_es,
    bodyEs: c.body_es,
    link: c.link,
    isActive: c.is_active,
    // Computed here rather than in the browser: this is the same predicate the generator runs, and
    // a page that decides "sending now" from the client's clock would disagree with what actually
    // sends — including across the New Year wrap, where the naive answer is wrong every day.
    isSendingNow: c.is_active && isSeasonActive(c.starts_md, c.ends_md, today),
  }));

  return (
    <div className="px-[22px] pb-7 pt-3">
      <PageTitle className="mb-2">{t('campaignsTitle')}</PageTitle>
      <p className="mb-5 max-w-prose text-[14px] leading-relaxed text-muted">{t('campaignsLead')}</p>
      <CampaignManager campaigns={campaigns} />
    </div>
  );
}
