// Coach -> client messaging that works for EVERY client, whether or not they have an app account.
// The 265 migrated clients are CRM contacts; only claimed ones have a profile + in-app inbox. So a
// coach message is delivered by the best available channel and always recorded in client_messages
// (the contact-keyed conversation archive) so the thread history is complete and survives the client
// later claiming their account.
//
//  - claimed client (contact.profile_id set): insert into `messages` (live in-app + Realtime) AND
//    record in client_messages; email notify if configured.
//  - unclaimed client (no profile): send the message body by EMAIL (Resend) and record it in
//    client_messages. When they claim, 0071's backfill moves the whole thread onto their profile.
import 'server-only';
import { after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendCoachEmail } from '@/lib/email/coach-email';
import { notifyClientMessage } from '@/lib/notifications/triggers';

export type DeliveryChannel = 'in_app' | 'email' | 'recorded';
export type SendResult = { ok: boolean; channel?: DeliveryChannel; error?: string };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.teamthickandfit.com';

export async function sendCoachMessageToClient(
  companyId: string,
  senderId: string,
  contactId: string,
  body: string,
): Promise<SendResult> {
  const svc = createServiceClient();

  const { data: contact } = await svc
    .from('contacts')
    .select('id, first_name, last_name, email, profile_id, company_id')
    .eq('id', contactId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!contact) return { ok: false, error: 'not_found' };
  const c = contact as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    profile_id: string | null;
  };

  const { data: me } = await svc.from('profiles').select('full_name, email').eq('id', senderId).maybeSingle();
  const senderName = ((me as { full_name: string | null; email: string | null } | null)?.full_name || 'Your coach').trim();
  const now = new Date().toISOString();

  // 1) Always record in the contact-keyed archive so the thread stays complete.
  const { error: recErr } = await svc.from('client_messages').insert({
    company_id: companyId,
    contact_id: c.id,
    profile_id: c.profile_id,
    is_from_coach: true,
    sender_name: senderName,
    body,
    msg_type: 'coach',
    sent_at: now,
    source: 'app',
  });
  if (recErr) {
    console.error('sendCoachMessageToClient record:', recErr.message);
    return { ok: false, error: 'record_failed' };
  }

  // 2) Claimed client -> live in-app message (Realtime delivers it to their /messages).
  if (c.profile_id) {
    const { error: msgErr } = await svc.from('messages').insert({
      company_id: companyId,
      client_id: c.profile_id,
      sender_id: senderId,
      body,
    });
    if (msgErr) console.error('sendCoachMessageToClient in-app:', msgErr.message);
    // Bell + push notification and a best-effort email nudge, via after(): a bare void here dies
    // with the frozen lambda, and neither may block or fail the send.
    const clientProfileId = c.profile_id;
    const clientEmail = c.email;
    const clientFirst = c.first_name;
    after(async () => {
      try {
        await notifyClientMessage({ companyId, clientProfileId, senderName });
        if (clientEmail) {
          // /inbox is the human-coach thread; /messages redirects to the AI chat, the wrong place.
          await sendCoachEmail(clientEmail, `New message from ${senderName}`, body, `${APP_URL}/inbox`, clientFirst);
        }
      } catch (e) {
        console.error('sendCoachMessageToClient notify:', e instanceof Error ? e.message : e);
      }
    });
    return { ok: true, channel: 'in_app' };
  }

  // 3) Unclaimed client -> deliver by email with a link to claim + read in-app.
  if (c.email) {
    const sent = await sendCoachEmail(
      c.email,
      `Message from ${senderName}`,
      body,
      `${APP_URL}/join`,
      c.first_name,
    );
    return { ok: true, channel: sent ? 'email' : 'recorded' };
  }

  // No email on file: the message is recorded and will appear when they claim.
  return { ok: true, channel: 'recorded' };
}
