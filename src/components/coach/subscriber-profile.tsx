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
import { RecipeImage } from '@/components/coach/recipe-image';
import { GeneratePlanButton } from '@/components/coach/generate-plan-button';
import { CompAccessCard } from '@/components/coach/comp-access-card';
import { MemberCoachCard, type CoachOption } from '@/components/coach/member-coach-card';
import { AssignHabitForm } from '@/components/coach/assign-habit-form';
import { CoachBodyProgress } from '@/components/coach/coach-body-progress';
import { CoachFoodDiary } from '@/components/coach/coach-food-diary';
import { CoachCheckins } from '@/components/coach/coach-checkins';
import { formatCents } from '@/components/coach/money';
import type { CoachNote } from '@/lib/coach/notes-actions';
import type { BodyStats } from '@/lib/body/types';
import type { CoachDiaryWeek } from '@/lib/coach/food-diary';
import type { MembershipInfo, ClientHabits } from '@/lib/coach/client-engagement';
import type { ClientCheckin } from '@/lib/coach/client-checkin';

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
  history: { id: string; date: string; completionPct: number | null; enjoyment: number | null; effort: number | null }[];
  id: string;
  notes: CoachNote[];
  coachName: string;
  physiqueReads: {
    id: string;
    bfLow: number | null;
    bfHigh: number | null;
    narrative: string;
    flagged: boolean;
    date: string;
  }[];
  foodPhotos: { id: string; url: string | null; caption: string | null; mealSlot: string | null; takenOn: string }[];
  contactId: string | null;
  currentPlanId: string | null;
  clientLocale: 'en' | 'es';
  intake: ClientIntake | null;
  bodyStats: BodyStats | null;
  foodDiary: CoachDiaryWeek | null;
  membership: MembershipInfo | null;
  habits: ClientHabits | null;
  compUntil: string | null;
  compActive: boolean;
  coaches: CoachOption[];
  assignedCoachId: string | null;
  coveringCoachName: string | null;
  paused: boolean;
  resumesOn: string | null;
  checkin: ClientCheckin | null;
};

export type ClientIntake = {
  sex: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  goalWeightKg: number | null;
  activity: string | null;
  goal: string | null;
  tier: string | null;
  bmi: number | null;
  timezone: string | null;
};

type TabKey =
  | 'overview' | 'info' | 'nutrition' | 'workouts' | 'community'
  | 'progress' | 'checkins' | 'messages' | 'billing' | 'notes';

