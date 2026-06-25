'use client';

// Subscriber "Today" home. Four UI states (loading / error / first-run / content),
// restyled to the design-handoff prototype. Date strip is computed server-side and
// passed in to avoid hydration drift.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Skeleton } from '@/components/states/skeleton';
import { ErrorState } from '@/components/states/error-state';
import { FirstRunState } from '@/components/states/first-run-state';
import { Card } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { Wordmark } from '@/components/ui/wordmark';
import { Icon } from '@/components/ui/icons';
import { IconTile, ListRow } from '@/components/ui/list-row';
import { CompletionCheck } from '@/components/ui/completion';
import { SectionTitle } from '@/components/ui/section';
import { Tag } from '@/components/ui/badge';
import type { DashboardSummary } from '@/lib/dashboard/summary';

export type WeekDay = { key: string; label: string; day: number; isToday: boolean };

export function TodayScreen({
  name,
  dateLabel: dateLabelInit,
  weekDays: weekDaysInit,
  initial,
}: {
  name: string;
  dateLabel: string;
  weekDays: WeekDay[];
  initial: DashboardSummary | null;
}): ReactElement {
  const t = useTranslations('app');
  const locale = useLocale();
  const [summary, setSummary] = useState<DashboardSummary | null>(initial);
  // A null summary is a companyless / not-yet-provisioned session, not a fetch error.
  // Start idle and surface a dedicated "account setup pending" state below.
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  // The server computes the date strip in UTC, which mislabels "today" for the LATAM evening audience
  // (UTC-5/-6). SSR uses the server props as a stable placeholder (no hydration drift); after mount we
  // recompute from the browser's local timezone so the date label + highlighted day are correct.
  const [dateLabel, setDateLabel] = useState(dateLabelInit);
  const [weekDays, setWeekDays] = useState(weekDaysInit);
  useEffect(() => {
    const now = new Date();
    setDateLabel(
      new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(now),
    );
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const narrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
    setWeekDays(
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return {
          key: String(i),
          label: narrow.format(d),
          day: d.getDate(),
          isToday: d.toDateString() === now.toDateString(),
        };
      }),
    );
  }, [locale]);

  async function refresh(): Promise<void> {
    setState('loading');
    try {
      const res = await fetch('/api/dashboard/summary');
      const json = await res.json().catch(() => null);
      if (res.ok && json?.data) {
        setSummary(json.data);
        setState('idle');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  const greeting = name
    ? t('today.greeting', { name })
    : locale === 'es'
      ? 'Hola'
      : 'Hey there';

  const header = (
    <div className="mb-[18px] flex items-center justify-between">
      <Wordmark height={20} />
      <Link
        href="/messages"
        aria-label={t('common.notifications')}
        className="tf-press flex h-[34px] w-[34px] items-center justify-center border border-line"
      >
        <Icon name="bell" size={18} />
      </Link>
    </div>
  );

  if (state === 'loading') {
    return (
      <div className="px-[22px] pb-7 pt-3">
        {header}
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-5 h-36 rounded-2xl" />
        <Skeleton className="mt-5 h-14" />
        <Skeleton className="mt-3 h-14" />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="px-[22px] pb-7 pt-3">
        {header}
        <ErrorState onRetry={refresh} />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="px-[22px] pb-7 pt-3">
        {header}
        <FirstRunState
          title={t('today.setupPendingTitle')}
          message={t('today.setupPendingBody')}
          action={
            <ButtonLink href="mailto:hello@teamthickandfit.com" size="md">
              {t('today.setupPendingCta')}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  if (!summary.hasOnboarded) {
    return (
      <div className="px-[22px] pb-7 pt-3">
        {header}
        <FirstRunState
          title={locale === 'es' ? 'Crea tu plan' : 'Build your plan'}
          message={
            locale === 'es'
              ? 'Responde unas preguntas para tus macros y un programa que se ajuste a tu vida.'
              : 'Answer a few questions to get your custom macros and a program that fits your life.'
          }
          action={
            <ButtonLink href="/onboarding" size="md">
              {locale === 'es' ? 'Empezar' : 'Start onboarding'}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const workoutTitle = summary.todaysWorkout?.name ?? t('today.morningWorkout');
  const workoutSub = summary.todaysWorkout
    ? t('activities.todaysWorkout')
    : t('activities.noProgram');

  return (
    <div className="px-[22px] pb-7 pt-3">
      {header}

      <h1 className="tf-display text-[34px]">{greeting}</h1>
      <p className="mt-1.5 text-[14px] text-faint">{dateLabel}</p>

      {/* Check-in prompt */}
      <Card dark className="mt-5 flex items-center gap-4 p-[22px]">
        <div className="flex-1">
          <div className="tf-display text-[26px] leading-[1.06]">
            {t('today.checkinTitle')}
          </div>
          <p className="mb-4 mt-2.5 text-[13px] leading-[1.5] text-white/65">
            {t('today.checkinBody')}
          </p>
          <div className="flex items-center gap-3">
            <ButtonLink href="/checkin" variant="light" size="sm">
              {t('today.checkinCta')}
            </ButtonLink>
            <span className="inline-flex items-center border border-white/25 px-3 py-1 text-[11px] font-semibold uppercase leading-none tracking-[1px] text-white/70">
              {t('common.soon')}
            </span>
          </div>
        </div>
        <div
          className="h-[104px] w-[84px] flex-none rounded-xl bg-cover"
          style={{
            backgroundImage: "url('/brand/img/steph-hero.avif')",
            backgroundPosition: 'center 20%',
          }}
        />
      </Card>

      {/* Week strip */}
      <div className="mt-[22px] flex justify-between">
        {weekDays.map((d) => (
          <div key={d.key} className="text-center">
            <div className="text-[11px] text-faint">{d.label}</div>
            {d.isToday ? (
              <div className="mx-auto mt-1 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-ink text-[13px] text-white">
                {d.day}
              </div>
            ) : (
              <div className="mt-2 text-[13px] text-faint">{d.day}</div>
            )}
          </div>
        ))}
      </div>

      {/* Things to do */}
      <SectionTitle
        className="mb-2.5 mt-[26px]"
        action={<Link href="/workouts">{t('common.viewAll')}</Link>}
      >
        {t('today.todo')}
      </SectionTitle>

      <ListRow
        href="/workouts"
        leading={
          <IconTile>
            <Icon name="dumbbell" size={18} />
          </IconTile>
        }
        title={workoutTitle}
        sub={workoutSub}
        trailing={<CompletionCheck done={summary.streak > 0} />}
      />
      <ListRow
        href="/nutrition"
        leading={
          <IconTile>
            <Icon name="nutrition" size={18} />
          </IconTile>
        }
        title={t('today.logBreakfast')}
        trailing={<Tag outlined={false}>{t('common.soon')}</Tag>}
      />
      <ListRow
        href="/nutrition"
        divider={false}
        leading={
          <IconTile>
            <Icon name="water" size={18} />
          </IconTile>
        }
        title={t('today.drinkWater')}
        trailing={<Tag outlined={false}>{t('common.soon')}</Tag>}
      />
    </div>
  );
}
