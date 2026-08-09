// Approver queue surface (PRD-30, WP8). THE bypass-block in action: requireApprover() admits coach +
// operator ONLY and redirects assistant_coach to /coach/drafts, so an assistant can never load this
// page nor reach decide() (which is guarded the same way). The approver sees every pending draft across
// assistants with a payload preview and Approve / Reject buttons.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireApprover } from '@/lib/auth/guards';
import { listPendingQueue, listDecidedQueue } from '@/lib/coach/approval';
import { ApprovalQueue } from '@/components/coach/approval-queue';
import { PageTitle } from '@/components/ui/section';

export const dynamic = 'force-dynamic';

export default async function CoachApprovalsPage(): Promise<ReactElement> {
  const ctx = await requireApprover(); // assistant_coach is redirected away BEFORE anything renders
  const t = await getTranslations('app.coach.midTicket');
  const companyId = ctx.companyId;

  if (!companyId) {
    return (
      <div>
        <PageTitle className="mb-5">{t('approvalsTitle')}</PageTitle>
        <p className="text-[13px] text-faint">{t('errorFailed')}</p>
      </div>
    );
  }

  const [pending, decided] = await Promise.all([
    listPendingQueue(companyId),
    listDecidedQueue(companyId),
  ]);

  return (
    <div>
      <PageTitle className="mb-2">{t('approvalsTitle')}</PageTitle>
      <p className="mb-5 text-[13px] text-faint">{t('approvalsIntro')}</p>
      <ApprovalQueue pending={pending} decided={decided} />
    </div>
  );
}
