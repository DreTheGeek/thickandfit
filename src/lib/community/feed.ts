// Community read layer (server). All reads go through the RLS session client, which scopes every
// row to the viewer's company. We hydrate authors, aggregate reactions, and compute the active
// challenge leaderboard. The feed is fast: posts + a handful of bulk lookups, no N+1.
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { COACH_ROLES } from '@/lib/auth/session';
import {
  REACTION_EMOJIS,
  type ActiveChallenge,
  type CommunityData,
  type FeedAuthor,
  type FeedComment,
  type FeedPost,
  type FeedReaction,
  type LeaderRow,
  type ReactionEmoji,
} from '@/lib/community/types';

const FEED_LIMIT = 40;
const LEADER_LIMIT = 5;

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type ProfileRow = { id: string; full_name: string | null; role: string };

async function loadAuthors(ids: string[]): Promise<Map<string, FeedAuthor>> {
  const map = new Map<string, FeedAuthor>();
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return map;
  // Author display names are non-sensitive, but profiles SELECT is now owner-or-coach (RLS), so a
  // subscriber cannot read other members' rows via their session client. Hydrate via the service
  // client: the post ids are already company-scoped by the feed's RLS read above.
  const { data } = await createServiceClient().from('profiles').select('id, full_name, role').in('id', unique);
  for (const p of (data ?? []) as ProfileRow[]) {
    const name = p.full_name?.trim() || 'Member';
    map.set(p.id, {
      id: p.id,
      name,
      initials: initialsFor(name),
      isCoach: COACH_ROLES.includes(p.role as (typeof COACH_ROLES)[number]),
    });
  }
  return map;
}

function fallbackAuthor(id: string): FeedAuthor {
  return { id, name: 'Member', initials: 'M', isCoach: false };
}

type PostRow = {
  id: string;
  author_profile_id: string;
  body: string;
  media_url: string | null;
  is_broadcast: boolean;
  created_at: string;
};

/** Profile ids this viewer has blocked. Enforcement for guideline 1.2 lives on the READ path so the
 *  blocked member's content stays intact for moderation evidence and visible to everyone else.
 *  Returns an empty set on error: a failed block lookup must not blank the whole feed. */
async function blockedIdsFor(viewerId: string): Promise<Set<string>> {
  const sb = await createClient();
  const { data, error } = await sb
    .from('community_blocks')
    .select('blocked_profile_id')
    .eq('blocker_profile_id', viewerId);
  if (error) {
    console.error('blockedIdsFor:', error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => (r as { blocked_profile_id: string }).blocked_profile_id));
}

export async function getCommunity(viewerId: string): Promise<CommunityData> {
  const sb = await createClient();

  const [{ data: postRows, error }, blocked] = await Promise.all([
    sb
      .from('community_posts')
      .select('id, author_profile_id, body, media_url, is_broadcast, created_at')
      .order('created_at', { ascending: false })
      .limit(FEED_LIMIT),
    blockedIdsFor(viewerId),
  ]);
  if (error) throw new Error(`getCommunity posts: ${error.message}`);
  // Drop blocked authors before anything else, so their posts never reach reaction/comment hydration.
  const posts = ((postRows ?? []) as PostRow[]).filter((p) => !blocked.has(p.author_profile_id));
  const postIds = posts.map((p) => p.id);

  // Bulk reactions + comment counts so the feed stays O(1) round-trips.
  const reactionsByPost = new Map<string, Map<ReactionEmoji, { count: number; reacted: boolean }>>();
  const commentCountByPost = new Map<string, number>();

  if (postIds.length > 0) {
    const { data: reactionRows } = await sb
      .from('post_reactions')
      .select('post_id, profile_id, emoji')
      .in('post_id', postIds);
    for (const r of (reactionRows ?? []) as { post_id: string; profile_id: string; emoji: string }[]) {
      const emoji = r.emoji as ReactionEmoji;
      if (!REACTION_EMOJIS.includes(emoji)) continue;
      let bucket = reactionsByPost.get(r.post_id);
      if (!bucket) {
        bucket = new Map();
        reactionsByPost.set(r.post_id, bucket);
      }
      const cur = bucket.get(emoji) ?? { count: 0, reacted: false };
      cur.count += 1;
      if (r.profile_id === viewerId) cur.reacted = true;
      bucket.set(emoji, cur);
    }

    const { data: commentRows } = await sb.from('post_comments').select('post_id').in('post_id', postIds);
    for (const c of (commentRows ?? []) as { post_id: string }[]) {
      commentCountByPost.set(c.post_id, (commentCountByPost.get(c.post_id) ?? 0) + 1);
    }
  }

  const authors = await loadAuthors(posts.map((p) => p.author_profile_id));

  function toFeedPost(p: PostRow): FeedPost {
    const bucket = reactionsByPost.get(p.id);
    const reactions: FeedReaction[] = REACTION_EMOJIS.map((emoji) => {
      const agg = bucket?.get(emoji);
      return { emoji, count: agg?.count ?? 0, reacted: agg?.reacted ?? false };
    });
    return {
      id: p.id,
      author: authors.get(p.author_profile_id) ?? fallbackAuthor(p.author_profile_id),
      body: p.body,
      mediaUrl: p.media_url,
      isBroadcast: p.is_broadcast,
      createdAt: p.created_at,
      reactions,
      commentCount: commentCountByPost.get(p.id) ?? 0,
    };
  }

  // The newest coach broadcast is highlighted above the feed; it is not duplicated in the list.
  const broadcastRow = posts.find((p) => p.is_broadcast) ?? null;
  const broadcast = broadcastRow ? toFeedPost(broadcastRow) : null;
  const feed = posts.filter((p) => !broadcast || p.id !== broadcast.id).map(toFeedPost);

  const challenge = await getActiveChallenge(sb, viewerId);

  return { broadcast, posts: feed, challenge };
}

