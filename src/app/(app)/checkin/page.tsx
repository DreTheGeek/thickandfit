// Subscriber check-ins: lists the published check-in forms a coach assigned to this client. Tapping
// one opens the existing /forms/[id] renderer to fill + submit. Entitlement-gated.
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireEntitled } from '@/lib/auth/guards';
import { getAssignedCheckins } from '@/lib/checkins/checkins';
import { readCoachSettings } from '@/lib/coach/settings';
import { Icon } from '@/components/ui/icons';
import { PortalScreen, PortalHeader } from '@/components/portal/portal-chrome';
import { IconTile, ListRow } from '@/components/ui/list-row';
import { Tag } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function CheckinPage(): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const t = await getTranslations('app.checkin');
  const locale = await getLocale();
  const settings = await readCoachSettings(ctx.companyId);
  // "Allow clients to fill and send check-ins" (coach settings). Hiding the list is the courtesy half;
  // the enforcement half is in submitResponse, because a direct POST to /api/forms/[id]/submit does
  // not pass through this page.
  const checkins =
    ctx.companyId && settings.isCheckinAllowed ? await getAssignedCheckins(ctx.companyId, ctx.userId) : [];

  return (
    <PortalScreen>
      <PortalHeader title={t('title')} />
      <p className="mb-5 text-[13px] text-faint">{t('subtitle')}</p>

      {!settings.isCheckinAllowed ? (
        <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-dashed border-line px-8 text-center">
          <p className="text-[14px] text-faint">{t('paused')}</p>
        </div>
      ) : checkins.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-dashed border-line px-8 text-center">
          <p className="text-[14px] text-faint">{t('empty')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          {checkins.map((c, i) => (
            <ListRow
              key={c.formId}
              href={`/forms/${c.formId}`}
              divider={i < checkins.length - 1}
              leading={
                <IconTile>
                  <Icon name="file" size={18} />
                </IconTile>
              }
              title={(locale === 'es' && c.titleEs) || c.titleEn}
              trailing={
                c.doneRecently ? (
                  <Tag>{t('done')}</Tag>
                ) : (
                  <Icon name="chevronRight" size={18} className="text-faint" />
                )
              }
            />
          ))}
        </div>
      )}
    </PortalScreen>
  );
}
