'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guards';
import { COACH_ROLES } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getComments } from '@/lib/community/feed';
import { REACTION_EMOJIS, type FeedComment } from '@/lib/community/types';
import { notifyBroadcast } from '@/lib/notifications/triggers';

export type CommunityResult = { ok: boolean; error?: string };

const PostInput = z.object({
  body: z.string().trim().min(1).max(2000),
  mediaUrl: z.string().trim().url().max(2000).nullable().optional(),
  isBroadcast: z.boolean().optional(),
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
    void notifyBroadcast({
      companyId: ctx.companyId,
      authorProfileId: ctx.userId,
      authorName,
    }).then(undefined, (e: unknown) =>
      console.error('createPostAction notifyBroadcast:', e instanceof Error ? e.message : e),
    );
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