type ChallengeRow = {
  id: string;
  title: string;
  description: string | null;
  metric: string;
  metric_unit: string | null;
  goal: number | null;
  starts_on: string;
  ends_on: string;
};

async function getActiveChallenge(
  sb: Awaited<ReturnType<typeof createClient>>,
  viewerId: string,
): Promise<ActiveChallenge | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await sb
    .from('challenges')
    .select('id, title, description, metric, metric_unit, goal, starts_on, ends_on')
    .lte('starts_on', today)
    .gte('ends_on', today)
    .order('ends_on', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const c = data as ChallengeRow;

  const { data: partRows } = await sb
    .from('challenge_participants')
    .select('profile_id, progress')
    .eq('challenge_id', c.id)
    .order('progress', { ascending: false });
  const participants = (partRows ?? []) as { profile_id: string; progress: number }[];

  const authors = await loadAuthors(participants.map((p) => p.profile_id));
  const leaders: LeaderRow[] = participants.slice(0, LEADER_LIMIT).map((p) => {
    const a = authors.get(p.profile_id) ?? fallbackAuthor(p.profile_id);
    return {
      profileId: p.profile_id,
      name: a.name,
      initials: a.initials,
      progress: Number(p.progress),
      isViewer: p.profile_id === viewerId,
    };
  });
  const mine = participants.find((p) => p.profile_id === viewerId) ?? null;

  const msLeft = new Date(c.ends_on).getTime() - new Date(today).getTime();
  const daysLeft = Math.max(0, Math.round(msLeft / 86_400_000));

  return {
    id: c.id,
    title: c.title,
    description: c.description,
    metric: c.metric,
    metricUnit: c.metric_unit,
    goal: c.goal != null ? Number(c.goal) : null,
    startsOn: c.starts_on,
    endsOn: c.ends_on,
    daysLeft,
    participantCount: participants.length,
    joined: mine != null,
    viewerProgress: mine ? Number(mine.progress) : 0,
    leaders,
  };
}

export async function getComments(postId: string, viewerId?: string): Promise<FeedComment[]> {
  const sb = await createClient();
  const { data } = await sb
    .from('post_comments')
    .select('id, profile_id, body, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  let rows = (data ?? []) as { id: string; profile_id: string; body: string; created_at: string }[];
  // Blocking has to reach comments too, or a blocked member simply moves to the reply thread.
  if (viewerId) {
    const blocked = await blockedIdsFor(viewerId);
    rows = rows.filter((r) => !blocked.has(r.profile_id));
  }
  const authors = await loadAuthors(rows.map((r) => r.profile_id));
  return rows.map((r) => ({
    id: r.id,
    author: authors.get(r.profile_id) ?? fallbackAuthor(r.profile_id),
    body: r.body,
    createdAt: r.created_at,
  }));
}
