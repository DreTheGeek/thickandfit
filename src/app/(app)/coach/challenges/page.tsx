// Coach create-challenge authoring + list. New challenges whose window includes today go live on the
// subscriber /community leaderboard. Coach-gated.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { listChallenges } from '@/lib/community/challenge-actions';
import { CreateChallenge } from '@/components/coach/create-challenge';
import { PageTitle } from '@/components/ui/section';
import { Tag } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function CoachChallengesPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');
  const challenges = ctx.companyId ? await listChallenges(ctx.companyId) : [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageTitle className="mb-5">{t('challengesTitle')}</PageTitle>
      <CreateChallenge />

      <div className="mt-6 space-y-2">
        {challenges.length === 0 ? (
          <p className="px-1 text-[13px] text-faint">{t('noChallenges')}</p>
        ) : (
          challenges.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-2xl border border-line px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-ink">{c.title}</div>
                <div className="text-[12px] text-faint">
                  {c.metric}
                  {c.goal ? ` · goal ${c.goal}` : ''} · {c.startsOn} to {c.endsOn}
                </div>
              </div>
              {c.active ? (
                <Tag>{t('chActive')}</Tag>
              ) : (
                <span className="text-[12px] text-faint">
                  {c.endsOn < today ? t('chEnded') : t('chScheduled')}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
