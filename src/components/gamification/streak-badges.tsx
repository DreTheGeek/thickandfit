'use client';

// Streak ring + freeze indicator + earned/locked badge grid. Pure-SVG (recharts banned).
// Pops the existing milestone confetti once on mount when `newlyEarnedKeys` is non-empty
// (the server recompute returns those keys on the load that crossed a threshold).
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Confetti, useConfetti } from '@/components/ui/confetti';
import type { BadgeStatus, GamificationSnapshot } from '@/lib/gamification/types';

const RING_SIZE = 132;
const RING_STROKE = 12;
// The visual ring "fills" toward the next streak milestone (7, 30, 100), so progress feels live.
const MILESTONES = [7, 30, 100];

function nextMilestone(current: number): number {
  for (const m of MILESTONES) if (current < m) return m;
  return MILESTONES[MILESTONES.length - 1]!;
}

export function StreakBadges({
  snapshot,
  newlyEarnedKeys,
}: {
  snapshot: GamificationSnapshot;
  newlyEarnedKeys: string[];
}): ReactElement {
  const t = useTranslations('app.gamification');
  const locale = useLocale();
  const { pieces, fire } = useConfetti();
  const fired = useRef(false);

  useEffect(() => {
    if (!fired.current && newlyEarnedKeys.length > 0) {
      fired.current = true;
      fire();
    }
  }, [newlyEarnedKeys, fire]);

  const { streak, badges, earnedCount, totalCount } = snapshot;
  const target = nextMilestone(streak.currentStreak);
  const pct = target === 0 ? 0 : Math.min(100, Math.round((streak.currentStreak / target) * 100));

  // SVG ring geometry.
  const r = (RING_SIZE - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div className="relative">
      <Confetti pieces={pieces} />

      {/* Streak ring */}
      <Card className="mb-[22px] flex items-center gap-5 p-5">
        <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
          <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={r}
              fill="none"
              stroke="var(--c-line)"
              strokeWidth={RING_STROKE}
            />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={r}
              fill="none"
              stroke="var(--c-accent)"
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c - dash}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[34px] leading-none" aria-hidden>
              🔥
            </span>
            <span className="mt-1 font-display text-[28px] leading-none">
              {streak.currentStreak}
            </span>
            <span className="text-[10px] uppercase tracking-[1.5px] text-faint">
              {t('dayStreak')}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-display text-[18px] tracking-[0.5px]">
            {streak.currentStreak > 0 ? t('keepItUp') : t('startToday')}
          </div>
          <div className="mt-1 text-[12px] text-muted">
            {t('nextMilestone', { days: target })}
          </div>
          <div className="mt-3 flex items-center gap-4 text-[12px]">
            <span className="text-faint">
              {t('longest')}{' '}
              <span className="font-semibold text-ink">{streak.longestStreak}</span>
            </span>
            {/* Freeze indicator */}
            <span
              className="inline-flex items-center gap-1 text-faint"
              title={t('freezeHelp')}
            >
              <span aria-hidden>❄️</span>
              <span className="font-semibold text-ink">{streak.freezeTokens}</span>
              <span>{t('freezes')}</span>
            </span>
          </div>
        </div>
      </Card>

      {/* Badge grid */}
      <div className="mb-[22px]">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[2px] text-muted">
            {t('badges')}
          </span>
          <span className="text-[11px] font-semibold text-faint">
            {t('earnedOf', { earned: earnedCount, total: totalCount })}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {badges.map((b) => (
            <BadgeCell key={b.id} badge={b} locale={locale} lockedLabel={t('locked')} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BadgeCell({
  badge,
  locale,
  lockedLabel,
}: {
  badge: BadgeStatus;
  locale: string;
  lockedLabel: string;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const name = locale === 'es' ? badge.nameEs : badge.nameEn;
  const desc = locale === 'es' ? badge.descriptionEs : badge.descriptionEn;

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={[
        'tf-press flex flex-col items-center gap-1.5 border border-divider px-2 py-3.5 text-center',
        badge.earned ? 'bg-surface' : 'bg-transparent opacity-55',
      ].join(' ')}
      aria-pressed={open}
    >
      <span
        className={['text-[28px] leading-none', badge.earned ? '' : 'grayscale'].join(' ')}
        aria-hidden
      >
        {badge.icon}
      </span>
      <span className="text-[11px] font-semibold leading-tight text-ink">{name}</span>
      <span className="text-[10px] leading-tight text-faint">
        {open ? desc : badge.earned ? '' : lockedLabel}
      </span>
    </button>
  );
}
