'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Tag, Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { CompletionCheck } from '@/components/ui/completion';
import { CoachNotesPanel } from '@/components/coach/coach-notes-panel';
import type { CoachNote } from '@/lib/coach/notes-actions';

export type ProfileData = {
  name: string;
  email: string;
  memberSince: string;
  role: string;
  locale: string;
  legacy: boolean;
  workouts: number;
  days: number;
  calories: number | null;
  macros: { p: number; c: number; f: number } | null;
  programName: string | null;
  history: { id: string; date: string; completionPct: number | null; enjoyment: number | null }[];
  id: string;
  notes: CoachNote[];
  coachName: string;
};

type TabKey =
  | 'overview' | 'nutrition' | 'workouts' | 'community'
  | 'progress' | 'messages' | 'billing' | 'notes';

// Only tabs backed by real data, no empty placeholder tabs.
const TABS: TabKey[] = ['overview', 'workouts'];
const TAB_LABEL: Record<TabKey, string> = {
  overview: 'tabOverview', nutrition: 'tabNutrition', workouts: 'tabWorkouts', community: 'tabCommunity',
  progress: 'tabProgress', messages: 'tabMessages', billing: 'tabBilling', notes: 'tabNotes',
};

function initials(name: string, email: string): string {
  return (
    (name || email)
      .split(/\s+|@|\./)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

export function SubscriberProfile({ data }: { data: ProfileData }): ReactElement {
  const t = useTranslations('app.coach');
  const [tab, setTab] = useState<TabKey>('overview');

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:py-10">
      <Link href="/coach/subscribers" className="tf-press mb-3 inline-flex items-center gap-2 text-[13px] text-muted">
        <Icon name="arrowLeft" size={16} /> {t('backToSubs')}
      </Link>

      {/* Header */}
      <Card className="mb-4 flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        <Avatar initials={initials(data.name, data.email)} size={72} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-[28px] leading-none">{data.name}</div>
          <div className="mt-1.5 truncate text-[12px] text-faint">
            {data.email} · {t('memberSince', { date: data.memberSince })}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.role === 'free' ? <Tag outlined={false}>{t('segFree')}</Tag> : <Tag>{t('segPremium')}</Tag>}
            <Tag outlined={false}>{data.locale === 'es' ? t('spanish') : t('english')}</Tag>
            {data.legacy && <Badge variant="legacy">{t('legacy')}</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 border border-divider">
          <Stat value={String(data.workouts)} label={t('stat_workouts')} divider />
          <Stat value={String(data.days)} label={t('stat_days')} divider />
          <Stat value={data.calories != null ? String(data.calories) : '-'} label={t('stat_calories')} />
        </div>
      </Card>

      {/* Tabs */}
      <div className="mb-5 flex gap-5 overflow-x-auto border-b border-line">
        {TABS.map((k) => {
          const active = k === tab;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={[
                'tf-press -mb-px shrink-0 whitespace-nowrap pb-3 text-[13px]',
                active ? 'border-b-2 border-ink font-semibold text-ink' : 'text-faint',
              ].join(' ')}
            >
              {t(TAB_LABEL[k])}
            </button>
          );
        })}
      </div>

      {/* Panels */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="p-5">
            <Eyebrow>{t('assignedProgram')}</Eyebrow>
            <div className="mt-2 font-display text-[22px]">{data.programName ?? t('noProgram')}</div>
          </Card>
          <Card className="p-5">
            <Eyebrow>{t('targets')}</Eyebrow>
            {data.calories != null && data.macros ? (
              <>
                <div className="mt-2 font-display text-[22px]">{data.calories} kcal</div>
                <div className="text-[13px] text-muted">
                  P{data.macros.p} · C{data.macros.c} · F{data.macros.f} g
                </div>
              </>
            ) : (
              <div className="mt-2 text-[14px] text-faint">-</div>
            )}
          </Card>
          <Card className="p-5 md:col-span-2">
            <Eyebrow>{t('recentActivity')}</Eyebrow>
            {data.history.length === 0 ? (
              <p className="mt-3 text-[14px] text-faint">{t('noHistory')}</p>
            ) : (
              <div className="mt-2">
                {data.history.slice(0, 5).map((h, i) => (
                  <div
                    key={h.id}
                    className={['flex items-center gap-3 py-2.5', i < Math.min(5, data.history.length) - 1 ? 'border-b border-divider' : ''].join(' ')}
                  >
                    <CompletionCheck done size={20} />
                    <span className="flex-1 text-[13px]">{t('completedWorkout')}</span>
                    <span className="text-[12px] text-faint">{h.date}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="p-5 md:col-span-2">
            <Eyebrow>{t('coachNotes')}</Eyebrow>
            <CoachNotesPanel subjectType="profile" subjectId={data.id} initial={data.notes} authorName={data.coachName} />
          </Card>
        </div>
      )}

      {tab === 'workouts' && (
        <Card className="p-6">
          <Eyebrow>{t('workoutHistory')}</Eyebrow>
          {data.history.length === 0 ? (
            <p className="mt-3 text-[14px] text-faint">{t('noHistory')}</p>
          ) : (
            <div className="mt-2">
              {data.history.map((h, i) => (
                <div
                  key={h.id}
                  className={['flex items-center justify-between py-3', i < data.history.length - 1 ? 'border-b border-divider' : ''].join(' ')}
                >
                  <span className="text-[14px] font-medium">{h.date}</span>
                  <span className="text-[12px] text-faint">
                    {h.completionPct != null ? `${h.completionPct}%` : '-'}
                    {h.enjoyment != null ? ` · ${h.enjoyment}/5` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

    </div>
  );
}

function Stat({ value, label, divider = false }: { value: string; label: string; divider?: boolean }): ReactElement {
  return (
    <div className={['px-5 py-3.5 text-center', divider ? 'border-r border-divider' : ''].join(' ')}>
      <div className="font-display text-[22px]">{value}</div>
      <div className="text-[10px] uppercase tracking-[1px] text-faint">{label}</div>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactElement | string }): ReactElement {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">{children}</div>
  );
}
