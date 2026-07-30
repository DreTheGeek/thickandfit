'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { COACH_ROLES } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getComments } from '@/lib/community/feed';
import { REACTION_EMOJIS, type FeedComment } from '@/lib/community/types';
import { notifyBroadcast, notifyMember } from '@/lib/notifications/triggers';
import { classifyContent, blockMessageKey } from '@/lib/community/content-filter';

export type CommunityResult = { ok: boolean; error?: string };

// Raise a moderation report on the app's own behalf. Used when the content filter FLAGS rather than
// blocks (self-harm), so a human reaches the member fast without the post being deleted first.
// reporter_profile_id stays null: this was the system, not a member, and the queue shows it as such.
// Best-effort by design; a reporting failure must never undo a member's post.
async function autoReportPost(
  companyId: string,
  postId: string,
  authorProfileId: string,
  reason: 'self_harm',
): Promise<void> {
  try {
    const svc = createServiceClient();
    const { error } = await svc.from('community_reports').insert({
      company_id: companyId,
      post_id: postId,
      reporter_profile_id: null,
      reported_profile_id: authorProfileId,
      reason,
      note: 'Raised automatically by the content filter.',
    });
    if (error) console.error('autoReportPost:', error.message);
  } catch (e) {
    console.error('autoReportPost:', e instanceof Error ? e.message : e);
  }
}

const PostInput = z
  .object({
    body: z.string().trim().max(2000),
    mediaUrl: z.string().trim().url().max(2000).nullable().optional(),
    isBroadcast: z.boolean().optional(),
  })
  // A post needs SOMETHING: text or an image. Photo-only posts (empty body + media) are valid.
  .refine((v) => v.body.length > 0 || (v.mediaUrl != null && v.mediaUrl.length > 0), {
    message: 'empty',
  });

export async function createPostAction(input: unknown): Promise<CommunityResult> {
  const parsed = PostInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  // A broadcast can only be raised by a coach; subscribers always post as a normal member.
  const isCoach = COACH_ROLES.includes(ctx.role);
  const isBroadcast = Boolean(parsed.data.isBroadcast) && isCoach;

  // Objectionable-content filter (App Store guideline 1.2). Runs BEFORE the write so blocked content
  // never reaches the feed. A self-harm 'flag' still writes, then raises a report for a human.
  const verdict = classifyContent(parsed.data.body);
  if (verdict.action === 'block') {
    return { ok: false, error: blockMessageKey(verdict.reason) };
  }

  const sb = await createClient();
  const { data: inserted, error } = await sb
    .from('community_posts')
    .insert({
      company_id: ctx.companyId,
      author_profile_id: ctx.userId,
      body: parsed.data.body,
      media_url: parsed.data.mediaUrl ?? null,
      is_broadcast: isBroadcast,
    })
    .select('id')
    .single();
  if (error) {
    console.error('createPostAction:', error.message);
    return { ok: false, error: 'insert_failed' };
  }

  // Self-harm language: the post stays up (deleting a member's cry for help is the wrong response)
  // and an open report puts it at the top of the moderation queue so a coach reaches them fast.
  if (verdict.action === 'flag' && inserted?.id) {
    void autoReportPost(ctx.companyId, inserted.id, ctx.userId, verdict.reason);
  }

  // Real trigger: a coach broadcast notifies every other member (in-app + best-effort push).
  // Fire-and-forget so posting never blocks on the fan-out.
  if (isBroadcast) {
    const { data: author } = await sb
      .from('profiles')
      .select('full_name')
      .eq('id', ctx.userId)
      .maybeSingle();
    const authorName = (author as { full_name: string | null } | null)?.full_name ?? 'Your coach';
    // Broadcast fan-out (in-app + push to every member) must survive the frozen lambda: after().
    // Capture the narrowed companyId: control-flow narrowing does not propagate into the closure.
    const companyId = ctx.companyId;
    const authorProfileId = ctx.userId;
    const broadcast = (): Promise<void> =>
      notifyBroadcast({
        companyId,
        authorProfileId,
        authorName,
      }).then(undefined, (e: unknown) =>
        console.error('createPostAction notifyBroadcast:', e instanceof Error ? e.message : e),
      );
    try {
      after(broadcast);
    } catch {
      void broadcast();
    }
  }

  revalidatePath('/community');
  return { ok: true };
}

