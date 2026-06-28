// Assignment-management surface (PRD-30, WP8). Approver-only: requireApprover redirects assistant_coach
// to /coach/drafts. An operator assigns an assistant_coach to a subscriber, sets the monthly rate, and
// sees the per-assistant payout rollup (AC-3, tracking only, no Stripe transfer in WP8).
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireApprover } from '@/lib/auth/guards';
import {
  listAssignments,
  getPayoutByAssistant,
  listAssistants,
  listSubscribers,
} from '@/lib/coach/assignments';
import { AssignmentTable } from '@/components/coach/assignment-table';
import { PageTitle } from '@/components/ui/section';

export const dynamic = 'force-dynamic';

export default async function CoachAssignmentsPage(): Promise<ReactElement> {
  const ctx = await requireApprover(); // assistant_coach is redirected away BEFORE anything renders
  const t = await getTranslations('app.coach.midTicket');
  const companyId = ctx.companyId;

  if (!companyId) {
    return (
      <div className="px-[22px] py-6">
        <PageTitle className="mb-5">{t('assignmentsTitle')}</PageTitle>
        <p className="text-[13px] text-faint">{t('errorFailed')}</p>
      </div>
    );
  }

  const [assignments, payout, assistants, subscribers] = await Promise.all([
    listAssignments(companyId),
    getPayoutByAssistant(companyId),
    listAssistants(companyId),
    listSubscribers(companyId),
  ]);

  return (
    <div className="px-[22px] py-6">
      <PageTitle className="mb-2">{t('assignmentsTitle')}</PageTitle>
      <p className="mb-5 text-[13px] text-faint">{t('assignmentsIntro')}</p>
      <AssignmentTable
        assignments={assignments}
        payout={payout}
        assistants={assistants}
        subscribers={subscribers}
      />
    </div>
  );
}
