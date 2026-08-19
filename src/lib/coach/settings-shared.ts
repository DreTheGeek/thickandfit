// Coach settings: the shape, the option vocabularies, the defaults and the validator.
//
// Deliberately free of `server-only` and of any Supabase import, because BOTH sides need it: the
// server reader in ./settings.ts and the client forms under src/components/coach/settings/. Putting
// the option lists here is what stops the <select> in the browser and the CHECK constraint in
// Postgres from drifting apart, which is the usual way a settings screen starts offering a value the
// database refuses.
//
// Every option union below has a matching CHECK in supabase/migrations/0115_coach_settings.sql. Add a
// value in one place and the other rejects it, which is the intended failure: loud, at write time.
import { z } from 'zod';

// ---------------------------------------------------------------------------------------------
// Option vocabularies
// ---------------------------------------------------------------------------------------------

/** How long after a plan goes out before the coach wants a nudge to look at it again. */
export const FOLLOW_UP_OPTIONS = [
  'none',
  'three_days',
  'one_week',
  'two_weeks',
  'one_month',
  'three_months',
] as const;
export type FollowUpOption = (typeof FOLLOW_UP_OPTIONS)[number];

export const INGREDIENT_DISPLAY_OPTIONS = ['grams_and_units', 'grams', 'units'] as const;
export type IngredientDisplay = (typeof INGREDIENT_DISPLAY_OPTIONS)[number];

export const MEAL_PLAN_FORMAT_OPTIONS = ['macro', 'portion'] as const;
export type MealPlanFormat = (typeof MEAL_PLAN_FORMAT_OPTIONS)[number];

export const MACRO_FLEXIBILITY_OPTIONS = ['strict', 'moderate', 'flexible'] as const;
export type MacroFlexibility = (typeof MACRO_FLEXIBILITY_OPTIONS)[number];

export const DROPSET_OPTIONS = ['separate', 'combined'] as const;
export type DropsetBehavior = (typeof DROPSET_OPTIONS)[number];

export const MEASUREMENT_UNIT_OPTIONS = ['imperial', 'metric'] as const;
export type MeasurementUnit = (typeof MEASUREMENT_UNIT_OPTIONS)[number];

export const REMINDER_PERIOD_OPTIONS = ['week', 'month'] as const;
export type ReminderPeriod = (typeof REMINDER_PERIOD_OPTIONS)[number];

// ---------------------------------------------------------------------------------------------
// Turning the settings into days
//
// These two functions are the whole reason the settings screen stopped being decorative. Every
// column they read has existed since migration 0115 and had a form control on /coach/settings, and
// nothing in the app read any of them: the check-in generator used a hardcoded 7 days, and
// settings-actions.ts says out loud that follow-ups are "CONFIGURED here and nothing in the app
// schedules one yet". Stephanie runs check-ins every TWO weeks (2026-08-13), so the hardcoded 7 was
// about to nag 256 women at twice her real cadence.
// ---------------------------------------------------------------------------------------------

/** A month is 30 days here. Calendar months would make "every 2 months" drift by up to 6 days a
 *  year against a reminder the coach thinks of as regular, and nobody sets this expecting the 31st. */
const DAYS_PER_PERIOD: Record<ReminderPeriod, number> = { week: 7, month: 30 };

/** How many days one check-in cycle covers. Clamped to the 1..12 CHECK on reminder_every. */
export function checkinCadenceDays(every: number, period: ReminderPeriod): number {
  const n = Number.isFinite(every) ? Math.min(12, Math.max(1, Math.floor(every))) : 1;
  return n * (DAYS_PER_PERIOD[period] ?? 7);
}

/** A follow-up window in days, or null for 'none' — which means the coach wants no reminder at all
 *  and must not be quietly turned into a default. */
export function followUpDays(option: FollowUpOption): number | null {
  switch (option) {
    case 'three_days':
      return 3;
    case 'one_week':
      return 7;
    case 'two_weeks':
      return 14;
    case 'one_month':
      return 30;
    case 'three_months':
      return 90;
    case 'none':
    default:
      return null;
  }
}

