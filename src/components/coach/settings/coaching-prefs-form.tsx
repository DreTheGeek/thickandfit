'use client';
// Screen 2: Coaching Preferences. Her defaults, not her clients' permissions.
//
// One wording change from the screen she is used to, and it is deliberate: the exercise-instructions
// row there names the platform we are leaving. Ours says "the built-in exercise guides", because a
// competitor's name has no business inside her own product.
import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import {
  ALLERGY_SUGGESTIONS,
  AVAILABILITY_SUGGESTIONS,
  DIET_SUGGESTIONS,
  DROPSET_OPTIONS,
  FOLLOW_UP_OPTIONS,
  INGREDIENT_DISPLAY_OPTIONS,
  MACRO_FLEXIBILITY_OPTIONS,
  MEAL_PLAN_FORMAT_OPTIONS,
  MEASUREMENT_UNIT_OPTIONS,
  ONBOARDING_SEND_OPTIONS,
  type CoachSettings,
  type DropsetBehavior,
  type FollowUpOption,
  type IngredientDisplay,
  type MacroFlexibility,
  type MealPlanFormat,
  type MeasurementUnit,
  type OnboardingSendWhen,
} from '@/lib/coach/settings-shared';
import { clearFollowUpsAction } from '@/lib/coach/settings-actions';
import { useSettingsDraft } from '@/components/coach/settings/use-settings-draft';
import { SettingsPageShell } from '@/components/coach/settings/settings-page-shell';
import {
  CheckboxGroupRow,
  ChipsRow,
  DangerRow,
  SelectRow,
  SettingsSection,
  TextRow,
  ToggleRow,
  type SelectOption,
} from '@/components/coach/settings/settings-rows';

/** "Days without a message before switching to Old chats": the values her old screen offered. */
const OLD_CHAT_DAY_CHOICES = [1, 2, 3, 5, 7, 14, 30] as const;

/** Narrow union so the checkbox group can key back into the draft without an unsound cast. */
type EmailNotificationKey = 'isEmailOnNewMessage' | 'isEmailOnNewCheckin' | 'isEmailOnNewLead';
const EMAIL_KEYS: readonly EmailNotificationKey[] = [
  'isEmailOnNewMessage',
  'isEmailOnNewCheckin',
  'isEmailOnNewLead',
];
function isEmailKey(key: string): key is EmailNotificationKey {
  return (EMAIL_KEYS as readonly string[]).includes(key);
}

