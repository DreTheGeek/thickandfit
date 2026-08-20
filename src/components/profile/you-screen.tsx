import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Avatar } from '@/components/ui/avatar';
import { Icon, type IconName } from '@/components/ui/icons';
import { Tag } from '@/components/ui/badge';
import { ListRow } from '@/components/ui/list-row';
import { PageTitle } from '@/components/ui/section';
import { signOutAction } from '@/lib/auth/actions';
import { WeightLogCard } from '@/components/profile/weight-log-card';
import { GoalCard } from '@/components/profile/goal-card';
import type { GoalType } from '@/lib/goals/goal-type';

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
  gentle = false,
  goalType,
  chosenGoalType,
  latestLb,
  latestWeightDate,
  showCycle = true,
  supportEmail,
  children,
}: {
  name: string;
  membership: string;
  memberSince: string | null;
  supportEmail: string;
  /** Hide the cycle row when we affirmatively know it does not apply. Defaults to showing. */
  showCycle?: boolean;
  workoutCount: number;
  streakWeeks: number;
  progressLbs: number;
  goal: GoalSummary | null;
  /** Difficult-relationship-with-food screen: drop the shrinking-number goal hero and the
   *  weight-loss-as-success colour. Weight tracking itself stays available below. */
  gentle?: boolean;
  /** What the goal card renders (gentle override already applied). */
  goalType: GoalType;
  /** What the member actually chose, for the selector's current state. */
  chosenGoalType: GoalType;
  latestLb: number | null;
  latestWeightDate: string | null;
  children?: ReactNode;
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

  const menu: {
    key: string;
    icon: IconName;
    label: string;
    href: string;
    sub?: string;
    soon?: boolean;
  }[] = [
    // icon 'chat', not 'sparkles': the row opens a conversation with her coach. The key name is
    // internal; the label already reads "Coach chat".
    { key: 'aiCoach', icon: 'chat', label: t('aiCoach'), href: '/coach-chat' },
    { key: 'evolution', icon: 'pulse', label: t('evolution'), href: '/evolution' },
    { key: 'health', icon: 'heart', label: t('healthProfile'), href: '/you/health' },
    ...(showCycle ? [{ key: 'cycle', icon: 'heart' as const, label: t('cycle'), href: '/you/cycle' }] : []),
    { key: 'messages', icon: 'chat', label: t('messages'), href: '/inbox' },
    { key: 'photos', icon: 'camera', label: t('myPhotos'), href: '/progress' },
    { key: 'measurements', icon: 'ruler', label: t('measurements'), href: '/progress?tab=body' },
    { key: 'program', icon: 'clipboard', label: t('myProgram'), href: '/workouts' },
    { key: 'mealPlan', icon: 'nutrition', label: t('mealPlan'), href: '/nutrition/plan' },
    { key: 'foodPhotos', icon: 'camera', label: t('foodPhotos'), href: '/nutrition/photos' },
    { key: 'account', icon: 'gear', label: t('accountSettings'), href: '/account' },
    { key: 'help', icon: 'help', label: t('help'), href: `mailto:${supportEmail}` },
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
        <Stat value={String(streakWeeks)} label={t('dayStreak')} divider />
        <Stat
          value={progressLbs === 0 ? '0' : `${progressLbs > 0 ? '+' : ''}${progressLbs}`}
          label={t('progressLbs')}
          accent={!gentle && progressLbs < 0}
        />
      </div>

      {/* The goal section, rendered for whatever the member is working toward (weight, strength, or
          feeling better). Gentle framing + the member's own choice both resolve upstream into
          goalType; the card and its selector live in GoalCard. */}
      <GoalCard
        goalType={goalType}
        chosenGoalType={chosenGoalType}
        gentle={gentle}
        goal={goal}
        workoutCount={workoutCount}
        streakWeeks={streakWeeks}
      />

      {/* Gamification: streak ring + freeze indicator + badge grid */}
      {children}

      {/* Weight log */}
      <WeightLogCard latestLb={latestLb} recordedOn={latestWeightDate} />

      {/* Menu */}
      <div>
        {menu.map((m, i) => (
          <ListRow
            key={m.key}
            href={m.href}
            divider={i < menu.length - 1}
            leading={<Icon name={m.icon} size={18} />}
            title={
              <span className="flex items-center gap-2 font-medium">
                {m.label}
                {m.soon && <Tag>{c('soon')}</Tag>}
              </span>
            }
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