const TAB_LABEL: Record<TabKey, string> = {
  overview: 'tabOverview', info: 'tabInfo', nutrition: 'tabNutrition', workouts: 'tabWorkouts', community: 'tabCommunity',
  progress: 'tabProgress', checkins: 'tabCheckins', messages: 'tabMessages', billing: 'tabBilling', notes: 'tabNotes',
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

  // Only surface tabs backed by real data, in Lenus order.
  const hasBody =
    !!data.bodyStats &&
    (data.bodyStats.weightSeries.length > 0 || data.bodyStats.measurements.some((m) => m.latest != null));
  const hasNutrition = !!data.foodDiary && (data.foodDiary.loggedDays > 0 || data.foodDiary.entries.length > 0);
  const hasCheckin = !!data.checkin && (!!data.checkin.latest || data.checkin.photos.length > 0);
  const tabs: TabKey[] = ['overview', 'info'];
  if (hasBody) tabs.push('progress');
  if (hasNutrition) tabs.push('nutrition');
  if (hasCheckin) tabs.push('checkins');
  tabs.push('workouts');

  return (
    <div>
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
          {data.contactId && (
            <Link
              href={`/coach/inbox?c=${data.contactId}`}
              className="tf-press mt-3 inline-flex items-center gap-1.5 border border-ink bg-ink px-3.5 py-2 text-[12px] font-semibold uppercase tracking-[1px] text-bg"
            >
              <Icon name="chat" size={14} />
              {t('messageClient')}
            </Link>
          )}
        </div>
        <div className="flex shrink-0 border border-divider">
          <Stat value={String(data.workouts)} label={t('stat_workouts')} divider />
          <Stat value={String(data.days)} label={t('stat_days')} divider />
          <Stat value={data.calories != null ? String(data.calories) : '-'} label={t('stat_calories')} />
        </div>
      </Card>

      {/* Tabs */}
      <div className="mb-5 flex gap-5 overflow-x-auto border-b border-line">
        {tabs.map((k) => {
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
          {data.membership && (
            <Card className="p-5 md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Eyebrow>{t('membershipTitle')}</Eyebrow>
                <PaymentBadge payment={data.membership.payment} t={t} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-4">
                <InfoRow label={t('membershipType')} value={typeLabel(data.membership.productType, data.role, t)} />
                <InfoRow label={t('membershipStatus')} value={statusLabel(data.membership.status, t)} />
                <InfoRow label={t('membershipSince')} value={fmtISO(data.membership.startedAt)} />
                <InfoRow
                  label={t('membershipUntil')}
                  value={data.membership.endedAt ? fmtISO(data.membership.endedAt) : t('membershipOngoing')}
                />
              </div>
              {data.membership.priceCents ? (
                <div className="mt-3 text-[13px] text-muted">
                  {formatCents(data.membership.priceCents, data.membership.currency)}
                  {data.membership.nextBillingDate ? ` · ${t('membershipRenews')} ${fmtISO(data.membership.nextBillingDate)}` : ''}
                </div>
              ) : null}
            </Card>
          )}
          <Card className="p-5 md:col-span-2">
            <Eyebrow>{t('memberCoachTitle')}</Eyebrow>
            <div className="mt-3">
              <MemberCoachCard
                profileId={data.id}
                coaches={data.coaches}
                assignedCoachId={data.assignedCoachId}
                coveringCoachName={data.coveringCoachName}
                paused={data.paused}
                resumesOn={data.resumesOn}
              />
            </div>
          </Card>
          <Card className="p-5 md:col-span-2">
            <Eyebrow>{t('compTitle')}</Eyebrow>
            <div className="mt-3">
              <CompAccessCard profileId={data.id} compUntil={data.compUntil} active={data.compActive} />
            </div>
          </Card>
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
            <div className="flex items-center justify-between gap-3">
              <Eyebrow>{t('mealPlanCard')}</Eyebrow>
              {data.currentPlanId && (
                <Link
                  href={`/coach/tool/meal-plans/${data.currentPlanId}`}
                  className="tf-press text-[12px] font-semibold text-accent"
                >
                  {t('viewPlan')}
                </Link>
              )}
            </div>
            <p className="mt-1.5 text-[13px] text-faint">{t('mealPlanCardHint')}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <div className="sm:flex-1">
                <GeneratePlanButton
                  clientProfileId={data.id}
                  contactId={data.contactId}
                  locale={data.clientLocale}
                />
              </div>
              <Link
                href="/coach/tool/meal-plans/new"
                className="tf-press inline-flex items-center justify-center gap-2 rounded-full border border-ink px-4 py-2.5 text-[13px] font-semibold text-ink sm:flex-1"
              >
                <Icon name="plus" size={15} /> {t('buildManually')}
              </Link>
            </div>
          </Card>
          {/* Habits: always rendered so the coach can assign the FIRST habit (the old length>0 guard
              made assignment impossible for a client with none). */}
          <Card className="p-5 md:col-span-2">
            <div className="flex items-center justify-between">
              <Eyebrow>{t('habitsTitle')}</Eyebrow>
              {data.habits?.streak && (
                <span className="text-[12px] text-muted">
                  {t('habitsStreak')} <span className="font-semibold text-ink">{data.habits.streak.current}</span>
                </span>
              )}
            </div>
            {data.habits && data.habits.habits.length > 0 ? (
              <div className="mt-3 space-y-2.5">
                {data.habits.habits.map((h) => (
                  <div key={h.id} className="flex items-center gap-3">
                    <CompletionCheck done={h.doneToday} size={20} />
                    <span className="flex-1 text-[14px]">{h.title}</span>
                    <span className="text-[12px] text-faint">{t('habitsWeek', { pct: h.pct7 })}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-faint">{t('habitsNone')}</p>
            )}
            <AssignHabitForm profileId={data.id} />
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
          {data.physiqueReads.length > 0 && (
            <Card className="p-5 md:col-span-2">
              <Eyebrow>{t('physiqueReads')}</Eyebrow>
              <div className="mt-2">
                {data.physiqueReads.map((r, i) => (
                  <div
                    key={r.id}
                    className={[
                      'py-3',
                      i < data.physiqueReads.length - 1 ? 'border-b border-divider' : '',
                      r.flagged ? '-mx-2 mt-1 rounded-lg border-l-2 border-red-400 bg-warm px-2' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-semibold">
                        {r.bfLow != null && r.bfHigh != null
                          ? `~${r.bfLow}-${r.bfHigh}% ${t('physiqueBodyFat')}`
                          : t('physiqueReads')}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-[12px] text-faint">
                        {r.flagged && (
                          <span className="rounded-full border border-red-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[1px] text-red-600">
                            {t('physiqueFlagged')}
                          </span>
                        )}
                        {r.date}
                      </span>
                    </div>
                    {r.narrative && (
                      <p className="mt-1 text-[13px] leading-relaxed text-muted">
                        {r.narrative.length > 220 ? `${r.narrative.slice(0, 220)}...` : r.narrative}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
          {data.foodPhotos.length > 0 && (
            <Card className="p-5 md:col-span-2">
              <Eyebrow>{t('foodPhotos')}</Eyebrow>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {data.foodPhotos.map((p) => (
                  <div key={p.id}>
                    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-warm">
                      <RecipeImage src={p.url} alt={p.caption ?? ''} icon="camera" sizes="25vw" />
                    </div>
                    <div className="mt-1 truncate text-[10px] text-faint">
                      {p.mealSlot ? `${p.mealSlot} · ` : ''}
                      {p.takenOn.slice(5)}
                      {p.caption ? ` · ${p.caption}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card className="p-5 md:col-span-2">
            <Eyebrow>{t('coachNotes')}</Eyebrow>
            <CoachNotesPanel subjectType="profile" subjectId={data.id} initial={data.notes} authorName={data.coachName} />
          </Card>
        </div>
      )}

      {tab === 'info' && (
        <div className="grid grid-cols-1 gap-4">
          <Card className="p-5">
            <Eyebrow>{t('infoClient')}</Eyebrow>
            {data.intake ? (
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-3">
                <InfoRow label={t('infoSex')} value={sexLabel(data.intake.sex, t)} />
                <InfoRow label={t('infoAge')} value={data.intake.age != null ? String(data.intake.age) : '-'} />
                <InfoRow label={t('infoHeight')} value={data.intake.heightCm != null ? cmToFtIn(data.intake.heightCm) : '-'} />
                <InfoRow label={t('infoWeight')} value={data.intake.weightKg != null ? `${kgToLb(data.intake.weightKg)} lb` : '-'} />
                <InfoRow label={t('infoGoalWeight')} value={data.intake.goalWeightKg != null ? `${kgToLb(data.intake.goalWeightKg)} lb` : '-'} />
                <InfoRow label={t('infoBmi')} value={data.intake.bmi != null ? String(data.intake.bmi) : '-'} />
                <InfoRow label={t('infoGoal')} value={goalLabel(data.intake.goal, t)} />
                <InfoRow label={t('infoActivity')} value={activityLabel(data.intake.activity, t)} />
                <InfoRow label={t('infoTier')} value={tierLabel(data.intake.tier, t)} />
                <InfoRow label={t('infoLanguage')} value={data.locale === 'es' ? t('spanish') : t('english')} />
                <InfoRow label={t('infoTimezone')} value={data.intake.timezone ?? '-'} />
                <InfoRow label={t('memberSinceShort')} value={data.memberSince} />
              </div>
            ) : (
              <p className="mt-3 text-[14px] text-faint">{t('infoNoIntake')}</p>
            )}
          </Card>
          <Card className="p-5">
            <Eyebrow>{t('targets')}</Eyebrow>
            {data.calories != null && data.macros ? (
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-display text-[24px] leading-none">{data.calories} kcal</span>
                <span className="text-[13px] text-muted">
                  P{data.macros.p} · C{data.macros.c} · F{data.macros.f} g
                </span>
              </div>
            ) : (
              <p className="mt-2 text-[14px] text-faint">-</p>
            )}
          </Card>
        </div>
      )}

      {tab === 'progress' && data.bodyStats && <CoachBodyProgress stats={data.bodyStats} />}

      {tab === 'nutrition' && data.foodDiary && <CoachFoodDiary week={data.foodDiary} />}

      {tab === 'checkins' && data.checkin && <CoachCheckins checkin={data.checkin} />}

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
                  className={['flex items-center justify-between gap-3 py-3', i < data.history.length - 1 ? 'border-b border-divider' : ''].join(' ')}
                >
                  <span className="text-[14px] font-medium">{h.date}</span>
                  <span className="flex items-center gap-3 text-[12px] text-faint">
                    {h.completionPct != null && (
                      <span className="font-semibold text-ink">{h.completionPct}%</span>
                    )}
                    {h.enjoyment != null && <span>{t('metricEnjoyment')} {h.enjoyment}/5</span>}
                    {h.effort != null && <span>{t('metricEffort')} {h.effort}/5</span>}
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

function InfoRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.5px] text-faint">{label}</div>
      <div className="mt-0.5 text-[15px] font-medium">{value}</div>
    </div>
  );
}

type T = ReturnType<typeof useTranslations>;
function cmToFtIn(cm: number): string {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return `${ft} ft ${inch} in`;
}
function kgToLb(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}
function sexLabel(v: string | null, t: T): string {
  if (!v) return '-';
  return v === 'female' ? t('sexFemale') : v === 'male' ? t('sexMale') : v;
}
function goalLabel(v: string | null, t: T): string {
  const m: Record<string, string> = { lose: 'goalLose', maintain: 'goalMaintain', gain: 'goalGain' };
  return v && m[v] ? t(m[v]) : v ?? '-';
}
function activityLabel(v: string | null, t: T): string {
  const m: Record<string, string> = {
    sedentary: 'actSedentary', light: 'actLight', moderate: 'actModerate', active: 'actActive', very_active: 'actVeryActive',
  };
  return v && m[v] ? t(m[v]) : v ?? '-';
}
function tierLabel(v: string | null, t: T): string {
  const m: Record<string, string> = { self: 'tierSelfShort', team: 'tierTeamShort', steph: 'tierStephShort' };
  return v && m[v] ? t(m[v]) : v ?? '-';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtISO(iso: string | null): string {
  if (!iso) return '-';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '-';
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
function statusLabel(v: string | null, t: T): string {
  const m: Record<string, string> = {
    active: 'statusActive', comped: 'statusComped', free: 'statusFree', past_due: 'statusPastDue',
    unpaid: 'statusUnpaid', canceled: 'statusCanceled', churned: 'statusChurned',
  };
  return v && m[v] ? t(m[v]) : v ?? '-';
}
function typeLabel(productType: string | null, role: string, t: T): string {
  if (productType) {
    const m: Record<string, string> = {
      personal_coaching: 'typePersonalCoaching', personalCoaching: 'typePersonalCoaching',
      bootcamp: 'typeBootcamp', basic: 'typeBasic',
    };
    return m[productType] ? t(m[productType]) : productType;
  }
  return role === 'free' ? t('segFree') : t('segPremium');
}

function PaymentBadge({ payment, t }: { payment: MembershipInfo['payment']; t: T }): ReactElement {
  const style: Record<MembershipInfo['payment'], string> = {
    paid: 'border-accent/40 bg-accent/10 text-accent',
    comped: 'border-line bg-warm text-soft',
    free: 'border-line bg-warm text-soft',
    past_due: 'border-red-300 bg-red-50 text-red-600',
  };
  const key: Record<MembershipInfo['payment'], string> = {
    paid: 'payPaid', comped: 'payComped', free: 'payFree', past_due: 'payPastDue',
  };
  return (
    <span className={['rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.5px]', style[payment]].join(' ')}>
      {t(key[payment])}
    </span>
  );
}
