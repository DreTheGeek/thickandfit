'use client';
// Screen 1: Client App Experience. What her clients can do and see.
//
// Structure and wording follow the screen she has run her business from for years, because the point
// of this rebuild is that she does not have to relearn her own settings. What is NOT carried over is
// any pretence: the rows whose feature does not exist here yet wear a pending tag rather than a
// silent switch. See the report accompanying this change for the full live / stored split.
import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { REMINDER_PERIOD_OPTIONS, type CoachSettings, type ReminderPeriod } from '@/lib/coach/settings-shared';
import { useSettingsDraft } from '@/components/coach/settings/use-settings-draft';
import { SettingsPageShell } from '@/components/coach/settings/settings-page-shell';
import {
  InlineField,
  InlineSelect,
  NumberInput,
  SettingsSection,
  TimeInput,
  ToggleRow,
} from '@/components/coach/settings/settings-rows';

/**
 * Weekday names from Intl rather than seven more translation keys per language.
 *
 * 2024-01-07 is a Sunday in UTC, so index i lands on weekday i with 0 = Sunday, matching what the
 * column stores and what JS getDay() returns. Hardcoding the anchor keeps the mapping stable no
 * matter what day the page is rendered on.
 *
 * `timeZone: 'UTC'` is load-bearing, not tidiness. Without it the formatter renders the instant in
 * the VIEWER's zone, and anywhere west of Greenwich midnight UTC is still the previous evening: on
 * an ET machine every label shifted back a day, so a row storing 1 (Monday) rendered as "Sunday" and
 * a coach picking Monday would have been silently scheduling Tuesday.
 */
function weekdayOptions(locale: string): { value: string; label: string }[] {
  const fmt = new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  });
  return [0, 1, 2, 3, 4, 5, 6].map((i) => ({
    value: String(i),
    label: (() => {
      const label = fmt.format(new Date(Date.UTC(2024, 0, 7 + i)));
      return label.charAt(0).toUpperCase() + label.slice(1);
    })(),
  }));
}

