'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export type NotifResult = { ok: boolean; error?: string };

/** Mark a single notification read. RLS guarantees the row belongs to the caller. */
export async function markReadAction(notificationId: unknown): Promise<NotifResult> {
  const parsed = z.string().uuid().safeParse(notificationId);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  const sb = await createClient();
  const { error } = await sb
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', parsed.data)
    .eq('profile_id', ctx.userId)
    .is('read_at', null);
  if (error) {
    console.error('markReadAction:', error.message);
    return { ok: false, error: 'update_failed' };
  }
  revalidatePath('/notifications');
  return { ok: true };
}

/** Mark every unread notification read for the caller. */
export async function markAllReadAction(): Promise<NotifResult> {
  const ctx = await requireAuth();
  const sb = await createClient();
  const { error } = await sb
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('profile_id', ctx.userId)
    .is('read_at', null);
  if (error) {
    console.error('markAllReadAction:', error.message);
    return { ok: false, error: 'update_failed' };
  }
  revalidatePath('/notifications');
  return { ok: true };
}

const SubInput = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
});

/**
 * Persist a browser push subscription for the caller. Idempotent on endpoint (re-subscribing the
 * same device updates its keys + owner instead of duplicating). RLS-scoped insert/update via the
 * user session; the unique endpoint constraint backs the upsert.
 */
export async function savePushSubscriptionAction(input: unknown): Promise<NotifResult> {
  const parsed = SubInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const sb = await createClient();
  const { error } = await sb.from('push_subscriptions').upsert(
    {
      company_id: ctx.companyId,
      profile_id: ctx.userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
    },
    { onConflict: 'endpoint' },
  );
  if (error) {
    console.error('savePushSubscriptionAction:', error.message);
    return { ok: false, error: 'save_failed' };
  }
  return { ok: true };
}

/** Remove a push subscription (on permission revoke / unsubscribe). */
export async function deletePushSubscriptionAction(endpoint: unknown): Promise<NotifResult> {
  const parsed = z.string().url().max(2000).safeParse(endpoint);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  const sb = await createClient();
  const { error } = await sb
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', parsed.data)
    .eq('profile_id', ctx.userId);
  if (error) {
    console.error('deletePushSubscriptionAction:', error.message);
    return { ok: false, error: 'delete_failed' };
  }
  return { ok: true };
}
