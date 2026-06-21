// Gamification shared types. No server-only imports so client components (the You-screen
// streak ring + badge grid) can import them.

export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastActiveOn: string | null; // YYYY-MM-DD
  freezeTokens: number;
};

export type BadgeKind = 'workout' | 'logging' | 'streak' | 'weight' | 'misc';

export type Badge = {
  id: string;
  key: string;
  nameEn: string;
  nameEs: string;
  descriptionEn: string;
  descriptionEs: string;
  icon: string;
  threshold: number;
  kind: BadgeKind;
  sortOrder: number;
};

// A badge in the grid, flagged earned/locked for the current member.
export type BadgeStatus = Badge & {
  earned: boolean;
  earnedAt: string | null; // ISO timestamp
};

// The full gamification snapshot the You screen renders.
export type GamificationSnapshot = {
  streak: StreakState;
  badges: BadgeStatus[];
  earnedCount: number;
  totalCount: number;
};
