import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icons';
import { ListRow } from '@/components/ui/list-row';
import { ProgressBar } from '@/components/ui/ring';
import { PageTitle } from '@/components/ui/section';
import { signOutAction } from '@/lib/auth/actions';

export type GoalSummary = {
  startLbs: number;
  goalLbs: number;
  currentLbs: number;
  toGo: number;
  pct: number;
};

export async function YouScreen({
  name,
  membership,
  memberSince,
  workoutCount,
  streakWeeks,
  progressLbs,
  goal,
}: {
  name: string;
  membership: string;
  memberSince: string | null;
  workoutCount: number;
  streakWeeks: number;
  progressLbs: number;
  goal: GoalSummary | null;
}): Promise<ReactElement> {
  const t = await getTranslations('app.you');
  const c = await getTranslations('app.common');
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || undefined;

  const menu: { key: string; icon: IconName; label: string; href: string; sub?: string }[] =
    [
      { key: 'photos', icon: 'camera', label: t('myPhotos'), href: '/progress' },
      { key: 'measurements', icon: 'ruler', label: t('measurements'), href: '/progress' },
      { key: 'program', icon: 'clipboard', label: t('myProgram'), href: '/workouts' },
      { key: 'account', icon: 'gear', label: t('accountSettings'), href: '/account' },
      { key: 'help', icon: 'help', label: t('help'), href: '/account' },
    ];

  return (
    <div className="px-[22px] pb-7 pt-3">
      <div className="mb-[18px] flex items-center justify-between">
        <PageTitle>{t('title')}</PageTitle>
        <Link
          href="/account"
          aria-label={t('settings')}
          className="tf-press text-faint"
        >
          <Icon name="gear" size={22} />
        </Link>
      </div>

      {/* Identity */}
      <div className="mb-5 flex items-center gap-3.5">
        <Avatar initials={initials} size={64} />
        <div>
          <div className="font-display text-[24px] leading-none tracking-[0.5px]">
            {name}
          </div>
          <div className="mt-1 text-[13px] font-semibold text-muted">{membership}</div>
          {memberSince != null && (
            <div className="text-[12px] text-faint">
              {t('memberSince', { date: memberSince })}
            </div>
          )}
        </div>
      </div>

      {/* Stat band */}
      <div className="mb-[22px] flex border border-divider">
        <Stat value={String(workoutCount)} label={t('workouts')} divider />
        <Stat value={String(streakWeeks)} label={t('weekStreak')} divider />
        <Stat
          value={progressLbs === 0 ? '0' : `${progressLbs > 0 ? '+' : ''}${progressLbs}`}
          label={t('progressLbs')}
          accent={progressLbs < 0}
        />
      </div>

      {/* Goal */}
      {goal != null && (
        <Card dark className="mb-[22px] p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[2px] text-white/70">
              {t('yourGoal')}
            </span>
            <span className="text-[11px] font-semibold text-accent">
              {goal.pct}% {t('there')}
            </span>
          </div>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <div className="text-[11px] text-white/55">{t('start')}</div>
              <div className="font-display text-[26px]">{goal.startLbs}</div>
            </div>
            <div className="text-center">
              <div className="text-[11px] text-accent">{t('current')}</div>
              <div className="font-display text-[34px] text-accent">
                {goal.currentLbs}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-white/55">{t('goal')}</div>
              <div className="font-display text-[26px]">{goal.goalLbs}</div>
            </div>
          </div>
          <div className="relative">
            <ProgressBar
              pct={goal.pct}
              color="var(--color-accent)"
              track="#2a2a2a"
            />
            <span
              className="absolute top-[-3px] h-3 w-3 -translate-x-1/2 rounded-full bg-white"
              style={{ left: `${goal.pct}%` }}
            />
          </div>
          <div className="mt-2.5 text-[11px] text-white/55">
            {t('lbsToGo', { lbs: goal.toGo })}
          </div>
        </Card>
      )}

      {/* Menu */}
      <div>
        {menu.map((m, i) => (
          <ListRow
            key={m.key}
            href={m.href}
            divider={i < menu.length - 1}
            leading={<Icon name={m.icon} size={18} />}
            title={<span className="font-medium">{m.label}</span>}
            trailing={<Icon name="chevronRight" size={16} className="text-line" />}
          />
        ))}
      </div>

      {/* Sign out */}
      <form action={signOutAction} className="mt-6">
        <button
          type="submit"
          className="tf-press w-full border border-line py-3.5 text-[12px] font-semibold uppercase tracking-[2px] text-muted"
        >
          {c('signOut')}
        </button>
      </form>
    </div>
  );
}

function Stat({
  value,
  label,
  divider = false,
  accent = false,
}: {
  value: string;
  label: string;
  divider?: boolean;
  accent?: boolean;
}): ReactElement {
  return (
    <div
      className={[
        'flex-1 py-4 text-center',
        divider ? 'border-r border-divider' : '',
      ].join(' ')}
    >
      <div className={['font-display text-[24px]', accent ? 'text-accent' : ''].join(' ')}>
        {value}
      </div>
      <div className="text-[11px] text-faint">{label}</div>
    </div>
  );
}