// Delete a post: authorization lives in RLS (community_posts_delete allows the author OR a coach),
// so the delete runs through the RLS-bound client and a non-owner simply deletes zero rows.
// Comments and reactions cascade at the DB. The attached image is removed after the row delete
// succeeds, via after() so the cleanup survives the frozen lambda and never blocks the response.
export async function deletePostAction(postId: unknown): Promise<CommunityResult> {
  const parsed = z.string().uuid().safeParse(postId);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const sb = await createClient();

  const { data: post } = await sb
    .from('community_posts')
    .select('id, media_url')
    .eq('id', parsed.data)
    .maybeSingle();
  if (!post) return { ok: false, error: 'not_found' };

  const { error, count } = await sb
    .from('community_posts')
    .delete({ count: 'exact' })
    .eq('id', parsed.data);
  if (error) {
    console.error('deletePostAction:', error.message);
    return { ok: false, error: 'delete_failed' };
  }
  if (!count) return { ok: false, error: 'not_allowed' }; // RLS filtered it: not the author, not a coach

  const mediaUrl = (post as { media_url: string | null }).media_url;
  const marker = '/community-media/';
  const idx = mediaUrl ? mediaUrl.indexOf(marker) : -1;
  if (mediaUrl && idx !== -1) {
    const path = decodeURIComponent(mediaUrl.slice(idx + marker.length));
    after(async () => {
      const { error: rmErr } = await createServiceClient().storage.from('community-media').remove([path]);
      if (rmErr) console.error('deletePostAction media cleanup:', rmErr.message);
    });
  }

  revalidatePath('/community');
  return { ok: true };
}

const ReactInput = z.object({
  postId: z.string().uuid(),
  emoji: z.enum(REACTION_EMOJIS),
});

// Toggle: if the viewer already reacted with this emoji, remove it; otherwise add it.
export async function toggleReactionAction(input: unknown): Promise<CommunityResult> {
  const parsed = ReactInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const sb = await createClient();

  const { data: existing } = await sb
    .from('post_reactions')
    .select('id')
    .eq('post_id', parsed.data.postId)
    .eq('profile_id', ctx.userId)
    .eq('emoji', parsed.data.emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await sb.from('post_reactions').delete().eq('id', (existing as { id: string }).id);
    if (error) {
      console.error('toggleReactionAction delete:', error.message);
      return { ok: false, error: 'delete_failed' };
    }
  } else {
    const { error } = await sb.from('post_reactions').insert({
      post_id: parsed.data.postId,
      profile_id: ctx.userId,
      company_id: ctx.companyId,
      emoji: parsed.data.emoji,
    });
    if (error) {
      console.error('toggleReactionAction insert:', error.message);
      return { ok: false, error: 'insert_failed' };
    }
  }
  revalidatePath('/community');
  return { ok: true };
}

const CommentInput = z.object({
  postId: z.string().uuid(),
  body: z.string().trim().min(1).max(1000),
});

export async function addCommentAction(input: unknown): Promise<CommunityResult> {
  const parsed = CommentInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  // Same filter as posts: comments are the higher-volume abuse surface, so gating only posts would
  // leave the actual problem open.
  const verdict = classifyContent(parsed.data.body);
  if (verdict.action === 'block') {
    return { ok: false, error: blockMessageKey(verdict.reason) };
  }

  const sb = await createClient();
  const { error } = await sb.from('post_comments').insert({
    post_id: parsed.data.postId,
    profile_id: ctx.userId,
    company_id: ctx.companyId,
    body: parsed.data.body,
  });
  if (error) {
    console.error('addCommentAction:', error.message);
    return { ok: false, error: 'insert_failed' };
  }
  // A self-harm comment flags the PARENT post so the whole thread lands in the queue together.
  if (verdict.action === 'flag') {
    void autoReportPost(ctx.companyId, parsed.data.postId, ctx.userId, verdict.reason);
  }
  // Notify the post's author that someone commented (unless they commented on their own post).
  // after() survives the frozen lambda; failures never block the comment.
  const companyId = ctx.companyId;
  const commenterId = ctx.userId;
  const notifyAuthor = async (): Promise<void> => {
    const svc = createServiceClient();
    const { data: post } = await svc
      .from('community_posts')
      .select('author_profile_id')
      .eq('id', parsed.data.postId)
      .maybeSingle();
    const authorId = (post as { author_profile_id: string | null } | null)?.author_profile_id ?? null;
    if (!authorId || authorId === commenterId) return;
    const { data: me } = await svc.from('profiles').select('full_name').eq('id', commenterId).maybeSingle();
    const name = ((me as { full_name: string | null } | null)?.full_name || 'A member').trim();
    await notifyMember({
      companyId,
      profileId: authorId,
      type: 'community_reply',
      titleKey: 'commentTitle',
      bodyKey: 'commentBody',
      bodyVars: { name },
      link: '/community',
    });
  };
  try {
    after(notifyAuthor);
  } catch {
    void notifyAuthor();
  }
  revalidatePath('/community');
  return { ok: true };
}

