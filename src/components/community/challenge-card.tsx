'use client';

import { type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { Avatar } from '@/components/ui/avatar';
import { RaisedCard } from '@/components/portal/portal-chrome';
import type { ActiveChallenge } from '@/lib/community/types';

// Pure-SVG / plain horizontal-bar leaderboard. recharts is banned on React 19, so the bars are
// CSS widths driven by the top participant's progress (longest bar = 100% of the track).
function Leaderboard({ challenge }: { challenge: ActiveChallenge }): ReactElement {
  const t = useTranslations('app.community');
  const max = Math.max(1, ...challenge.leaders.map((l) => l.progress));
  return (
    <div className="space-y-2.5">
      {challenge.leaders.map((row, i) => {
        const pct = Math.round((row.progress / max) * 100);
        return (
          <div key={row.profileId} className="flex items-center gap-3">
            <span className="w-5 shrink-0 text-center text-[13px] font-display text-muted tabular-nums">{i + 1}</span>
            <Avatar initials={row.initials} size={28} tone={row.isViewer ? 'warm' : 'muted'} />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-medium text-ink">
                  {row.isViewer ? t('you') : row.name}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-muted">
                  {Math.round(row.progress)}
                  {challenge.metricUnit ? ` ${challenge.metricUnit}` : ''}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-line">
                {/* Her own bar is INK, not warm. Warm is now this card's ground, so the old value
                    painted her row in the card's own colour and her bar vanished. Ink reads against
                    the track in both palettes and stays distinct from the accent everyone else gets. */}
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: row.isViewer ? 'var(--color-ink)' : 'var(--color-accent)',
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ChallengeCard({
  challenge,
  onJoin,
  joining,
}: {
  challenge: ActiveChallenge;
  onJoin: () => void;
  joining: boolean;
}): ReactElement {
  const t = useTranslations('app.community');
  const goalPct =
    challenge.goal && challenge.goal > 0
      ? Math.min(100, Math.round((challenge.viewerProgress / challenge.goal) * 100))
      : null;

  return (
    <RaisedCard className="overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            <Icon name="bolt" size={14} />
            {t('activeChallenge')}
          </div>
          <h2 className="tf-display text-[26px] leading-none text-ink">{challenge.title}</h2>
          {challenge.description ? (
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{challenge.description}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="calendar" size={13} />
          {t('daysLeft', { count: challenge.daysLeft })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="user" size={13} />
          {t('participants', { count: challenge.participantCount })}
        </span>
      </div>

      {challenge.joined && goalPct !== null ? (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[12px] text-muted">
            <span>{t('yourProgress')}</span>
            <span className="tabular-nums">{goalPct}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${goalPct}%` }} />
          </div>
        </div>
      ) : null}

      {!challenge.joined ? (
        <button
          type="button"
          onClick={onJoin}
          disabled={joining}
          className="tf-press mt-4 w-full rounded-full bg-ink py-2.5 text-[13px] font-semibold text-bg disabled:opacity-50"
        >
          {joining ? t('joining') : t('joinChallenge')}
        </button>
      ) : null}

      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          {t('leaderboard')}
        </div>
        {challenge.leaders.length > 0 ? (
          <Leaderboard challenge={challenge} />
        ) : (
          <p className="text-[13px] text-muted">{t('noParticipants')}</p>
        )}
      </div>
    </RaisedCard>
  );
}
