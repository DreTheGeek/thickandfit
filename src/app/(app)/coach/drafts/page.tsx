// Assistant drafts surface (PRD-30, WP8). Guarded by requireCoach (assistant/coach/operator). An
// assistant composes a message or meal-plan draft for an assigned client and submits it for approval;
// the page also lists their own drafts with a status pill. Nothing here publishes to a client; the
// publish happens only on approval (see /coach/approvals + decide()).
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { hasRole, APPROVER_ROLES } from '@/lib/auth/session';
import { listMyDrafts } from '@/lib/coach/approval';
import { listAssignedClients, type CoachProfileLite } from '@/lib/coach/assignments';
import { listClientsForApprover, listContactsForDraft } from '@/lib/coach/picker';
import { DraftComposer } from '@/components/coach/draft-composer';
import { PageTitle } from '@/components/ui/section';
import { CoachSectionTabs } from '@/components/coach/section-tabs';
import { approvalTabs } from '@/lib/coach/section-tabs';

export const dynamic = 'force-dynamic';

export default async function CoachDraftsPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach.midTicket');
  const companyId = ctx.companyId;

  if (!companyId) {
    return (
      <div>
        <PageTitle className="mb-5">{t('draftsTitle')}</PageTitle>
        <p className="text-[13px] text-faint">{t('errorFailed')}</p>
      </div>
    );
  }

  const isApprover = hasRole(ctx.role, APPROVER_ROLES);
  // Recipient space (profiles): an assistant may only draft for their assigned clients; an approver may
  // draft for any subscriber. Contact space (contacts) feeds the meal-plan target picker.
  const clients: CoachProfileLite[] = isApprover
    ? await listClientsForApprover(companyId)
    : await listAssignedClients(companyId, ctx.userId);
  const [contacts, drafts] = await Promise.all([
    listContactsForDraft(companyId),
    listMyDrafts(companyId, ctx.userId),
  ]);

  const sectionTabs = await approvalTabs();

  return (
    <div>
      <CoachSectionTabs tabs={sectionTabs} active="/coach/drafts" />
      <PageTitle className="mb-2">{t('draftsTitle')}</PageTitle>
      <p className="mb-5 text-[13px] text-faint">{t('draftsIntro')}</p>

      <DraftComposer clients={clients} contacts={contacts} />

      <section className="mt-8">
        <h2 className="tf-display mb-3 text-[18px] text-ink">{t('myDrafts')}</h2>
        {drafts.length === 0 ? (
          <div className="rounded-2xl bg-surface p-5 text-[13px] text-faint">{t('noDrafts')}</div>
        ) : (
          <div className="space-y-2">
            {drafts.map((d) => {
              const preview =
                d.itemType === 'message'
                  ? typeof d.payload.body === 'string'
                    ? d.payload.body
                    : ''
                  : typeof d.payload.name === 'string'
                    ? d.payload.name
                    : t('typeMealPlan');
              const pill =
                d.status === 'approved'
                  ? { cls: 'bg-accent text-accent-ink', key: 'statusApproved' as const }
                  : d.status === 'rejected'
                    ? { cls: 'bg-warm text-muted', key: 'statusRejected' as const }
                    : { cls: 'bg-warm text-ink', key: 'statusPending' as const };
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[14px] text-ink">{preview}</div>
                    <div className="text-[12px] text-faint">
                      {t(d.itemType === 'message' ? 'typeMessage' : 'typeMealPlan')} · {d.clientName}
                    </div>
                  </div>
                  <span
                    className={[
                      'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[1px]',
                      pill.cls,
                    ].join(' ')}
                  >
                    {t(pill.key)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
