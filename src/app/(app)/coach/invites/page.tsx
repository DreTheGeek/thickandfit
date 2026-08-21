// Moving her Lenus clients into her own app.
//
// 272 women came across with their whole history - weigh-ins, check-ins, photos, years of messages
// - and 3 people in total could log in. The pipeline that fixes that has been built and correct for
// weeks; it had no screen, and its only caller was an internal route behind a CRON_SECRET bearer
// token. The person whose clients these are had no way to invite them.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { Eyebrow, PageTitle } from '@/components/ui/section';
import { CoachSectionTabs } from '@/components/coach/section-tabs';
import { peopleTabs } from '@/lib/coach/section-tabs';
import { getInviteQueue } from '@/lib/legacy/invite-status';
import { InviteDesk } from '@/components/coach/invite-desk';

export const dynamic = 'force-dynamic';

export default async function CoachInvitesPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  const sectionTabs = await peopleTabs();

  if (!ctx.companyId) {
    return <div className="p-8 text-sm text-muted">{t('emptyOverview')}</div>;
  }
  const queue = await getInviteQueue(ctx.companyId);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <CoachSectionTabs tabs={sectionTabs} active="/coach/invites" />
      <Eyebrow>{t('navClients')}</Eyebrow>
      <PageTitle className="mb-1 mt-1">{t('navInvites')}</PageTitle>
      <p className="tf-measure mb-5 text-[13px] leading-relaxed text-muted">{t('inviteIntro')}</p>
      <InviteDesk queue={queue} />
    </div>
  );
}
