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
import type { ClientDetail } from '@/lib/coach/clients-types';

type Tab = 'overview' | 'health' | 'messages' | 'billing' | 'payments' | 'nutrition' | 'files' | 'engagement' | 'tags';

function fmtDate(value: string | null, locale: string): string {
  if (!value) return '-';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

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

export function ClientDetailTabs({ detail, locale }: { detail: ClientDetail; locale: string }): ReactElement {
  const t = useTranslations('app.coach');
  const [tab, setTab] = useState<Tab>('overview');
  const cur = detail.currency;
  const mp = detail.mealPlan;
  const photos = detail.files.filter((f) => f.category === 'progress_photos');
  const docs = detail.files.filter((f) => f.category !== 'progress_photos');

  const hasHealth = detail.intake != null || detail.progress.weights.length > 0 || detail.progress.measures.length > 0 || detail.progress.photos.length > 0;
  const options: TabOption<Tab>[] = [
    { value: 'overview', label: t('tabOverview') },
    ...(hasHealth ? [{ value: 'health' as Tab, label: t('tabHealth') }] : []),
    { value: 'messages' as Tab, label: detail.totalMessages > 0 ? `${t('tabMessages')} (${detail.totalMessages})` : t('tabMessages') },
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

      {tab === 'overview' && (
        <div className="flex flex-col gap-4">
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
        </div>
      )}

      {tab === 'health' && (
        <div className="flex flex-col gap-4">
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
              {detail.intake.badHabits && <Row label={t('intakeBadHabits')} value={detail.intake.badHabits} />}
              {detail.intake.trainingExperience && <Row label={t('intakeTraining')} value={<span className="whitespace-pre-wrap text-left">{detail.intake.trainingExperience}</span>} />}
            </Section>
          )}
          {(detail.progress.weights.length > 0 || detail.progress.measures.length > 0) && (
            <Section title={t('progressHistory')}>
              {detail.progress.weights.length > 0 && (() => {
                const w = detail.progress.weights; // chronological (oldest->newest of loaded window)
                const last = w[w.length - 1]; // newest, so genuinely the latest
                const baseline = detail.progress.weightStartKg ?? w[0].kg; // true first weigh-in
                const delta = last.kg - baseline;
                return (
                  <>
                    <Row label={t('progressWeighIns')} value={`${detail.progress.weightCount}`} />
                    {detail.progress.weightStartKg != null && <Row label={t('progressStartWeight')} value={`${baseline.toFixed(1)} kg`} />}
                    <Row label={t('progressLatestWeight')} value={`${last.kg.toFixed(1)} kg (${fmtDate(last.on, locale)})`} />
                    <Row label={t('progressChange')} value={<span className={delta <= 0 ? 'text-good-ink' : 'text-ink'}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)} kg</span>} />
                  </>
                );
              })()}
              {detail.progress.measureCount > 0 && <Row label={t('progressMeasurements')} value={`${detail.progress.measureCount}`} />}
              {detail.progress.foodDays > 0 && <Row label={t('progressFoodLogs')} value={`${detail.progress.foodDays}`} />}
            </Section>
          )}
          {detail.progress.photos.length > 0 && (
            <Section title={`${t('progressPhotos')} (${detail.progress.photoCount})`}>
              {detail.progress.photoCount > detail.progress.photos.length && (
                <p className="py-1 text-[11px] text-faint">{t('messagesShowingRecent', { shown: detail.progress.photos.length, total: detail.progress.photoCount })}</p>
              )}
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
        <div className="flex flex-col gap-3">
          <ClientReplyBox contactId={detail.id} name={detail.name} hasAccount={detail.hasAccount} />
          {detail.totalMessages > detail.messages.length && (
            <p className="rounded-xl border border-line bg-warm/40 px-4 py-2.5 text-center text-[12px] text-muted">
              {t('messagesShowingRecent', { shown: detail.messages.length, total: detail.totalMessages })}
            </p>
          )}
          <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-4">
            {[...detail.messages].reverse().map((m) => (
              <div key={m.id} className={`flex ${m.isFromCoach ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${m.isFromCoach ? 'bg-ink text-surface' : 'bg-warm text-ink'}`}>
                  <div className={`mb-0.5 flex items-center gap-2 text-[10px] ${m.isFromCoach ? 'text-surface/70' : 'text-faint'}`}>
                    <span className="font-semibold">{m.isFromCoach ? (m.senderName ?? t('messageCoach')) : detail.name}</span>
                    <span>{fmtDateTime(m.sentAt, locale)}</span>
                    {m.type && m.type !== 'custom' && <span className="rounded-full bg-black/10 px-1.5 py-px capitalize">{m.type}</span>}
                  </div>
                  {m.body && <p className="whitespace-pre-wrap break-words text-[13px] leading-snug">{m.body}</p>}
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
        <div className="flex flex-col gap-4">
          {mealPlanCard(true)}
          {planDelivery}
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
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
              <div className="col-span-2 rounded-2xl border border-line bg-surface p-4 sm:col-span-3">
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
