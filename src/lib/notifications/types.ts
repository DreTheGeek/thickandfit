// Notification layer shared types. Kept free of server-only imports so client components
// (the bell, the list) can import them too.

export type NotificationType =
  | 'community_broadcast'
  | 'community_reply'
  | 'system'
  | 'streak'
  | 'checkin'
  | 'plateau'
  | 'coach_message'
  | 'renewal'
  | 'comp_expiring'
  | 'reminder'
  | 'challenge_won'
  | 'challenge_ended'
  | 'challenge_started'
  | 'program_assigned'
  | 'habit_assigned'
  | 'meal_plan_assigned'
  | 'form_assigned';

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPayload = {
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
};