export async function fetchCommentsAction(postId: unknown): Promise<FeedComment[]> {
  const parsed = z.string().uuid().safeParse(postId);
  if (!parsed.success) return [];
  // Pass the viewer so a blocked member's comments are hidden here too. Without this, blocking a
  // member removes them from the feed but they reappear the moment a thread is expanded.
  const ctx = await requireAuth();
  return getComments(parsed.data, ctx.userId);
}

export async function joinChallengeAction(challengeId: unknown): Promise<CommunityResult> {
  const parsed = z.string().uuid().safeParse(challengeId);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const sb = await createClient();

  // Idempotent join: unique (challenge_id, profile_id) makes a duplicate a no-op upsert.
  const { error } = await sb.from('challenge_participants').upsert(
    {
      challenge_id: parsed.data,
      profile_id: ctx.userId,
      company_id: ctx.companyId,
    },
    { onConflict: 'challenge_id,profile_id', ignoreDuplicates: true },
  );
  if (error) {
    console.error('joinChallengeAction:', error.message);
    return { ok: false, error: 'join_failed' };
  }
  revalidatePath('/community');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Member blocking (App Store guideline 1.2). One-way and silent: the blocked
// member is never notified, because telling someone they were blocked is itself
// a harassment vector. Enforcement is on the READ path (feed.ts), so nothing is
// deleted and the content survives for moderation evidence.
// ---------------------------------------------------------------------------

/** Hide every post and comment by `profileId` from the current member's feed. Idempotent. */
export async function blockMemberAction(profileId: unknown): Promise<CommunityResult> {
  const parsed = z.string().uuid().safeParse(profileId);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  if (parsed.data === ctx.userId) return { ok: false, error: 'self' };

  const sb = await createClient();
  // upsert, not insert: tapping Block twice must not 409 at the unique index.
  const { error } = await sb.from('community_blocks').upsert(
    {
      company_id: ctx.companyId,
      blocker_profile_id: ctx.userId,
      blocked_profile_id: parsed.data,
    },
    { onConflict: 'company_id,blocker_profile_id,blocked_profile_id' },
  );
  if (error) {
    console.error('blockMemberAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  revalidatePath('/community');
  return { ok: true };
}

/** Reverse a block. */
export async function unblockMemberAction(profileId: unknown): Promise<CommunityResult> {
  const parsed = z.string().uuid().safeParse(profileId);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();

  const sb = await createClient();
  // RLS restricts the delete to the caller's own rows, so no extra ownership check is needed here.
  const { error } = await sb
    .from('community_blocks')
    .delete()
    .eq('blocker_profile_id', ctx.userId)
    .eq('blocked_profile_id', parsed.data);
  if (error) {
    console.error('unblockMemberAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  revalidatePath('/community');
  return { ok: true };
}

/**
 * Member-facing report. The moderation TABLE and the operator queue at /admin/community/reports
 * already existed, but nothing let a member actually file one, so guideline 1.2's "report mechanism"
 * was only half built.
 *
 * Idempotent per reporter via the unique index in 0093, so a double-tap does not inflate the queue.
 * reported_profile_id is denormalized from the post's author at insert time so the report still names
 * who was reported even if the post is later deleted.
 */
export async function reportPostAction(input: unknown): Promise<CommunityResult> {
  const parsed = z
    .object({
      postId: z.string().uuid(),
      reason: z.enum(['spam', 'harassment', 'self_harm', 'nudity', 'misinformation', 'other']),
      note: z.string().trim().max(500).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const svc = createServiceClient();
  const { data: post } = await svc
    .from('community_posts')
    .select('author_profile_id, company_id')
    .eq('id', parsed.data.postId)
    .maybeSingle();
  const row = post as { author_profile_id: string | null; company_id: string } | null;
  if (!row) return { ok: false, error: 'not_found' };
  // Cross-tenant guard: a member may only report inside their own company.
  if (row.company_id !== ctx.companyId) return { ok: false, error: 'not_found' };
  if (row.author_profile_id === ctx.userId) return { ok: false, error: 'self' };

  const { error } = await svc.from('community_reports').upsert(
    {
      company_id: ctx.companyId,
      post_id: parsed.data.postId,
      reporter_profile_id: ctx.userId,
      reported_profile_id: row.author_profile_id,
      reason: parsed.data.reason,
      note: parsed.data.note ?? null,
    },
    { onConflict: 'company_id,post_id,reporter_profile_id' },
  );
  if (error) {
    console.error('reportPostAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  return { ok: true };
}
