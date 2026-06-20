// Shared community types. Used by both the server read layer and the client feed UI.

export const REACTION_EMOJIS = ['fire', 'muscle', 'heart', 'clap', 'star'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

// Display glyphs for each reaction key (keys stay ascii-safe in the DB and i18n).
export const REACTION_GLYPHS: Record<ReactionEmoji, string> = {
  fire: '\u{1F525}',
  muscle: '\u{1F4AA}',
  heart: '❤️',
  clap: '\u{1F44F}',
  star: '⭐',
};

export type FeedAuthor = {
  id: string;
  name: string;
  initials: string;
  isCoach: boolean;
};

export type FeedReaction = {
  emoji: ReactionEmoji;
  count: number;
  reacted: boolean; // did the current viewer react with this emoji
};

export type FeedPost = {
  id: string;
  author: FeedAuthor;
  body: string;
  mediaUrl: string | null;
  isBroadcast: boolean;
  createdAt: string;
  reactions: FeedReaction[];
  commentCount: number;
};

export type FeedComment = {
  id: string;
  author: FeedAuthor;
  body: string;
  createdAt: string;
};

export type LeaderRow = {
  profileId: string;
  name: string;
  initials: string;
  progress: number;
  isViewer: boolean;
};

export type ActiveChallenge = {
  id: string;
  title: string;
  description: string | null;
  metric: string;
  metricUnit: string | null;
  goal: number | null;
  startsOn: string;
  endsOn: string;
  daysLeft: number;
  participantCount: number;
  joined: boolean;
  viewerProgress: number;
  leaders: LeaderRow[];
};

export type CommunityData = {
  broadcast: FeedPost | null;
  posts: FeedPost[];
  challenge: ActiveChallenge | null;
};
