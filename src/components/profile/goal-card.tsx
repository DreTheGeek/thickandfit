'use client';
// The goal section of the You screen, rendered for whatever the member is working toward: a weight
// target, getting stronger, or feeling better / consistency. A gentle (difficult-relationship-with-
// food) member never gets the weight hero even if they picked it, and cannot select it in the sheet.
// The chosen type is stored per member (onboarding_responses.goal_type) via setGoalTypeAction.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import { ProgressBar } from '@/components/ui/ring';
import { setGoalTypeAction } from '@/lib/goals/actions';
import { selectableGoalTypes, type GoalType } from '@/lib/goals/goal-type';
import type { GoalSummary } from '@/components/profile/you-screen';

type Props = {
  goalType: GoalType; // what to render (gentle override already applied)
  chosenGoalType: GoalType; // what the member actually picked, for the selector's current state
  gentle: boolean;
  goal: GoalSummary | null;
  workoutCount: number;
  streakWeeks: number;
};

const LABEL_KEY: Record<GoalType, string> = {
  lose_weight: 'goalTypeLoseWeight',
  build_strength: 'goalTypeBuildStrength',
  feel_better: 'goalTypeFeelBetter',
};

export function GoalCard({
  goalType,
  chosenGoalType,
  gentle,
  goal,
  workoutCount,
  streakWeeks,
}: Props): ReactElement | null {
  const t = useTranslations('app.you');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const choose = (g: GoalType): void => {
    if (g === chosenGoalType) return setOpen(false);
    start(async () => {
      const res = await setGoalTypeAction(g);
      if (res.ok) {
        router.refresh();
        setOpen(false);
      }
    });
  };

  // A tiny "change" affordance in the card header, shared by all three variants.
  const header = (
    <div className="mb-4 flex items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-[2px] text-white/70">
        {t('yourGoal')}
      </span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tf-press flex items-center gap-1 text-[11px] font-semibold text-white/70 hover:text-white"
      >
        {t('goalChange')}
        <Icon name="chevronRight" size={13} />
      </button>
    </div>
  );

  let body: ReactElement;
  if (goalType === 'lose_weight' && goal != null) {
    body = (
      <>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <div className="text-[11px] text-white/55">{t('start')}</div>
            <div className="font-display text-[26px]">{goal.startLbs}</div>
          </div>
          <div className="text-center">
            <div className="text-[11px] text-accent">{t('current')}</div>
            <div className="font-display text-[34px] text-accent">{goal.currentLbs}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-white/55">{t('goal')}</div>
            <div className="font-display text-[26px]">{goal.goalLbs}</div>
          </div>
        </div>
        <div className="relative">
          <ProgressBar pct={goal.pct} color="var(--c-accent)" track="#2a2a2a" />
          <span
            className="absolute top-[-3px] h-3 w-3 -translate-x-1/2 rounded-full bg-white"
            style={{ left: `${goal.pct}%` }}
          />
        </div>
        <div className="mt-2.5 text-[11px] text-white/55">{t('lbsToGo', { lbs: goal.toGo })}</div>
      </>
    );
  } else if (goalType === 'build_strength') {
    body = (
      <>
        <div className="font-display text-[24px] leading-tight">{t('strengthTitle')}</div>
        <p className="mt-1.5 text-[13px] text-white/70">{t('strengthSub')}</p>
        <div className="mt-4 flex gap-8">
          <div>
            <div className="font-display text-[30px]">{workoutCount}</div>
            <div className="text-[11px] uppercase tracking-[1px] text-white/55">{t('workouts')}</div>
          </div>
          <div>
            <div className="font-display text-[30px]">{streakWeeks}</div>
            <div className="text-[11px] uppercase tracking-[1px] text-white/55">{t('dayStreak')}</div>
          </div>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <div className="font-display text-[24px] leading-tight">{t('feelBetterTitle')}</div>
        <p className="mt-1.5 text-[13px] text-white/70">{t('feelBetterSub')}</p>
        <div className="mt-4 flex gap-8">
          <div>
            <div className="font-display text-[30px]">{streakWeeks}</div>
            <div className="text-[11px] uppercase tracking-[1px] text-white/55">{t('dayStreak')}</div>
          </div>
          <div>
            <div className="font-display text-[30px]">{workoutCount}</div>
            <div className="text-[11px] uppercase tracking-[1px] text-white/55">{t('workouts')}</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* DELIBERATELY a literal dark ground, unlike the other two cards this fix touched.
          They carried their text in role tokens, so `bg-warm text-ink` reads correctly on either
          palette. This one does not: every value inside `header` and `body` is written in literal
          `text-white/70`, `text-white/55` and `bg-white`, because it was authored against
          `<Card dark>` back when that always meant a dark card. Inside `.tf-portal` that class pair
          resolved to a WHITE card, so this was white text on white, invisible rather than merely
          inverted, on the member's own profile.
          Converting the copy to role tokens is the fuller fix and belongs with the Profile screen's
          8.0 treatment. Until then the honest statement is that this card is always dark, so it says
          so in one place instead of depending on a token whose direction flips underneath it. */}
      <div className="mb-[22px] rounded-2xl bg-[#19191c] p-5 text-white">
        {header}
        {body}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-surface p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg uppercase tracking-tight">{t('goalWorkingToward')}</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('goalChange')} className="tf-press text-faint">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {selectableGoalTypes(gentle).map((g) => {
                const active = g === chosenGoalType;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => choose(g)}
                    disabled={pending}
                    className={[
                      'tf-press flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-[15px] font-semibold disabled:opacity-50',
                      active ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink',
                    ].join(' ')}
                  >
                    {t(LABEL_KEY[g])}
                    {active && <Icon name="check" size={18} strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