export function CoachingPrefsForm({
  initial,
  coachEmail,
}: {
  initial: CoachSettings;
  coachEmail: string;
}): ReactElement {
  const t = useTranslations('app.coachSettings');
  const { draft, set, isDirty, isBusy, message, save } = useSettingsDraft(initial, {
    saved: t('saved'),
    failed: t('saveFailed'),
    invalid: t('saveInvalid'),
  });

  const [dangerBusy, startDanger] = useTransition();
  const [dangerResult, setDangerResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Option labels are looked up as `coaching.<prefix>_<value>`, built from the same const arrays that
  // define the values, so every key is guaranteed to exist. next-intl types the key argument against
  // the literal catalog and cannot verify a template built from a `string` prefix, so the lookup goes
  // through one narrowly scoped loosened reference rather than a cast at each of the nine call sites.
  const tKey = t as unknown as (key: string) => string;

  const opts = <T extends string>(values: readonly T[], prefix: string): SelectOption<T>[] =>
    values.map((value) => ({ value, label: tKey(`coaching.${prefix}_${value}`) }));

  const suggestions = (keys: readonly string[], prefix: string): { value: string; label: string }[] =>
    keys.map((value) => ({ value, label: tKey(`coaching.${prefix}_${value}`) }));

  const clearFollowUps = (): void => {
    setDangerResult(null);
    startDanger(async () => {
      const res = await clearFollowUpsAction();
      if (res.ok) {
        // Reflect it in the draft too, or the screen would keep showing the reminder she just removed
        // and the Save button would offer to put it back.
        set('mealPlanFollowup', 'none');
        set('trainingFollowup', 'none');
        setDangerResult({ ok: true, text: t('coaching.followUpsCleared') });
      } else {
        setDangerResult({ ok: false, text: t('saveFailed') });
      }
    });
  };

  return (
    <SettingsPageShell
      title={t('coaching.title')}
      subtitle={t('coaching.subtitle')}
      saveLabel={t('saveChanges')}
      savingLabel={t('saving')}
      isDirty={isDirty}
      isBusy={isBusy}
      message={message}
      onSave={save}
    >
      <SettingsSection title={t('coaching.mealSection')}>
        <TextRow
          label={t('coaching.mealPlanName')}
          hint={t('coaching.mealPlanNameHint')}
          value={draft.defaultMealPlanName}
          placeholder={t('coaching.mealPlanNamePlaceholder')}
          onChange={(v) => set('defaultMealPlanName', v)}
        />
        <SelectRow<IngredientDisplay>
          label={t('coaching.ingredientDisplay')}
          value={draft.recipeIngredientDisplay}
          options={opts(INGREDIENT_DISPLAY_OPTIONS, 'ingredients')}
          onChange={(v) => set('recipeIngredientDisplay', v)}
        />
        <SelectRow<FollowUpOption>
          label={t('coaching.mealFollowUp')}
          value={draft.mealPlanFollowup}
          options={opts(FOLLOW_UP_OPTIONS, 'followUp')}
          onChange={(v) => set('mealPlanFollowup', v)}
          pending={t('pendingNoScheduler')}
        />
        <SelectRow<MealPlanFormat>
          label={t('coaching.mealFormat')}
          value={draft.mealPlanFormat}
          options={opts(MEAL_PLAN_FORMAT_OPTIONS, 'mealFormat')}
          onChange={(v) => set('mealPlanFormat', v)}
          pending={t('pendingBuilder')}
        />
        <SelectRow<MacroFlexibility>
          label={t('coaching.macroFlexibility')}
          hint={t('coaching.macroFlexibilityHint')}
          value={draft.macroFlexibility}
          options={opts(MACRO_FLEXIBILITY_OPTIONS, 'macroFlex')}
          onChange={(v) => set('macroFlexibility', v)}
          pending={t('pendingBuilder')}
        />
        <ChipsRow
          label={t('coaching.allergies')}
          hint={t('coaching.allergiesHint')}
          values={draft.allergies}
          suggestions={suggestions(ALLERGY_SUGGESTIONS, 'allergy')}
          placeholder={t('coaching.allergiesPlaceholder')}
          addLabel={t('coaching.addItem')}
          removeLabel={(item) => t('coaching.removeItem', { item })}
          emptyLabel={t('coaching.noneYet')}
          max={40}
          onChange={(v) => set('allergies', v)}
          pending={t('pendingBuilder')}
        />
        <ChipsRow
          label={t('coaching.diets')}
          hint={t('coaching.dietsHint')}
          values={draft.dietaryPreferences}
          suggestions={suggestions(DIET_SUGGESTIONS, 'diet')}
          placeholder={t('coaching.dietsPlaceholder')}
          addLabel={t('coaching.addItem')}
          removeLabel={(item) => t('coaching.removeItem', { item })}
          emptyLabel={t('coaching.noneYet')}
          max={40}
          onChange={(v) => set('dietaryPreferences', v)}
          pending={t('pendingBuilder')}
        />
        <ChipsRow
          label={t('coaching.avoid')}
          hint={t('coaching.avoidHint')}
          values={draft.avoidedIngredients}
          placeholder={t('coaching.avoidPlaceholder')}
          addLabel={t('coaching.addItem')}
          removeLabel={(item) => t('coaching.removeItem', { item })}
          emptyLabel={t('coaching.noneYet')}
          max={200}
          onChange={(v) => set('avoidedIngredients', v)}
          pending={t('pendingBuilder')}
        />
        <ChipsRow
          label={t('coaching.availability')}
          hint={t('coaching.availabilityHint')}
          values={draft.availability}
          suggestions={suggestions(AVAILABILITY_SUGGESTIONS, 'avail')}
          placeholder={t('coaching.availabilityPlaceholder')}
          addLabel={t('coaching.addItem')}
          removeLabel={(item) => t('coaching.removeItem', { item })}
          emptyLabel={t('coaching.noneYet')}
          max={40}
          onChange={(v) => set('availability', v)}
          pending={t('pendingBuilder')}
        />
      </SettingsSection>

      <SettingsSection title={t('coaching.trainingSection')}>
        <TextRow
          label={t('coaching.trainingPlanName')}
          hint={t('coaching.trainingPlanNameHint')}
          value={draft.defaultTrainingPlanName}
          placeholder={t('coaching.trainingPlanNamePlaceholder')}
          onChange={(v) => set('defaultTrainingPlanName', v)}
        />
        <SelectRow<FollowUpOption>
          label={t('coaching.trainingFollowUp')}
          value={draft.trainingFollowup}
          options={opts(FOLLOW_UP_OPTIONS, 'followUp')}
          onChange={(v) => set('trainingFollowup', v)}
          pending={t('pendingNoScheduler')}
        />
        <SelectRow<DropsetBehavior>
          label={t('coaching.dropset')}
          hint={t('coaching.dropsetHint')}
          value={draft.dropsetBehavior}
          options={opts(DROPSET_OPTIONS, 'dropset')}
          onChange={(v) => set('dropsetBehavior', v)}
          pending={t('pendingBuilder')}
        />
        <ToggleRow
          label={t('coaching.exerciseGuides')}
          hint={t('coaching.exerciseGuidesHint')}
          checked={draft.isExerciseGuideShown}
          onChange={(v) => set('isExerciseGuideShown', v)}
        />
      </SettingsSection>

      <SettingsSection title={t('coaching.engagementSection')}>
        <SelectRow<MeasurementUnit>
          label={t('coaching.unit')}
          value={draft.measurementUnit}
          options={opts(MEASUREMENT_UNIT_OPTIONS, 'unit')}
          onChange={(v) => set('measurementUnit', v)}
          pending={t('pendingPerMember')}
        />
        <SelectRow<string>
          label={t('coaching.oldChats')}
          hint={t('coaching.oldChatsHint')}
          value={String(draft.oldChatDays)}
          options={OLD_CHAT_DAY_CHOICES.map((n) => ({
            value: String(n),
            label: t('coaching.dayCount', { count: n }),
          }))}
          onChange={(v) => set('oldChatDays', Number(v))}
          pending={t('pendingNoSurface')}
        />
        <ToggleRow
          label={t('coaching.birthday')}
          hint={t('coaching.birthdayHint')}
          checked={draft.isBirthdayReminderOn}
          onChange={(v) => set('isBirthdayReminderOn', v)}
          pending={t('pendingNoScheduler')}
        />
      </SettingsSection>

      <SettingsSection title={t('coaching.onboardingSection')}>
        <ToggleRow
          label={t('coaching.onboardingRequired')}
          hint={t('coaching.onboardingRequiredHint')}
          checked={draft.isOnboardingRequired}
          onChange={(v) => set('isOnboardingRequired', v)}
          pending={t('pendingAlwaysOn')}
        />
        <SelectRow<OnboardingSendWhen>
          label={t('coaching.onboardingWhen')}
          value={draft.onboardingSendWhen}
          options={opts(ONBOARDING_SEND_OPTIONS, 'onboardingWhen')}
          onChange={(v) => set('onboardingSendWhen', v)}
          pending={t('pendingAlwaysOn')}
        />
      </SettingsSection>

      <SettingsSection title={t('coaching.emailSection')}>
        <CheckboxGroupRow
          label={t('coaching.emailIntro', { email: coachEmail || t('coaching.yourEmail') })}
          items={[
            { key: 'isEmailOnNewMessage', label: t('coaching.emailNewMessage'), checked: draft.isEmailOnNewMessage },
            { key: 'isEmailOnNewCheckin', label: t('coaching.emailNewCheckin'), checked: draft.isEmailOnNewCheckin },
            { key: 'isEmailOnNewLead', label: t('coaching.emailNewLead'), checked: draft.isEmailOnNewLead },
          ]}
          onToggle={(key, next) => {
            if (isEmailKey(key)) set(key, next);
          }}
          pending={t('pendingNoSender')}
        />
      </SettingsSection>

      <SettingsSection title={t('coaching.dangerSection')}>
        <DangerRow
          label={t('coaching.clearFollowUps')}
          hint={t('coaching.clearFollowUpsHint')}
          actionLabel={t('coaching.clearFollowUpsAction')}
          confirmQuestion={t('coaching.clearFollowUpsConfirm')}
          confirmLabel={t('coaching.clearFollowUpsYes')}
          cancelLabel={t('cancel')}
          busyLabel={t('saving')}
          busy={dangerBusy}
          onConfirm={clearFollowUps}
          result={dangerResult}
        />
      </SettingsSection>
    </SettingsPageShell>
  );
}
