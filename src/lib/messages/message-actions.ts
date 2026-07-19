'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasRole, COACH_ROLES } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { notifyClientMessage, notifyCoachOfReply } from '@/lib/notifications/triggers';

export type MsgResult = { ok: boolean; error?: string };

const Body = z.string().trim().min(1).max(4000);

// Send a message. Subscribers always post to their OWN thread; coaches post to a target client's
// thread. RLS independently enforces sender_id = auth.uid() + thread membership.
export async function sendMessageAction(targetClientId: unknown, body: unknown): Promise<MsgResult> {
  const b = Body.safeParse(body);
  if (!b.success) return { ok: false, error: 'empty' };
  const ctx = await requireAuth();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const isCoach = hasRole(ctx.role, COACH_ROLES);
  let clientId: string;
  if (isCoach) {
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

  // Post-send bookkeeping, via after() so the frozen lambda cannot drop it and a failure never
  // undoes the send:
  //  1. Archive into client_messages (the contact-keyed record the CRM client page reads). Coach
  //     sends from the CRM composer were archived, but replies sent here were NOT, so the coach
  //     never saw the client's side of the thread on the client page.
  //  2. Notify the other side: client gets a coach_message bell+push; every coach-side user gets
  //     a reply notification, so an answer is never discovered late.
  const { companyId, userId } = ctx;
  const text = b.data;
  after(async () => {
    try {
      const svc = createServiceClient();
      const { data: sender } = await svc
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .maybeSingle();
      const senderName =
        ((sender as { full_name: string | null; email: string | null } | null)?.full_name ||
          (sender as { email: string | null } | null)?.email ||
          (isCoach ? 'Your coach' : 'Client')).trim();

      // limit(1) + array take, NOT maybeSingle: a duplicated contact (two rows, one profile) makes
      // maybeSingle error out and silently skipped the archive.
      const { data: contactRows } = await svc
        .from('contacts')
        .select('id')
        .eq('company_id', companyId)
        .eq('profile_id', clientId)
        .order('created_at', { ascending: true })
        .limit(1);
      const contact = ((contactRows ?? []) as { id: string }[])[0] ?? null;
      if (contact) {
        const { error: recErr } = await svc.from('client_messages').insert({
          company_id: companyId,
          contact_id: contact.id,
          profile_id: clientId,
          is_from_coach: isCoach,
          sender_name: senderName,
          body: text,
          msg_type: isCoach ? 'coach' : 'client',
          sent_at: new Date().toISOString(),
          source: 'app',
        });
        if (recErr) console.error('sendMessageAction archive:', recErr.message);
      }

      if (isCoach) {
        await notifyClientMessage({ companyId, clientProfileId: clientId, senderName });
      } else {
        await notifyCoachOfReply({ companyId, clientProfileId: clientId, clientName: senderName });
      }
    } catch (e) {
      console.error('sendMessageAction post-send:', e instanceof Error ? e.message : e);
    }
  });

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