/**
 * The weekday gate quantizes sending to whole weeks, so the cadence dedupe has to round to the
 * nearest week rather than demand the full interval.
 *
 * A coach who sets "every 1 month" fires on a weekday, so the reachable gaps are 28 or 35 days, not
 * 30. Requiring a full 30 pushes every monthly reminder out to 35, which is a five-week month. Half
 * a week of slack rounds to whichever is nearer: 28 for a 30-day cadence, 63 for a 60-day one.
 */
const GATE_SLACK_DAYS = 3.5;

export type CheckinDueInput = {
  /** When this member was last sent a check-in reminder, ms epoch, or null if never. */
  lastSentAt: number | null;
  /** When she last submitted THIS form, ms epoch, or null if never. */
  answeredAt: number | null;
  cadenceDays: number;
  skipWhenDone: boolean;
  skipDays: number;
  now: number;
};

/**
 * Should this member get a check-in reminder on this tick?
 *
 * Assumes the caller has already checked the on/off switch and the weekday + local-hour gate; this
 * is only the "has enough time passed, and has she already done it" half. Split out because those
 * two rules decide whether 256 women get a message they did not need, and neither is testable
 * against a database from a build container.
 */
export function isCheckinDue(input: CheckinDueInput): boolean {
  const { lastSentAt, answeredAt, cadenceDays, skipWhenDone, skipDays, now } = input;
  const ms = (days: number): number => days * 86_400_000;

  // Already reminded inside this cycle? Then this tick is the same cycle, not the next one.
  //
  // Enforced against what was SENT rather than a stored schedule, which is what makes the cadence
  // survive a missed cron run: the next hour it fires, the gap is still open and she gets it an
  // hour late instead of two weeks late.
  if (lastSentAt !== null && now - lastSentAt < ms(Math.max(0, cadenceDays - GATE_SLACK_DAYS))) {
    return false;
  }

  // "Skip the reminder if she has already completed it", the coach's own checkbox. OFF means she
  // wants it sent regardless — the cadence gate above is what stops that from becoming spam, and
  // reading OFF as "skip anyway, just on a different window" would make the switch do nothing.
  if (!skipWhenDone) return true;

  if (answeredAt === null) return true;
  return now - answeredAt >= ms(skipDays);
}

/** 'HH:MM' -> hour 0..23. Anything unparseable falls back to 18:00, the column default. */
export function reminderHourOf(timeLocal: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((timeLocal ?? '').trim());
  const h = m ? Number(m[1]) : NaN;
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : 18;
}

export const ONBOARDING_SEND_OPTIONS = ['after_offer', 'immediately', 'manually'] as const;
export type OnboardingSendWhen = (typeof ONBOARDING_SEND_OPTIONS)[number];

/** 0 = Sunday, matching JS getDay() and Postgres extract(dow). */
export const WEEKDAY_VALUES = [0, 1, 2, 3, 4, 5, 6] as const;

/** Presets offered for the free-text list fields, so the common answers are one tap, not typing. */
export const ALLERGY_SUGGESTIONS = [
  'peanuts',
  'treeNuts',
  'dairy',
  'eggs',
  'shellfish',
  'fish',
  'soy',
  'wheat',
  'sesame',
] as const;
export const DIET_SUGGESTIONS = [
  'vegetarian',
  'vegan',
  'pescatarian',
  'halal',
  'kosher',
  'glutenFree',
  'dairyFree',
  'lowCarb',
  'highProtein',
] as const;
export const AVAILABILITY_SUGGESTIONS = [
  'fullKitchen',
  'microwaveOnly',
  'noOven',
  'mealPrepSunday',
  'eatsOutOften',
  'travelsWeekly',
  'limitedBudget',
  'cooksForFamily',
] as const;

