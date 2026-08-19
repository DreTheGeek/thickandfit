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
  | 'form_assigned'
  | 'onboarding_nudge'
  // The three rungs of the re-engagement ladder. Distinct types rather than one 'reengage' with a
  // stage in the body: the dedupe asks "has THIS rung been sent since she was last active", and a
  // single type would make rung 14 suppress rung 28.
  | 'reengage_7'
  | 'reengage_14'
  | 'reengage_28'
  // Addressed at the COACH, not a member: a plan reaching the end of its weeks. The first
  // coach-facing notification in the app, and it needed no schema change because notifications are
  // profile-keyed and coaches have profiles.
  | 'plan_expiring'
  // Tenure milestones: day 7, 14, 30, 45, 90. Distinct types for the same reason the ladder's are,
  // and here the dedupe is "ever" rather than "since an anchor" — nobody reaches day 30 twice.
  | 'lifecycle_7'
  | 'lifecycle_14'
  | 'lifecycle_30'
  | 'lifecycle_45'
  | 'lifecycle_90'
  // A dated campaign written by the coach, not a message this codebase authors. One type for all of
  // them: the campaign key and its run year ride the link, which is what the dedupe matches on.
  | 'seasonal';

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
