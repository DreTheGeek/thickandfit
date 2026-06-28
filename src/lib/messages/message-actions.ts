'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guards';
import { hasRole, COACH_ROLES } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export type MsgResult = { ok: boolean; error?: string };

const Body = z.string().trim().min(1).max(4000);

// Send a message. Subscribers always post to their OWN thread; coaches post to a target client's
// thread. RLS independently enforces sender_id = auth.uid() + thread membership.
export async function sendMessageAction(targetClientId: unknown, body: unknown): Promise<MsgResult> {
  const b = Body.safeParse(body);
  if (!b.success) return { ok: false, error: 'empty' };
  const ctx = await requireAuth();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  let clientId: string;
  if (hasRole(ctx.role, COACH_ROLES)) {
    const t = z.string().uuid().safeParse(targetClientId);
    if (!t.success) return { ok: false, error: 'invalid' };
    clientId = t.data;
  } else {
    clientId = ctx.userId;
  }

  const sb = await createClient();
  const { error } = await sb.from('messages').insert({
    company_id: ctx.companyId,
    client_id: clientId,
    sender_id: ctx.userId,
    body: b.data,
  });
  if (error) {
    console.error('sendMessageAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  revalidatePath('/coach/inbox');
  revalidatePath('/messages');
  return { ok: true };
}

// Coach marks a client's unread (client-sent) messages as read.
export async function markThreadReadAction(clientId: unknown): Promise<MsgResult> {
  const parsed = z.string().uuid().safeParse(clientId);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  if (!hasRole(ctx.role, COACH_ROLES)) return { ok: false, error: 'forbidden' };
  const sb = await createClient();
  await sb
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('client_id', parsed.data)
    .eq('sender_id', parsed.data)
    .is('read_at', null);
  return { ok: true };
}