// ---------------------------------------------------------------------------------------------
// The settings themselves
// ---------------------------------------------------------------------------------------------

export type CoachSettings = {
  // Chat and communication
  isClientAudioAllowed: boolean;
  isClientVideoAllowed: boolean;
  isClientImageAllowed: boolean;
  isHabitSummaryShared: boolean;
  isUpsellShown: boolean;
  isGroupRosterShown: boolean;

  // Progress tracking
  isWeightShown: boolean;
  isMacrosShown: boolean;
  isWeightShownInCheckin: boolean;
  isCheckinAllowed: boolean;
  isCheckinReminderOn: boolean;
  reminderEvery: number;
  reminderPeriod: ReminderPeriod;
  reminderWeekday: number;
  reminderTimeLocal: string;
  isReminderSkippedWhenDone: boolean;
  reminderSkipDays: number;
  isReminderPushOn: boolean;
  isReminderChatOn: boolean;
  isReminderEmailOn: boolean;

  // Client access
  isAccessRevokedOnExpiry: boolean;

  // Meal plan settings
  defaultMealPlanName: string;
  recipeIngredientDisplay: IngredientDisplay;
  mealPlanFollowup: FollowUpOption;
  mealPlanFormat: MealPlanFormat;
  macroFlexibility: MacroFlexibility;
  allergies: string[];
  dietaryPreferences: string[];
  avoidedIngredients: string[];
  availability: string[];

  // Training plan settings
  defaultTrainingPlanName: string;
  trainingFollowup: FollowUpOption;
  dropsetBehavior: DropsetBehavior;
  isExerciseGuideShown: boolean;

  // Client handling and engagement
  measurementUnit: MeasurementUnit;
  oldChatDays: number;
  isBirthdayReminderOn: boolean;

  // Onboarding
  isOnboardingRequired: boolean;
  onboardingSendWhen: OnboardingSendWhen;

  // Email notifications to the coach
  isEmailOnNewMessage: boolean;
  isEmailOnNewCheckin: boolean;
  isEmailOnNewLead: boolean;
};

/**
 * What the app does before anyone touches a switch.
 *
 * These MUST equal the column defaults in 0115_coach_settings.sql. They are not a fallback for a
 * broken read so much as the answer for a company with no row yet, and the member-facing readers
 * (the check-in gate, the workout player, isEntitled) call through them on every request. Changing a
 * value here without changing the migration means a company created before the change and one created
 * after it behave differently, which is the hardest class of bug to see.
 */
export const DEFAULT_COACH_SETTINGS: CoachSettings = {
  isClientAudioAllowed: true,
  isClientVideoAllowed: true,
  isClientImageAllowed: true,
  isHabitSummaryShared: false,
  isUpsellShown: false,
  isGroupRosterShown: true,

  isWeightShown: true,
  isMacrosShown: true,
  isWeightShownInCheckin: true,
  isCheckinAllowed: true,
  isCheckinReminderOn: false,
  reminderEvery: 1,
  reminderPeriod: 'week',
  reminderWeekday: 1,
  reminderTimeLocal: '18:00',
  isReminderSkippedWhenDone: true,
  reminderSkipDays: 7,
  isReminderPushOn: true,
  isReminderChatOn: false,
  isReminderEmailOn: false,

  isAccessRevokedOnExpiry: true,

  defaultMealPlanName: '',
  recipeIngredientDisplay: 'grams_and_units',
  mealPlanFollowup: 'none',
  mealPlanFormat: 'macro',
  macroFlexibility: 'moderate',
  allergies: [],
  dietaryPreferences: [],
  avoidedIngredients: [],
  availability: [],

  defaultTrainingPlanName: '',
  trainingFollowup: 'none',
  dropsetBehavior: 'separate',
  isExerciseGuideShown: true,

  measurementUnit: 'imperial',
  oldChatDays: 3,
  isBirthdayReminderOn: false,

  isOnboardingRequired: true,
  onboardingSendWhen: 'after_offer',

  isEmailOnNewMessage: false,
  isEmailOnNewCheckin: false,
  isEmailOnNewLead: false,
};

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

