'use client';

import { useState, type ReactElement, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { UnderlineTabs, type TabOption } from '@/components/ui/tabs';
import { Icon } from '@/components/ui/icons';
import { MacroRing } from '@/components/coach/macro-ring';
import { RecipeImage } from '@/components/coach/recipe-image';
import { formatCents } from '@/components/coach/money';
import { ClientReplyBox } from '@/components/messages/client-reply-box';
import { messageBodyText } from '@/lib/messages/body-text';
import { PhotoCompare } from '@/components/coach/photo-compare';
import { WeightTrend } from '@/components/coach/weight-trend';
import { WeightGoalEditor } from '@/components/coach/weight-goal-editor';
import { HabitCalendar } from '@/components/coach/habit-calendar';
import { ClientCycleCard } from '@/components/coach/client-cycle-card';
import type { ClientDetail } from '@/lib/coach/clients-types';

type Tab = 'overview' | 'health' | 'messages' | 'billing' | 'payments' | 'nutrition' | 'files' | 'engagement' | 'tags';

function fmtDate(value: string | null, locale: string): string {
  if (!value) return '-';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

/**
 * An INSTANT, formatted with an hour and minute and no timeZone, so it renders in whatever zone the
 * runtime is in. The server is UTC and her browser is not, which is a hydration mismatch on every
 * value this touches. Both call sites carry suppressHydrationWarning, the same call lead-profile.tsx
 * and message-thread.tsx make: the two renders are SUPPOSED to differ, and she should read her own
 * timezone rather than the datacenter's.
 *
 * fmtDate above is safe by contrast, and the difference is worth seeing: it appends T00:00:00 to a
 * date-only string, which parses as LOCAL midnight and therefore formats to the same calendar day
 * everywhere. No time component, no drift.
 */
function fmtDateTime(value: string | null, locale: string): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
}

function fmtBytes(b: number | null): string {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

/**
 * A row of slug chips, labelled from the SAME catalog the member's own health form uses
 * (app.health.opt.*). Reusing it means the coach and the member can never end up reading two
 * different names for one answer, and it adds no new strings to translate.
 *
 * Deliberately not the prompt labels in lib/health-profile/labels.ts: those are written for the
 * model ("trains at home (assume minimal equipment ... do NOT prescribe barbell)") and would print
 * a paragraph of instructions on her screen.
 */
function Chips({
  group,
  values,
  tone,
  th,
}: {
  group: string;
  values: readonly string[];
  tone?: 'warn';
  th: (key: string) => string;
}): ReactElement {
  return (
    <span className="flex flex-wrap justify-end gap-1.5">
      {values.map((v) => (
        <span
          key={v}
          className={[
            'rounded-full px-2 py-0.5 text-[11px] font-medium',
            tone === 'warn' ? 'bg-alert-bg text-alert-ink' : 'bg-warm text-soft',
          ].join(' ')}
        >
          {th(`opt.${group}.${v}`)}
        </span>
      ))}
    </span>
  );
}

/**
 * Everything the intake already captures and the coach was never shown.
 *
 * None of this is new capture. `client_intake` has held it for months, `coach-ai/context.ts` reads
 * it into the chat prompt, and `getClientDetail` returns it, so the model knew things Stephanie
 * could not see. On the live database that is 242 eating-disorder screenings, 244 sleep answers and
 * 79 training-history write-ups that had never been rendered anywhere.
 *
 * The whole section hides when a client has answered none of it, rather than showing a card of
 * dashes: a migrated Lenus client legitimately has nothing here until she fills in the in-app form.
 */
function HealthProfileSection({
  intake,
  t,
  th,
}: {
  intake: NonNullable<ClientDetail['intake']>;
  t: (key: string) => string;
  th: (key: string) => string;
}): ReactElement | null {
  const h = intake.healthProfile;
  const pregnancy = h.pregnancy && h.pregnancy !== 'none' && h.pregnancy !== 'prefer_not' ? h.pregnancy : null;
  const has =
    h.conditions.length > 0 ||
    h.medications.length > 0 ||
    h.safety.length > 0 ||
    pregnancy != null ||
    Boolean(h.allergies) ||
    Boolean(h.sleep) ||
    Boolean(h.stress) ||
    Boolean(h.foodRelationship) ||
    Boolean(h.trainingLocation) ||
    Boolean(h.trainingExperience) ||
    intake.edsRisk != null ||
    Boolean(intake.activityLevel) ||
    intake.tdee != null ||
    Boolean(intake.clientWhy) ||
    intake.sessionsPerWeek != null ||
    (intake.equipment?.length ?? 0) > 0 ||
    Boolean(intake.allergies);

  if (!has) return null;

  // The screen is 5 questions with a cutoff of 2 (scored in lib/health-profile/scoff.ts, not here).
  // "Worth a conversation" rather than a diagnosis, because that is what a positive screen means and
  // a coach reading a red "at risk" badge would be reading something the instrument cannot say.
  const eds = intake.edsRisk;

  return (
    <Section title={t('healthProfile')}>
      {intake.clientWhy && (
        <Row label={t('healthWhy')} value={<span className="whitespace-pre-wrap text-left">{intake.clientWhy}</span>} />
      )}
      {eds && (
        <Row
          label={t('healthEdsScreen')}
          value={
            <span
              className={[
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                eds === 'potential' ? 'bg-alert-bg text-alert-ink' : 'bg-warm text-soft',
              ].join(' ')}
            >
              {eds === 'potential' ? t('healthEdsPotential') : t('healthEdsNone')}
            </span>
          }
        />
      )}
      {h.safety.length > 0 && (
        <Row label={t('healthSafety')} value={<Chips group="safety" values={h.safety} tone="warn" th={th} />} />
      )}
      {pregnancy && <Row label={t('healthPregnancy')} value={<Chips group="pregnancy" values={[pregnancy]} tone="warn" th={th} />} />}
      {h.conditions.length > 0 && <Row label={t('healthConditions')} value={<Chips group="conditions" values={h.conditions} th={th} />} />}
      {h.medications.length > 0 && <Row label={t('healthMedications')} value={<Chips group="meds" values={h.medications} th={th} />} />}
      {(h.allergies || intake.allergies) && (
        <Row label={t('healthAllergies')} value={<span className="text-left">{h.allergies || intake.allergies}</span>} />
      )}
      {h.sleep && <Row label={t('healthSleep')} value={th(`opt.sleep.${h.sleep}`)} />}
      {h.stress && <Row label={t('healthStress')} value={th(`opt.stress.${h.stress}`)} />}
      {h.foodRelationship && <Row label={t('healthFoodRelationship')} value={th(`opt.food.${h.foodRelationship}`)} />}
      {h.trainingLocation && <Row label={t('healthTrainingLocation')} value={th(`opt.trainingLocation.${h.trainingLocation}`)} />}
      {h.trainingExperience && <Row label={t('healthExperience')} value={th(`opt.experience.${h.trainingExperience}`)} />}
      {intake.sessionsPerWeek != null && <Row label={t('healthSessionsPerWeek')} value={String(intake.sessionsPerWeek)} />}
      {intake.equipment && intake.equipment.length > 0 && (
        <Row label={t('healthEquipment')} value={<span className="text-left capitalize">{intake.equipment.join(', ')}</span>} />
      )}
      {intake.tdee != null && (
        <Row
          label={t('healthTdee')}
          value={`${Math.round(intake.tdee)} kcal${intake.pal != null ? ` (PAL ${intake.pal.toFixed(2)})` : ''}`}
        />
      )}
      {/* Free prose from the Lenus intake, not a slug. Rendered as written, never parsed. */}
      {intake.activityLevel && (
        <Row label={t('healthActivity')} value={<span className="whitespace-pre-wrap text-left">{intake.activityLevel}</span>} />
      )}
    </Section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-divider py-2.5 last:border-0">
      <span className="text-[13px] text-faint">{label}</span>
      <span className="text-right text-[13px] font-medium text-ink">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-2">
      <div className="-mx-5 mb-1 border-b border-divider px-5 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[1px] text-faint">{title}</div>
      {children}
    </div>
  );
}

/**
 * A long list, opened by the coach rather than truncated by us.
 *
 * Her busiest client has 510 training sessions and 1,105 food entries. Showing the newest 8 and
 * dropping the rest is what made these records read as half-empty; dumping 510 rows into a card is
 * unreadable. The first `initial` are always visible and every remaining row is one click away, so
 * nothing is withheld and nothing has to be hunted for.
 */
function MoreList({
  children,
  initial,
  moreLabel,
  lessLabel,
}: {
  children: ReactNode[];
  initial: number;
  moreLabel: (n: number) => string;
  lessLabel: string;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const shown = open ? children : children.slice(0, initial);
  return (
    <>
      {shown}
      {children.length > initial && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="tf-press w-full py-2.5 text-[12px] font-semibold uppercase tracking-[1px] text-faint hover:text-ink"
        >
          {open ? lessLabel : moreLabel(children.length)}
        </button>
      )}
    </>
  );
}

export function ClientDetailTabs({ detail, locale }: { detail: ClientDetail; locale: string }): ReactElement {
  const t = useTranslations('app.coach');
  // The member's own health form owns the slug labels (app.health.opt.*). Borrowing them keeps the
  // coach and the member reading one vocabulary and adds nothing new to translate.
  const th = useTranslations('app.health');
  const [tab, setTab] = useState<Tab>('overview');
  const cur = detail.currency;
  const mp = detail.mealPlan;
  const photos = detail.files.filter((f) => f.category === 'progress_photos');
  const docs = detail.files.filter((f) => f.category !== 'progress_photos');

  // Cycle counts as health data. Without it in this test, a member who tracks her cycle and nothing
  // else has the whole tab hidden and her coach cannot see the one thing she does log.
  const hasHealth =
    detail.intake != null ||
    detail.progress.weights.length > 0 ||
    detail.progress.measures.length > 0 ||
    detail.progress.photos.length > 0 ||
    detail.progress.workoutCount > 0 ||
    detail.cycle != null;
  const options: TabOption<Tab>[] = [
    { value: 'overview', label: t('tabOverview') },
    ...(hasHealth ? [{ value: 'health' as Tab, label: t('tabHealth') }] : []),
    {
      value: 'messages' as Tab,
      label: detail.totalMessages > 0 ? `${t('tabMessages')} (${detail.totalMessages})` : t('tabMessages'),
      // From xl the conversation is pinned to its own rail beside the page, so the tab would be a
      // second door to the same room.
      className: 'xl:hidden',
    },
    { value: 'billing', label: t('tabBilling') },
    { value: 'payments', label: t('tabPayments') },
    { value: 'nutrition', label: t('tabNutrition') },
    { value: 'files', label: detail.files.length > 0 ? `${t('tabFiles')} (${detail.files.length})` : t('tabFiles') },
    { value: 'engagement', label: t('tabEngagement') },
    { value: 'tags', label: t('tabTags') },
  ];

  const mealPlanCard = (full: boolean): ReactElement | null => {
    if (!mp) {
      return full ? <p className="rounded-2xl border border-line bg-surface py-12 text-center text-sm text-faint">{t('noMealPlanAssigned')}</p> : null;
    }
    return (
      <Link href={`/coach/tool/meal-plans/${mp.id}`} className="tf-press block rounded-2xl border border-line bg-surface p-5 hover:border-ink">
        <div className="flex items-center gap-4">
          <MacroRing proteinG={mp.proteinG ?? 0} carbG={mp.carbG ?? 0} fatG={mp.fatG ?? 0} kcal={mp.calorieGoal ?? 0} size={72} />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">{t('assignedMealPlan')}</div>
            <div className="truncate font-display text-[18px] leading-tight">{mp.name}</div>
            <div className="mt-1 text-[12px] text-muted">
              {mp.calorieGoal != null && <span>{mp.calorieGoal} kcal · </span>}
              {Math.round(mp.proteinG ?? 0)}p / {Math.round(mp.carbG ?? 0)}c / {Math.round(mp.fatG ?? 0)}f
            </div>
          </div>
          <Icon name="chevronRight" size={18} className="shrink-0 text-line" />
        </div>
      </Link>
    );
  };

  const planDelivery = (detail.mealPlanSentAt || detail.workoutPlanSentAt) && (
    <Section title={t('planDelivery')}>
      <Row label={t('mealPlanSent')} value={fmtDate(detail.mealPlanSentAt, locale)} />
      <Row label={t('workoutPlanSent')} value={fmtDate(detail.workoutPlanSentAt, locale)} />
    </Section>
  );

  const fullBilling = (
    <Section title={t('tabBilling')}>
      <Row
        label={t('grandfatheredPrice')}
        value={
          <span className="flex items-center justify-end gap-2">
            {formatCents(detail.priceCents, cur, locale)}
            {detail.isLegacy && detail.priceCents != null && (
              <span className="rounded-full bg-warm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[1px] text-muted">{t('grandfatheredMarker')}</span>
            )}
          </span>
        }
      />
      <Row label={t('billingHealthLabel')} value={detail.billingHealth ?? t('healthLegacy')} />
      <Row label={t('autoRenew')} value={detail.isAutoRenew == null ? '-' : detail.isAutoRenew ? t('yes') : t('no')} />
      <Row label={t('nextBilling')} value={fmtDate(detail.nextBillingDate, locale)} />
      <Row label={t('nextAmount')} value={formatCents(detail.nextAmountCents, cur, locale)} />
      <Row label={t('lastCharge')} value={fmtDate(detail.lastChargeDate, locale)} />
      <Row label={t('totalCharges')} value={detail.numCharges ?? '-'} />
      <Row label={t('lifetimePaid')} value={formatCents(detail.lifetimeCents, cur, locale, 2)} />
      <Row label={t('startedAt')} value={fmtDate(detail.startedAt, locale)} />
      <Row label={t('endedAt')} value={fmtDate(detail.endedAt, locale)} />
    </Section>
  );

  return (
    <div>
      <UnderlineTabs options={options} value={tab} onChange={setTab} className="mb-5" />

      {/* Card stacks go two-up once the panel is wide enough to hold two readable label/value
          columns. items-start so a short card does not stretch to match a tall neighbour. */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          <Section title={t('membership')}>
            <Row label={t('facetStatus')} value={<span className="capitalize">{detail.status ?? '-'}</span>} />
            <Row label={t('nextBilling')} value={fmtDate(detail.nextBillingDate, locale)} />
            <Row label={t('nextAmount')} value={formatCents(detail.nextAmountCents, cur, locale)} />
            <Row label={t('lastCharge')} value={fmtDate(detail.lastChargeDate, locale)} />
            <Row label={t('autoRenew')} value={detail.isAutoRenew == null ? '-' : detail.isAutoRenew ? t('yes') : t('no')} />
          </Section>
          {planDelivery}
          {mealPlanCard(false)}
          {detail.ledger.length > 0 && (
            <Section title={t('tabPayments')}>
              {detail.ledger.slice(0, 4).map((e, i) => (
                <div key={i} className="flex items-center justify-between border-b border-divider py-2 text-[13px] last:border-0">
                  <span className="text-soft">{fmtDate(e.date, locale)}</span>
                  <span className="capitalize text-faint">{e.category ?? '-'}</span>
                  <span className="font-medium tabular-nums">{formatCents(e.grossCents, e.currency, locale, 2)}</span>
                </div>
              ))}
            </Section>
          )}
          {/* What this client has already been taught. 1,757 of these came across and none of them
              reached a client record, so the same lesson could be sent twice. History only: opening
              this page delivers nothing. */}
          {detail.lessonsSent.length > 0 && (
            <Section title={`${t('lessonsSentTitle')} (${detail.lessonsSent.length})`}>
              <MoreList initial={8} moreLabel={(n) => t('showAllN', { n })} lessLabel={t('showFewer')}>
                {detail.lessonsSent.map((l, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 border-b border-divider py-2 text-[13px] last:border-0">
                    <span className="min-w-0 truncate text-ink">{l.title}</span>
                    <span className="shrink-0 text-[11px] text-faint">{l.category || t('lessonNoCategory')}</span>
                  </div>
                ))}
              </MoreList>
            </Section>
          )}
        </div>
      )}

      {tab === 'health' && (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          {detail.intake && (
            <Section title={t('healthIntake')}>
              <Row label={t('intakeGoal')} value={<span className="capitalize">{detail.intake.goalType ?? '-'}</span>} />
              {detail.intake.startingWeightKg != null && <Row label={t('intakeStartWeight')} value={`${detail.intake.startingWeightKg.toFixed(1)} kg`} />}
              {detail.intake.targetWeightKg != null && <Row label={t('intakeTargetWeight')} value={`${detail.intake.targetWeightKg.toFixed(1)} kg`} />}
              {detail.intake.heightCm != null && <Row label={t('intakeHeight')} value={`${detail.intake.heightCm.toFixed(0)} cm`} />}
              {detail.intake.bmr != null && <Row label={t('intakeBmr')} value={`${Math.round(detail.intake.bmr)} kcal`} />}
              {detail.intake.calorieGoalKcal != null && <Row label={t('intakeCalorieGoal')} value={`${Math.round(detail.intake.calorieGoalKcal)} kcal`} />}
              {detail.intake.injuries && detail.intake.injuries.length > 0 && <Row label={t('intakeInjuries')} value={detail.intake.injuries.join(', ')} />}
              {detail.intake.injuriesDescription && <Row label={t('intakeInjuryNotes')} value={<span className="whitespace-pre-wrap text-left">{detail.intake.injuriesDescription}</span>} />}
              {detail.intake.medicalConditions && <Row label={t('intakeConditions')} value={<span className="whitespace-pre-wrap text-left">{detail.intake.medicalConditions}</span>} />}
              {detail.intake.dietaryExclusions && detail.intake.dietaryExclusions.length > 0 && <Row label={t('intakeDietary')} value={detail.intake.dietaryExclusions.join(', ')} />}
              {/* Good habits before bad. She wrote both at intake and only the bad half was ever
                  stored, which reads as a list of what is wrong with a person. */}
              {detail.intake.goodHabits && <Row label={t('intakeGoodHabits')} value={<span className="whitespace-pre-wrap text-left">{detail.intake.goodHabits}</span>} />}
              {detail.intake.badHabits && <Row label={t('intakeBadHabits')} value={<span className="whitespace-pre-wrap text-left">{detail.intake.badHabits}</span>} />}
              {detail.intake.cycleType && (
                <Row
                  label={t('intakeCycle')}
                  value={
                    detail.intake.cycleLengthDays
                      ? `${t(`intakeCycleType.${detail.intake.cycleType}`)} · ${t('intakeCycleDays', { n: detail.intake.cycleLengthDays })}`
                      : t(`intakeCycleType.${detail.intake.cycleType}`)
                  }
                />
              )}
              {detail.intake.trainingExperience && <Row label={t('intakeTraining')} value={<span className="whitespace-pre-wrap text-left">{detail.intake.trainingExperience}</span>} />}
            </Section>
          )}
          {detail.intake && <HealthProfileSection intake={detail.intake} t={t} th={th} />}
          {/* Absent entirely when she has logged nothing or has turned sharing off. No placeholder:
              an empty "Cycle" card on every client's page would train the eye to skip it, and on the
              clients who never see it, it would be a section about something they do not track. */}
          {detail.cycle && (
            <Section title={t('cycleTitle')}>
              <ClientCycleCard cycle={detail.cycle} locale={locale} />
            </Section>
          )}
          {(detail.progress.weights.length > 0 || detail.progress.measures.length > 0) && (
            <Section title={t('progressHistory')}>
              {detail.progress.weights.length > 0 && (() => {
                const w = detail.progress.weights; // chronological (oldest->newest of loaded window)
                const last = w[w.length - 1]; // newest, so genuinely the latest
                const baseline = detail.progress.weightStartKg ?? w[0].kg; // true first weigh-in
                const delta = last.kg - baseline;
                const goal = detail.intake?.targetWeightKg ?? null;
                // Distance to goal, signed toward the goal rather than in absolute terms: "3.2 kg
                // to go" is the sentence a coach says, and it works whether she is cutting or
                // gaining. Reaching it is the one place green belongs on this card.
                const toGo = goal != null ? Math.abs(last.kg - goal) : null;
                const reached = goal != null && toGo != null && toGo < 0.5;
                return (
                  <>
                    <WeightTrend points={detail.progress.weights} goalKg={goal} startKg={detail.progress.weightStartKg} locale={locale} />
                    <Row label={t('progressWeighIns')} value={`${detail.progress.weightCount}`} />
                    {detail.progress.weightStartKg != null && <Row label={t('progressStartWeight')} value={`${baseline.toFixed(1)} kg`} />}
                    <Row label={t('progressLatestWeight')} value={`${last.kg.toFixed(1)} kg (${fmtDate(last.on, locale)})`} />
                    <Row label={t('progressChange')} value={<span className={delta <= 0 ? 'text-good-ink' : 'text-ink'}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)} kg</span>} />
                    <Row
                      label={t('progressGoalWeight')}
                      value={
                        <span className="flex flex-wrap items-center justify-end gap-2">
                          {goal != null && (
                            <span className="tabular-nums">
                              {goal.toFixed(1)} kg
                              {reached ? (
                                <span className="ml-1.5 text-good-ink">{t('progressGoalReached')}</span>
                              ) : (
                                <span className="ml-1.5 text-muted">{t('progressGoalToGo', { kg: toGo!.toFixed(1) })}</span>
                              )}
                            </span>
                          )}
                          <WeightGoalEditor contactId={detail.id} initial={goal} />
                        </span>
                      }
                    />
                  </>
                );
              })()}
              {detail.progress.measureCount > 0 && <Row label={t('progressMeasurements')} value={`${detail.progress.measureCount}`} />}
              {detail.progress.foodDays > 0 && <Row label={t('progressFoodLogs')} value={`${detail.progress.foodDays}`} />}
            </Section>
          )}
          {/* Her latest check-in, and a reply box under it. Reading a check-in and answering it are
              one action for a coach, and they were on two different pages: the submission on
              /coach/subscribers/[id], the reply on the Messages tab here. */}
          {detail.latestCheckin && (
            <Section title={t('checkinLatest')}>
              <p suppressHydrationWarning className="pb-1 text-[11px] text-faint">{fmtDateTime(detail.latestCheckin.submittedAt, locale)}</p>
              {detail.latestCheckin.fields.map((f, i) => (
                <Row key={i} label={f.label} value={<span className="whitespace-pre-wrap text-left">{f.value}</span>} />
              ))}
              <div className="pt-3">
                <ClientReplyBox contactId={detail.id} name={detail.name} hasAccount={detail.hasAccount} />
              </div>
            </Section>
          )}
          {/* Every earlier check-in, under the latest one. A coach reads this week against last
              week ("energy was 3, it is 5 now"), so a single submission in isolation is the least
              useful way to show the 62 she has written. Each opens in place. */}
          {detail.checkins.length > 1 && (
            <Section title={`${t('checkinHistory')} (${detail.checkins.length})`}>
              <MoreList initial={6} moreLabel={(n) => t('showAllN', { n })} lessLabel={t('showFewer')}>
                {detail.checkins.slice(1).map((c) => (
                  <details key={c.id} className="group border-b border-divider py-2 last:border-0">
                    <summary className="tf-press flex cursor-pointer list-none items-center justify-between gap-3 text-[13px]">
                      <span className="font-medium text-ink">{fmtDate(c.submittedAt.slice(0, 10), locale)}</span>
                      <span className="flex items-center gap-2 text-[11px] text-faint">
                        {/* Some submissions carry no answers at all: she opened the form and sent
                            it empty. Saying so beats a bare "0" that reads like a broken row. */}
                        {c.fields.length === 0 ? t('checkinEmpty') : c.fields.length}
                        <Icon name="chevronRight" size={14} className="transition-transform group-open:rotate-90" />
                      </span>
                    </summary>
                    <div className="pt-1">
                      {c.fields.map((f, i) => (
                        <Row key={i} label={f.label} value={<span className="whitespace-pre-wrap text-left">{f.value}</span>} />
                      ))}
                    </div>
                  </details>
                ))}
              </MoreList>
            </Section>
          )}
          {/* Habits, on the canonical record. These are keyed by profile_id and until now only
              existed on /coach/subscribers/[id], so a coach had to know which of two URLs held
              which half of a client. */}
          {detail.habits && detail.habits.habitCount > 0 && (
            <Section title={t('habitsTitle')}>
              {detail.habits.hasHistory ? (
                <HabitCalendar
                  days={detail.habits.days}
                  habitCount={detail.habits.habitCount}
                  streak={detail.habits.streak}
                  locale={locale}
                  labels={{
                    legendFull: t('habitsLegendFull'),
                    legendPartial: t('habitsLegendPartial'),
                    legendNone: t('habitsLegendNone'),
                    streak: t('habitsStreak', { days: detail.habits.streak }),
                    ofHabits: t('habitsOf'),
                  }}
                />
              ) : (
                // Habits exist but nothing recorded whether they were done. Lenus does not export
                // that, so a calendar here would paint eight weeks of misses she never had.
                <Row
                  label={t('habitsOf')}
                  value={`${detail.habits.habitCount} · ${t('habitsNoHistory')}`}
                />
              )}
            </Section>
          )}
          {detail.progress.workoutCount > 0 && (
            <Section title={`${t('progressTraining')} (${detail.progress.workoutCount})`}>
              <MoreList initial={10} moreLabel={(n) => t('showAllN', { n })} lessLabel={t('showFewer')}>
                {detail.progress.recentWorkouts.map((w, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-divider py-2 text-[13px] last:border-0">
                    <div className="min-w-0">
                      <span className="font-medium text-ink">{w.name ?? '-'}</span>
                      {w.plan && <span className="ml-1.5 text-[11px] text-faint">{w.plan}</span>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-faint">
                      {w.pct != null && <span className={w.pct >= 80 ? 'text-good-ink' : ''}>{w.pct}%</span>}
                      <span>{fmtDate(w.on.slice(0, 10), locale)}</span>
                    </div>
                  </div>
                ))}
              </MoreList>
            </Section>
          )}
          {/* Her targets, immediately above the activity they are measured against. The check-in
              asks "did you hit your step goal?" and stores yes or no; without the number, that
              answer cannot be read. */}
          {detail.progress.goals.length > 0 && (
            <Section title={t('goalsTitle')}>
              {detail.progress.goals.map((g, i) => (
                <Row
                  key={i}
                  label={t(`goalType.${g.type}`)}
                  value={
                    <span>
                      {g.target.toLocaleString(locale)}
                      {g.unit ? ` ${g.unit}` : ''}
                      {g.frequency ? ` · ${t(`goalFreq.${g.frequency}`)}` : ''}
                      {g.selfSet ? ` · ${t('goalSelfSet')}` : ''}
                    </span>
                  }
                />
              ))}
            </Section>
          )}
          {/* Device-tracked activity, its own section rather than merged into Training history:
              a walk her watch logged is not a session she was written, and mixing them would make
              the training count answer a question nobody asked. */}
          {detail.progress.activityCount > 0 && (
            <Section title={`${t('activityTitle')} (${detail.progress.activityCount})`}>
              <MoreList initial={10} moreLabel={(n) => t('showAllN', { n })} lessLabel={t('showFewer')}>
                {detail.progress.recentActivity.map((a, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-divider py-2 text-[13px] last:border-0">
                    <div className="min-w-0">
                      <span className="font-medium text-ink">{a.name ?? t(`activityType.${a.type}`)}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-faint">
                      {a.minutes != null && <span>{t('activityMinutes', { n: a.minutes })}</span>}
                      {a.km != null && <span>{a.km} km</span>}
                      {a.kcal != null && <span>{a.kcal} kcal</span>}
                      <span>{fmtDate(a.on.slice(0, 10), locale)}</span>
                    </div>
                  </div>
                ))}
              </MoreList>
            </Section>
          )}
          {detail.progress.photos.length > 0 && (
            <Section title={`${t('progressPhotos')} (${detail.progress.photoCount})`}>
              {detail.progress.photoCount > detail.progress.photos.length && (
                <p className="py-1 text-[11px] text-faint">{t('messagesShowingRecent', { shown: detail.progress.photos.length, total: detail.progress.photoCount })}</p>
              )}
              {/* The comparison first, the grid under it. A grid tells her photos exist; the
                  comparison is what the photos are for. */}
              <div className="py-2">
                <PhotoCompare photos={detail.progress.photos} locale={locale} />
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 sm:grid-cols-4">
                {detail.progress.photos.map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noreferrer" className="tf-press block overflow-hidden rounded-xl border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`${p.pose ?? ''} ${fmtDate(p.on, locale)}`} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                    <span className="block bg-surface px-1.5 py-1 text-[10px] text-faint">{fmtDate(p.on, locale)}{p.pose ? ` - ${p.pose}` : ''}</span>
                  </a>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {tab === 'messages' && (
        // Matches the tab's own xl:hidden: if she is on Messages and widens the window, the rail
        // takes over rather than showing the thread twice.
        <div className="flex flex-col gap-3 xl:hidden">
          <ClientReplyBox contactId={detail.id} name={detail.name} hasAccount={detail.hasAccount} />
          {detail.totalMessages > detail.messages.length && (
            <p className="rounded-xl border border-line bg-warm/40 px-4 py-2.5 text-center text-[12px] text-muted">
              {t('messagesShowingRecent', { shown: detail.messages.length, total: detail.totalMessages })}
            </p>
          )}
          <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-4">
            {[...detail.messages].reverse().map((m) => (
              <div key={m.id} className={`flex ${m.isFromCoach ? 'justify-end' : 'justify-start'}`}>
                {/* A percentage cap alone stops working once the panel is wide: 78% of a 1200px
                    column is a 900px line of chat, which is unreadable. Hold a fixed measure. */}
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 xl:max-w-[620px] ${m.isFromCoach ? 'bg-bubble text-bubble-ink' : 'bg-warm text-ink'}`}>
                  <div className={`mb-0.5 flex items-center gap-2 text-[10px] ${m.isFromCoach ? 'text-surface/70' : 'text-faint'}`}>
                    <span className="font-semibold">{m.isFromCoach ? (m.senderName ?? t('messageCoach')) : detail.name}</span>
                    <span suppressHydrationWarning>{fmtDateTime(m.sentAt, locale)}</span>
                    {m.type && m.type !== 'custom' && <span className="rounded-full bg-black/10 px-1.5 py-px capitalize">{m.type}</span>}
                  </div>
                  {m.body && <p className="whitespace-pre-wrap break-words text-[13px] leading-snug">{messageBodyText(m.body)}</p>}
                  {(m.attachments.length > 0 || m.attachmentCount > 0) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.attachments.map((a, i) => (
                        <a key={i} href={a.url} target="_blank" rel="noreferrer" className="tf-press block">
                          {a.kind === 'image' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.url} alt={a.name ?? ''} className="h-24 w-24 rounded-lg object-cover" loading="lazy" />
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-black/10 px-2 py-1 text-[11px]">
                              <Icon name="download" className="h-3 w-3" />
                              {a.name ?? t('messageAttachment')}
                            </span>
                          )}
                        </a>
                      ))}
                      {/* attachments that exist but are not yet downloadable still get a marker so nothing looks lost */}
                      {Array.from({ length: Math.max(0, m.attachmentCount - m.attachments.length) }).map((_, i) => (
                        <span key={`ph-${i}`} className="inline-flex items-center gap-1 rounded-lg bg-black/10 px-2 py-1 text-[11px] opacity-70">
                          <Icon name="paperclip" className="h-3 w-3" />
                          {t('messageAttachment')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'billing' && fullBilling}

      {tab === 'payments' && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {detail.ledger.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-faint">{t('noTransactions')}</p>
          ) : (
            <>
              {detail.ledgerTruncated && (
                <p className="border-b border-line bg-warm/40 px-4 py-2.5 text-[12px] text-muted">{t('ledgerTruncated')}</p>
              )}
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-warm/40 text-left text-[10px] uppercase tracking-[1px] text-faint">
                    <th className="px-4 py-2.5 font-semibold">{t('ledgerDate')}</th>
                    <th className="px-4 py-2.5 font-semibold">{t('ledgerCategory')}</th>
                    <th className="px-4 py-2.5 text-right font-semibold">{t('ledgerGross')}</th>
                    <th className="hidden px-4 py-2.5 text-right font-semibold sm:table-cell">{t('ledgerCoach')}</th>
                    {!detail.ledgerTruncated && (
                      <th className="hidden px-4 py-2.5 text-right font-semibold md:table-cell">{t('ledgerTotal')}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {detail.ledger.map((e, i) => (
                    <tr key={i} className="border-b border-divider last:border-0">
                      <td className="px-4 py-2.5 text-soft">{fmtDate(e.date, locale)}</td>
                      <td className="px-4 py-2.5 capitalize">
                        <span className={e.category === 'refund' ? 'text-alert-ink' : 'text-soft'}>{e.category ?? '-'}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatCents(e.grossCents, e.currency, locale, 2)}</td>
                      <td className="hidden px-4 py-2.5 text-right tabular-nums text-soft sm:table-cell">{formatCents(e.coachCents, e.currency, locale, 2)}</td>
                      {!detail.ledgerTruncated && (
                        <td className="hidden px-4 py-2.5 text-right tabular-nums text-faint md:table-cell">{formatCents(e.runningCents, e.currency, locale, 2)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {tab === 'nutrition' && (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          {mealPlanCard(true)}
          {planDelivery}
          {/* The plans themselves, not just the newest one's header. 1,265 meals and 5,717
              ingredients came across in her own portion wording; until now the page linked to one
              plan and said nothing about the rest. Each plan opens in place. */}
          {detail.mealPlans.length > 0 && (
            <div className="xl:col-span-2">
              <Section title={`${t('mealPlansAll')} (${detail.mealPlans.length})`}>
                {detail.mealPlans.map((plan, pi) => {
                  const meals = plan.groups.flatMap((g) => g.meals);
                  return (
                    <details key={plan.id} className="group border-b border-divider py-2 last:border-0" open={pi === 0}>
                      <summary className="tf-press flex cursor-pointer list-none items-center justify-between gap-3 text-[13px]">
                        <span className="min-w-0 truncate font-medium text-ink">{plan.name}</span>
                        <span className="flex shrink-0 items-center gap-2 text-[11px] text-faint">
                          {plan.calorieGoal != null && <span>{plan.calorieGoal} kcal</span>}
                          <span>{t('mealPlanMeals', { n: meals.length })}</span>
                          <span>{plan.publishedAt ? fmtDate(plan.publishedAt.slice(0, 10), locale) : t('planUndated')}</span>
                          <Icon name="chevronRight" size={14} className="transition-transform group-open:rotate-90" />
                        </span>
                      </summary>
                      <div className="flex flex-col gap-3 py-3">
                        {meals.map((m, mi) => (
                          <div key={mi} className="rounded-xl border border-line bg-warm/40 px-4 py-3">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="min-w-0 font-display text-[15px] leading-tight">{m.name}</span>
                              <span className="shrink-0 text-[11px] text-faint">
                                {m.kcal != null && <>{Math.round(m.kcal)} kcal</>}
                                {m.protein != null && <> · {Math.round(m.protein)}p / {Math.round(m.carb ?? 0)}c / {Math.round(m.fat ?? 0)}f</>}
                              </span>
                            </div>
                            {m.ingredients.length > 0 && (
                              <ul className="mt-1.5 flex flex-col gap-0.5">
                                {m.ingredients.map((ing, ii) => (
                                  <li key={ii} className="flex items-baseline justify-between gap-3 text-[12px]">
                                    <span className="min-w-0 text-muted">{ing.name}</span>
                                    {/* Her own wording for the portion ("1 scoop", "80 g raw"),
                                        never a recomputed number. */}
                                    {ing.print && <span className="shrink-0 text-faint">{ing.print}</span>}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {m.comment && <p className="mt-2 whitespace-pre-wrap text-[12px] italic text-muted">{m.comment}</p>}
                            {m.procedure && (
                              <details className="group/m mt-2">
                                <summary className="tf-press flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-faint hover:text-ink">
                                  {t('mealMethod')}
                                  {(m.prepMinutes != null || m.cookMinutes != null) && (
                                    <span className="normal-case tracking-normal">
                                      · {t('mealMinutes', { n: (m.prepMinutes ?? 0) + (m.cookMinutes ?? 0) })}
                                    </span>
                                  )}
                                  <Icon name="chevronRight" size={12} className="transition-transform group-open/m:rotate-90" />
                                </summary>
                                <p className="whitespace-pre-wrap pt-1.5 text-[12px] leading-relaxed text-muted">{m.procedure}</p>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </Section>
            </div>
          )}
          {/* What she actually ate, against the plan above it. The page counted her logging days
              and showed none of the food, which is the half a coach reads. */}
          {detail.foodDays.length > 0 && (
            <div className="xl:col-span-2">
              <Section
                title={`${t('foodDiaryTitle')} · ${t('foodDiaryDays', { n: detail.foodDays.length })} · ${t('foodDiaryEntries', { n: detail.progress.foodDays })}`}
              >
                <MoreList initial={7} moreLabel={(n) => t('showAllN', { n })} lessLabel={t('showFewer')}>
                  {detail.foodDays.map((d) => (
                    <details key={d.date} className="group border-b border-divider py-2 last:border-0">
                      <summary className="tf-press flex cursor-pointer list-none items-center justify-between gap-3 text-[13px]">
                        <span className="font-medium text-ink">{fmtDate(d.date, locale)}</span>
                        <span className="flex shrink-0 items-center gap-2 text-[11px] text-faint">
                          <span className="font-medium text-ink">{d.kcal.toLocaleString(locale)} kcal</span>
                          <span>{d.protein}p / {d.carb}c / {d.fat}f</span>
                          <Icon name="chevronRight" size={14} className="transition-transform group-open:rotate-90" />
                        </span>
                      </summary>
                      <div className="py-1">
                        {d.entries.map((e, ei) => (
                          <div key={ei} className="flex items-center justify-between gap-3 border-b border-divider py-1.5 text-[12px] last:border-0">
                            <span className="min-w-0 truncate text-muted">
                              {e.slot && <span className="mr-1.5 text-[10px] uppercase tracking-[1px] text-faint">{e.slot}</span>}
                              {e.name ?? '-'}
                            </span>
                            <span className="shrink-0 text-faint">{e.kcal} kcal</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </MoreList>
              </Section>
            </div>
          )}
        </div>
      )}

      {tab === 'files' &&
        (detail.files.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface py-12 text-center text-sm text-faint">{t('noFiles')}</p>
        ) : (
          <div className="flex flex-col gap-6">
            {photos.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[1px] text-faint">
                  {t('progressPhotos')} · {photos.length}
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 2xl:grid-cols-8">
                  {photos.slice(0, 60).map((f, i) => (
                    <a
                      key={i}
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tf-press relative aspect-square overflow-hidden rounded-xl border border-line bg-warm"
                    >
                      <RecipeImage src={f.url} alt="" icon="camera" sizes="200px" />
                    </a>
                  ))}
                </div>
                {photos.length > 60 && <div className="mt-2 text-[12px] text-faint">{t('plusMore', { n: photos.length - 60 })}</div>}
              </div>
            )}
            {docs.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[1px] text-faint">
                  {t('documents')} · {docs.length}
                </div>
                <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                  {docs.map((f, i) => (
                    <a
                      key={i}
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tf-press flex items-center justify-between gap-3 border-b border-divider px-4 py-3 last:border-0 hover:bg-warm/50"
                    >
                      <span className="truncate text-[13px] capitalize">{(f.category ?? 'file').replace(/_/g, ' ')}</span>
                      <span className="shrink-0 text-[12px] text-faint">{fmtBytes(f.bytes)}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

      {tab === 'engagement' &&
        (detail.snapshot ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">
            {[
              { label: t('engMealPlans'), value: detail.snapshot.mealPlans },
              { label: t('engCheckins'), value: detail.snapshot.checkins },
              { label: t('engWorkouts'), value: detail.snapshot.workouts },
              { label: t('engMeasurements'), value: detail.snapshot.measurements },
              { label: t('engMessages'), value: detail.snapshot.messages },
              { label: t('engHealthAssessment'), value: detail.snapshot.healthAssessment },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-line bg-surface p-4">
                <div className="font-display text-[26px] leading-none">{s.value ?? 0}</div>
                <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-faint">{s.label}</div>
              </div>
            ))}
            {detail.snapshot.weightGoal && (
              <div className="col-span-2 rounded-2xl border border-line bg-surface p-4 sm:col-span-3 2xl:col-span-6">
                <span className="text-[13px] text-faint">{t('engWeightGoal')}: </span>
                <span className="text-[13px] font-medium capitalize">{detail.snapshot.weightGoal}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-faint">{t('noData')}</p>
        ))}

      {tab === 'tags' && (
        <div className="rounded-2xl border border-line bg-surface p-5">
          {detail.tags.length === 0 ? (
            <p className="py-8 text-center text-sm text-faint">{t('noTags')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {detail.tags.map((tag) => (
                <span
                  key={tag.slug}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium text-ink"
                  style={{ borderColor: `${tag.color}55` }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
