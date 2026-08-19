// Notification-preference constants + pure helpers. Kept OUT of the 'use server' actions file
// (where every export must be an async server action) so synchronous helpers and types can be
// imported by both client components and other server modules.

// Free-text in the DB (no CHECK), but the app constrains to this set.
export const NOTIFICATION_CATEGORIES = ['community', 'coach', 'reminders', 'billing'] as const;
export const NOTIFICATION_CHANNELS = ['push', 'email'] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export type NotificationPrefMap = Record<
  NotificationCategory,
  Record<NotificationChannel, boolean>
>;

// A category/channel pair the user can never disable (transactional + legal): billing notices
// and every email are always delivered.
export function isLockedOn(
  category: NotificationCategory,
  channel: NotificationChannel,
): boolean {
  return category === 'billing' || channel === 'email';
}

// Map a delivered notification's type onto a preference category. Anything unmapped is treated as
// `coach` (a direct, expected message) so we never accidentally suppress an important notice.
export function categoryForNotificationType(type: string): NotificationCategory {
  switch (type) {
    case 'community_broadcast':
    case 'community_reply':
    case 'challenge_started':
    case 'challenge_won':
    case 'challenge_ended':
      return 'community';
    case 'streak':
    case 'checkin':
    case 'plateau':
    case 'reminder':
    case 'onboarding_nudge':
    // A win-back message is a reminder, not a coach message. Filing it under 'coach' would make it
    // undismissable-by-preference, and pushing a woman who has muted reminders and stopped opening
    // the app is the exact behaviour that turns a lapse into an uninstall.
    case 'reengage_7':
    case 'reengage_14':
    case 'reengage_28':
    // Tenure milestones sit beside the win-back messages for the same reason: warm, automated, and
    // hers to switch off. A woman who has muted reminders has told us she does not want the app
    // congratulating her, and that answer has to hold for the nice messages too or it means nothing.
    case 'lifecycle_7':
    case 'lifecycle_14':
    case 'lifecycle_30':
    case 'lifecycle_45':
    case 'lifecycle_90':
    // A seasonal campaign is marketing in a coaching voice, and it is the one a member is most
    // likely to want switched off. Filing it under 'reminders' — mutable, like the other two
    // automated senders — rather than 'coach', which no preference can silence.
    case 'seasonal':
      return 'reminders';
    case 'renewal':
    case 'comp_expiring':
      return 'billing';
    case 'coach_message':
    case 'program_assigned':
    case 'habit_assigned':
    case 'meal_plan_assigned':
    case 'form_assigned':
    // A coach-facing work reminder. 'coach' rather than 'reminders' on purpose: this is the queue
    // that keeps a paying client from training week 13 of a finished plan, and it should not be
    // silenced by a member-facing preference toggle.
    case 'plan_expiring':
    case 'system':
    default:
      return 'coach';
  }
}