/** One free-text list entry: trimmed, non-empty, short enough to render in a chip. */
const listEntry = z.string().trim().min(1).max(60);

const boundedList = (max: number): z.ZodType<string[]> =>
  z
    .array(listEntry)
    .max(max)
    // Case-insensitive dedupe. Two chips that read the same are a bug report, not a preference.
    .transform((values) => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const v of values) {
        const key = v.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(v);
      }
      return out;
    });

/**
 * The save payload. Every field is required: the form always sends the whole object, so a partial
 * body is a bug rather than a patch, and treating it as a patch would let a stale tab silently
 * re-apply values the coach already changed in another one.
 */
export const coachSettingsSchema = z.object({
  isClientAudioAllowed: z.boolean(),
  isClientVideoAllowed: z.boolean(),
  isClientImageAllowed: z.boolean(),
  isHabitSummaryShared: z.boolean(),
  isUpsellShown: z.boolean(),
  isGroupRosterShown: z.boolean(),

  isWeightShown: z.boolean(),
  isMacrosShown: z.boolean(),
  isWeightShownInCheckin: z.boolean(),
  isCheckinAllowed: z.boolean(),
  isCheckinReminderOn: z.boolean(),
  reminderEvery: z.number().int().min(1).max(12),
  reminderPeriod: z.enum(REMINDER_PERIOD_OPTIONS),
  reminderWeekday: z.number().int().min(0).max(6),
  reminderTimeLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  isReminderSkippedWhenDone: z.boolean(),
  reminderSkipDays: z.number().int().min(1).max(60),
  isReminderPushOn: z.boolean(),
  isReminderChatOn: z.boolean(),
  isReminderEmailOn: z.boolean(),

  isAccessRevokedOnExpiry: z.boolean(),

  defaultMealPlanName: z.string().trim().max(120),
  recipeIngredientDisplay: z.enum(INGREDIENT_DISPLAY_OPTIONS),
  mealPlanFollowup: z.enum(FOLLOW_UP_OPTIONS),
  mealPlanFormat: z.enum(MEAL_PLAN_FORMAT_OPTIONS),
  macroFlexibility: z.enum(MACRO_FLEXIBILITY_OPTIONS),
  allergies: boundedList(40),
  dietaryPreferences: boundedList(40),
  avoidedIngredients: boundedList(200),
  availability: boundedList(40),

  defaultTrainingPlanName: z.string().trim().max(120),
  trainingFollowup: z.enum(FOLLOW_UP_OPTIONS),
  dropsetBehavior: z.enum(DROPSET_OPTIONS),
  isExerciseGuideShown: z.boolean(),

  measurementUnit: z.enum(MEASUREMENT_UNIT_OPTIONS),
  oldChatDays: z.number().int().min(1).max(60),
  isBirthdayReminderOn: z.boolean(),

  isOnboardingRequired: z.boolean(),
  onboardingSendWhen: z.enum(ONBOARDING_SEND_OPTIONS),

  isEmailOnNewMessage: z.boolean(),
  isEmailOnNewCheckin: z.boolean(),
  isEmailOnNewLead: z.boolean(),
});

export type CoachSettingsInput = z.infer<typeof coachSettingsSchema>;

// ---------------------------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------------------------

/** The snake_case row as it comes back from Postgres. Partial: a column added later must not throw. */
export type CoachSettingsRow = Record<string, unknown>;

