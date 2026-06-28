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
      return 'community';
    case 'streak':
    case 'checkin':
    case 'plateau':
    case 'reminder':
      return 'reminders';
    case 'renewal':
    case 'comp_expiring':
      return 'billing';
    case 'coach_message':
    case 'system':
    default:
      return 'coach';
  }
}
