'use server';
// Moderation actions for /admin/community/reports. Three verbs, all operator-gated + audited:
//   dismissReportAction  - the report was wrong; the post stays.
//   deletePostAction     - the post goes; every report on it is marked actioned.
//   muteMemberAction     - the member cannot post for N days (mutes are reversible by design;
//                          a hard ban is deliberately NOT here - permanent removal of a paying
//                          member's access is a decision that should not be one click deep).
//
// Post deletion is the one destructive verb. It cascades to reports via the FK, so the report rows
// are re-stamped BEFORE the delete or the audit trail would vanish with them.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOperator } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { logCoachAction } from '@/lib/coach/audit';

export type ModResult = { ok: boolean; error?: string };

const idSchema = z.string().uuid();
const muteSchema = z.object({ profileId: z.string().uuid(), days: z.number().int().min(1).max(365) });

const ERR_SCOPE = 'not_found';

async function guard(): Promise<{ userId: string; companyId: string } | null> {
  const ctx = await requireOperator();
  if (!ctx.companyId) return null;
  const ok = await checkRateLimit(ctx.userId, 'admin-community-mod', 60, 60, { failClosed: true });
  if (!ok) return null;
  return { userId: ctx.userId, companyId: ctx.companyId };
}

/** Mark a report resolved with no action taken. */
export async function dismissReportAction(input: unknown): Promise<ModResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await guard();
  if (!ctx) return { ok: false, error: 'blocked' };

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('community_reports')
    .update({ status: 'dismissed', resolved_by: ctx.userId, resolved_at: new Date().toISOString() })
    .eq('company_id', ctx.companyId)
    .eq('id', parsed.data)
    .eq('status', 'open')
    .select('id, post_id');
  if (error) {
    console.error('dismissReportAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  if ((data ?? []).length === 0) return { ok: false, error: ERR_SCOPE };

  logCoachAction(sb, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'community_report',
    entityId: parsed.data,
    action: 'admin.dismiss_report',
  });
  revalidatePath('/admin/community/reports');
  return { ok: true };
}

/** Delete the reported post. Marks every report on it actioned first so the trail survives cascade. */
export async function deletePostAction(input: unknown): Promise<ModResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await guard();
  if (!ctx) return { ok: false, error: 'blocked' };

  const postId = parsed.data;
  const sb = createServiceClient();

  // Scope check + capture the body for the audit snapshot before it is gone forever.
  const { data: postRow } = await sb
    .from('community_posts')
    .select('id, body, author_profile_id, company_id')
    .eq('id', postId)
    .maybeSingle();
  const post = postRow as { id: string; body: string | null; author_profile_id: string | null; company_id: string } | null;
  if (!post || post.company_id !== ctx.companyId) return { ok: false, error: ERR_SCOPE };

  await sb
    .from('community_reports')
    .update({ status: 'actioned', resolved_by: ctx.userId, resolved_at: new Date().toISOString() })
    .eq('company_id', ctx.companyId)
    .eq('post_id', postId)
    .eq('status', 'open');

  const { error: delErr } = await sb
    .from('community_posts')
    .delete()
    .eq('company_id', ctx.companyId)
    .eq('id', postId);
  if (delErr) {
    console.error('deletePostAction:', delErr.message);
    return { ok: false, error: 'failed' };
  }

  logCoachAction(sb, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'community_post',
    entityId: postId,
    action: 'admin.delete_post',
    previousState: { body: post.body, author_profile_id: post.author_profile_id },
  });
  revalidatePath('/admin/community/reports');
  return { ok: true };
}

/**
 * Mute a member from posting for N days. Writes profiles.community_muted_until, which the community
 * post path must honour. Reversible on purpose: pass days=0 semantics via unmuteMemberAction.
 */
export async function muteMemberAction(input: unknown): Promise<ModResult> {
  const parsed = muteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await guard();
  if (!ctx) return { ok: false, error: 'blocked' };

  const { profileId, days } = parsed.data;
  const sb = createServiceClient();
  const { data: prof } = await sb.from('profiles').select('id, email, company_id').eq('id', profileId).maybeSingle();
  const profile = prof as { id: string; email: string | null; company_id: string | null } | null;
  if (!profile || profile.company_id !== ctx.companyId) return { ok: false, error: ERR_SCOPE };

  const until = new Date(Date.now() + days * 86_400_000).toISOString();
  const { error } = await sb.from('profiles').update({ community_muted_until: until }).eq('id', profileId);
  if (error) {
    // The column may not exist yet on an older schema: surface it rather than pretending success.
    console.error('muteMemberAction:', error.message);
    return { ok: false, error: 'failed' };
  }

  logCoachAction(sb, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'profile',
    entityId: profileId,
    action: 'admin.mute_member',
    newState: { email: profile.email, days, until },
  });
  revalidatePath('/admin/community/reports');
  return { ok: true };
}