function bool(row: CoachSettingsRow, key: string, fallback: boolean): boolean {
  const v = row[key];
  return typeof v === 'boolean' ? v : fallback;
}
function num(row: CoachSettingsRow, key: string, fallback: number): number {
  const v = row[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function str<T extends string>(row: CoachSettingsRow, key: string, fallback: T, allowed?: readonly T[]): T {
  const v = row[key];
  if (typeof v !== 'string') return fallback;
  if (allowed && !allowed.includes(v as T)) return fallback;
  return v as T;
}
function list(row: CoachSettingsRow, key: string): string[] {
  const v = row[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * Fold a database row into the settings object, falling back per FIELD rather than per ROW.
 *
 * Per-field matters: a single unexpected value (an enum written by hand in the SQL editor, a column
 * that exists in the database but not yet in this file) would otherwise discard every other saved
 * preference and quietly reset the whole screen to defaults.
 */
export function coachSettingsFromRow(row: CoachSettingsRow | null): CoachSettings {
  if (!row) return { ...DEFAULT_COACH_SETTINGS };
  const d = DEFAULT_COACH_SETTINGS;
  return {
    isClientAudioAllowed: bool(row, 'is_client_audio_allowed', d.isClientAudioAllowed),
    isClientVideoAllowed: bool(row, 'is_client_video_allowed', d.isClientVideoAllowed),
    isClientImageAllowed: bool(row, 'is_client_image_allowed', d.isClientImageAllowed),
    isHabitSummaryShared: bool(row, 'is_habit_summary_shared', d.isHabitSummaryShared),
    isUpsellShown: bool(row, 'is_upsell_shown', d.isUpsellShown),
    isGroupRosterShown: bool(row, 'is_group_roster_shown', d.isGroupRosterShown),

    isWeightShown: bool(row, 'is_weight_shown', d.isWeightShown),
    isMacrosShown: bool(row, 'is_macros_shown', d.isMacrosShown),
    isWeightShownInCheckin: bool(row, 'is_weight_shown_in_checkin', d.isWeightShownInCheckin),
    isCheckinAllowed: bool(row, 'is_checkin_allowed', d.isCheckinAllowed),
    isCheckinReminderOn: bool(row, 'is_checkin_reminder_on', d.isCheckinReminderOn),
    reminderEvery: num(row, 'reminder_every', d.reminderEvery),
    reminderPeriod: str(row, 'reminder_period', d.reminderPeriod, REMINDER_PERIOD_OPTIONS),
    reminderWeekday: num(row, 'reminder_weekday', d.reminderWeekday),
    reminderTimeLocal: str(row, 'reminder_time_local', d.reminderTimeLocal),
    isReminderSkippedWhenDone: bool(row, 'is_reminder_skipped_when_done', d.isReminderSkippedWhenDone),
    reminderSkipDays: num(row, 'reminder_skip_days', d.reminderSkipDays),
    isReminderPushOn: bool(row, 'is_reminder_push_on', d.isReminderPushOn),
    isReminderChatOn: bool(row, 'is_reminder_chat_on', d.isReminderChatOn),
    isReminderEmailOn: bool(row, 'is_reminder_email_on', d.isReminderEmailOn),

    isAccessRevokedOnExpiry: bool(row, 'is_access_revoked_on_expiry', d.isAccessRevokedOnExpiry),

    defaultMealPlanName: str(row, 'default_meal_plan_name', d.defaultMealPlanName),
    recipeIngredientDisplay: str(row, 'recipe_ingredient_display', d.recipeIngredientDisplay, INGREDIENT_DISPLAY_OPTIONS),
    mealPlanFollowup: str(row, 'meal_plan_followup', d.mealPlanFollowup, FOLLOW_UP_OPTIONS),
    mealPlanFormat: str(row, 'meal_plan_format', d.mealPlanFormat, MEAL_PLAN_FORMAT_OPTIONS),
    macroFlexibility: str(row, 'macro_flexibility', d.macroFlexibility, MACRO_FLEXIBILITY_OPTIONS),
    allergies: list(row, 'allergies'),
    dietaryPreferences: list(row, 'dietary_preferences'),
    avoidedIngredients: list(row, 'avoided_ingredients'),
    availability: list(row, 'availability'),

    defaultTrainingPlanName: str(row, 'default_training_plan_name', d.defaultTrainingPlanName),
    trainingFollowup: str(row, 'training_followup', d.trainingFollowup, FOLLOW_UP_OPTIONS),
    dropsetBehavior: str(row, 'dropset_behavior', d.dropsetBehavior, DROPSET_OPTIONS),
    isExerciseGuideShown: bool(row, 'is_exercise_guide_shown', d.isExerciseGuideShown),

    measurementUnit: str(row, 'measurement_unit', d.measurementUnit, MEASUREMENT_UNIT_OPTIONS),
    oldChatDays: num(row, 'old_chat_days', d.oldChatDays),
    isBirthdayReminderOn: bool(row, 'is_birthday_reminder_on', d.isBirthdayReminderOn),

    isOnboardingRequired: bool(row, 'is_onboarding_required', d.isOnboardingRequired),
    onboardingSendWhen: str(row, 'onboarding_send_when', d.onboardingSendWhen, ONBOARDING_SEND_OPTIONS),

    isEmailOnNewMessage: bool(row, 'is_email_on_new_message', d.isEmailOnNewMessage),
    isEmailOnNewCheckin: bool(row, 'is_email_on_new_checkin', d.isEmailOnNewCheckin),
    isEmailOnNewLead: bool(row, 'is_email_on_new_lead', d.isEmailOnNewLead),
  };
}

/** The inverse: the settings object as the snake_case columns the table expects. */
export function coachSettingsToRow(s: CoachSettingsInput): Record<string, unknown> {
  return {
    is_client_audio_allowed: s.isClientAudioAllowed,
    is_client_video_allowed: s.isClientVideoAllowed,
    is_client_image_allowed: s.isClientImageAllowed,
    is_habit_summary_shared: s.isHabitSummaryShared,
    is_upsell_shown: s.isUpsellShown,
    is_group_roster_shown: s.isGroupRosterShown,

    is_weight_shown: s.isWeightShown,
    is_macros_shown: s.isMacrosShown,
    is_weight_shown_in_checkin: s.isWeightShownInCheckin,
    is_checkin_allowed: s.isCheckinAllowed,
    is_checkin_reminder_on: s.isCheckinReminderOn,
    reminder_every: s.reminderEvery,
    reminder_period: s.reminderPeriod,
    reminder_weekday: s.reminderWeekday,
    reminder_time_local: s.reminderTimeLocal,
    is_reminder_skipped_when_done: s.isReminderSkippedWhenDone,
    reminder_skip_days: s.reminderSkipDays,
    is_reminder_push_on: s.isReminderPushOn,
    is_reminder_chat_on: s.isReminderChatOn,
    is_reminder_email_on: s.isReminderEmailOn,

    is_access_revoked_on_expiry: s.isAccessRevokedOnExpiry,

    default_meal_plan_name: s.defaultMealPlanName,
    recipe_ingredient_display: s.recipeIngredientDisplay,
    meal_plan_followup: s.mealPlanFollowup,
    meal_plan_format: s.mealPlanFormat,
    macro_flexibility: s.macroFlexibility,
    allergies: s.allergies,
    dietary_preferences: s.dietaryPreferences,
    avoided_ingredients: s.avoidedIngredients,
    availability: s.availability,

    default_training_plan_name: s.defaultTrainingPlanName,
    training_followup: s.trainingFollowup,
    dropset_behavior: s.dropsetBehavior,
    is_exercise_guide_shown: s.isExerciseGuideShown,

    measurement_unit: s.measurementUnit,
    old_chat_days: s.oldChatDays,
    is_birthday_reminder_on: s.isBirthdayReminderOn,

    is_onboarding_required: s.isOnboardingRequired,
    onboarding_send_when: s.onboardingSendWhen,

    is_email_on_new_message: s.isEmailOnNewMessage,
    is_email_on_new_checkin: s.isEmailOnNewCheckin,
    is_email_on_new_lead: s.isEmailOnNewLead,
  };
}
