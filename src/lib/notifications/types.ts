// Notification layer shared types. Kept free of server-only imports so client components
// (the bell, the list) can import them too.

export type NotificationType =
  | 'community_broadcast'
  | 'community_reply'
  | 'system'
  | 'streak'
  | 'checkin'
  | 'coach_message';

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
