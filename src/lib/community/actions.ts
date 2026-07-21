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

export type CommunityResult = { ok: boolean; error?: string };

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

  const sb = await createClient();
  const { error } = await sb.from('community_posts').insert({
    company_id: ctx.companyId,
    author_profile_id: ctx.userId,
    body: parsed.data.body,
    media_url: parsed.data.mediaUrl ?? null,
    is_broadcast: isBroadcast,
  });
  if (error) {
    console.error('createPostAction:', error.message);
    return { ok: false, error: 'insert_failed' };
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
  await requireAuth();
  return getComments(parsed.data);
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