export function ClientAppForm({ initial }: { initial: CoachSettings }): ReactElement {
  const t = useTranslations('app.coachSettings');
  const locale = useLocale();
  const { draft, set, isDirty, isBusy, message, save } = useSettingsDraft(initial, {
    saved: t('saved'),
    failed: t('saveFailed'),
    invalid: t('saveInvalid'),
  });

  const periodOptions = REMINDER_PERIOD_OPTIONS.map((value) => ({
    value,
    label: t(`clientApp.period_${value}`),
  }));

  return (
    <SettingsPageShell
      title={t('clientApp.title')}
      subtitle={t('clientApp.subtitle')}
      saveLabel={t('saveChanges')}
      savingLabel={t('saving')}
      isDirty={isDirty}
      isBusy={isBusy}
      message={message}
      onSave={save}
    >
      <SettingsSection title={t('clientApp.chatSection')}>
        <ToggleRow
          label={t('clientApp.audio')}
          checked={draft.isClientAudioAllowed}
          onChange={(v) => set('isClientAudioAllowed', v)}
          pending={t('pendingAttachments')}
        />
        <ToggleRow
          label={t('clientApp.video')}
          checked={draft.isClientVideoAllowed}
          onChange={(v) => set('isClientVideoAllowed', v)}
          pending={t('pendingAttachments')}
        />
        <ToggleRow
          label={t('clientApp.image')}
          checked={draft.isClientImageAllowed}
          onChange={(v) => set('isClientImageAllowed', v)}
          pending={t('pendingAttachments')}
        />
        <ToggleRow
          label={t('clientApp.habitSummary')}
          hint={t('clientApp.habitSummaryHint')}
          checked={draft.isHabitSummaryShared}
          onChange={(v) => set('isHabitSummaryShared', v)}
        />
        <ToggleRow
          label={t('clientApp.upsell')}
          hint={t('clientApp.upsellHint')}
          checked={draft.isUpsellShown}
          onChange={(v) => set('isUpsellShown', v)}
          pending={t('pendingNoSurface')}
        />
        <ToggleRow
          label={t('clientApp.groupRoster')}
          hint={t('clientApp.groupRosterHint')}
          checked={draft.isGroupRosterShown}
          onChange={(v) => set('isGroupRosterShown', v)}
          pending={t('pendingNoSurface')}
        />
      </SettingsSection>

      <SettingsSection title={t('clientApp.progressSection')}>
        <ToggleRow
          label={t('clientApp.weight')}
          checked={draft.isWeightShown}
          onChange={(v) => set('isWeightShown', v)}
          pending={t('pendingNoSurface')}
        />
        <ToggleRow
          label={t('clientApp.macros')}
          hint={t('clientApp.macrosHint')}
          checked={draft.isMacrosShown}
          onChange={(v) => set('isMacrosShown', v)}
          pending={t('pendingPartial')}
        />
        <ToggleRow
          label={t('clientApp.weightInCheckin')}
          checked={draft.isWeightShownInCheckin}
          onChange={(v) => set('isWeightShownInCheckin', v)}
          pending={t('pendingPartial')}
        />
        <ToggleRow
          label={t('clientApp.allowCheckins')}
          checked={draft.isCheckinAllowed}
          onChange={(v) => set('isCheckinAllowed', v)}
        />

        <ToggleRow
          label={t('clientApp.reminders')}
          hint={t('clientApp.remindersHint')}
          checked={draft.isCheckinReminderOn}
          onChange={(v) => set('isCheckinReminderOn', v)}
          pending={t('pendingNoScheduler')}
        >
          <InlineField label={t('clientApp.reminderEvery')}>
            <NumberInput
              value={draft.reminderEvery}
              min={1}
              max={12}
              onChange={(v) => set('reminderEvery', v)}
              label={t('clientApp.reminderEvery')}
            />
            <InlineSelect<ReminderPeriod>
              value={draft.reminderPeriod}
              options={periodOptions}
              onChange={(v) => set('reminderPeriod', v)}
              label={t('clientApp.reminderPeriodLabel')}
            />
          </InlineField>

          <InlineField label={t('clientApp.reminderOn')}>
            <InlineSelect<string>
              value={String(draft.reminderWeekday)}
              options={weekdayOptions(locale)}
              onChange={(v) => set('reminderWeekday', Number(v))}
              label={t('clientApp.reminderWeekdayLabel')}
            />
            <TimeInput
              value={draft.reminderTimeLocal}
              onChange={(v) => set('reminderTimeLocal', v)}
              label={t('clientApp.reminderTimeLabel')}
            />
          </InlineField>

          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={draft.isReminderSkippedWhenDone}
                onChange={(e) => set('isReminderSkippedWhenDone', e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--c-accent)]"
              />
              <span className="text-[13px] leading-snug text-ink">{t('clientApp.reminderSkip')}</span>
            </label>
            {draft.isReminderSkippedWhenDone && (
              <InlineField label={t('clientApp.reminderSkipWindow')}>
                <NumberInput
                  value={draft.reminderSkipDays}
                  min={1}
                  max={60}
                  onChange={(v) => set('reminderSkipDays', v)}
                  label={t('clientApp.reminderSkipWindow')}
                />
                <span className="text-[13px] text-soft">{t('clientApp.reminderSkipDaysUnit')}</span>
              </InlineField>
            )}
          </div>

          <div>
            <p className="mb-2.5 text-[13px] font-medium text-ink">{t('clientApp.reminderChannels')}</p>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {(
                [
                  ['isReminderPushOn', t('clientApp.channelPush')],
                  ['isReminderChatOn', t('clientApp.channelChat')],
                  ['isReminderEmailOn', t('clientApp.channelEmail')],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={draft[key]}
                    onChange={(e) => set(key, e.target.checked)}
                    className="h-4 w-4 accent-[var(--c-accent)]"
                  />
                  <span className="text-[13px] text-ink">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </ToggleRow>
      </SettingsSection>

      <SettingsSection title={t('clientApp.accessSection')}>
        <ToggleRow
          label={t('clientApp.expiry')}
          hint={t('clientApp.expiryHint')}
          checked={draft.isAccessRevokedOnExpiry}
          onChange={(v) => set('isAccessRevokedOnExpiry', v)}
        />
      </SettingsSection>
    </SettingsPageShell>
  );
}
