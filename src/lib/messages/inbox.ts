// Contact-centric coach inbox. The old inbox read only the live `messages` table (2 rows) so it was
// empty. This unifies the migrated conversation archive (client_messages, 12k rows) with live in-app
// messages, keyed by CRM contact, so every client Stephanie has ever talked to shows up as a thread.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { messageBodyText } from '@/lib/messages/body-text';

export type InboxThread = {
  contactId: string;
  name: string;
  lastBody: string;
  lastAt: string;
  hasAccount: boolean;
};

export type InboxMessage = {
  id: string;
  fromCoach: boolean;
  senderName: string | null;
  body: string;
  at: string;
  channel: 'live' | 'archive';
};

/**
 * One line of readable text for the thread list.
 *
 * This was `body.slice(0, 120)` on the RAW row, and her migrated Lenus messages are HTML. So every
 * automated message in the coach inbox list previewed as its own source:
 *
 *   <p>Hi Thais 👋🏼</p><p><br></p><p></p><p>Check-in time! ⏰ Head to the app now and comple
 *
 * which is the exact bug lib/messages/body-text.ts was written for, fixed in the conversation pane
 * and missed one file over in the list beside it. Down the whole rail, on the screen she opens most.
 *
 * STRIP BEFORE SLICING. Slicing first cuts a tag in half, and half a tag no longer matches the
 * stripper's pattern, so `<p` survives into the preview. Newlines collapse to spaces because this
 * renders in a single truncated line, where a literal line break just eats the rest of the row.
 *
 * AND SLICE BY CODE POINT, NOT BY CODE UNIT. `String.prototype.slice` counts UTF-16 units, so a cut
 * that lands inside an emoji leaves a LONE SURROGATE in the string. Her messages open with 👋🏼 and
 * 💗 constantly. A lone surrogate is not valid in an HTML document: React serialises it, the
 * browser's parser replaces it with U+FFFD, and the text React rendered is therefore not the text
 * in the DOM. React calls that a failed hydration, throws #418, and re-renders the route on the
 * client - on the screen carrying 12,000 migrated messages. Array.from iterates code points, so a
 * cut can never split one.
 */
const preview = (body: string): string =>
  Array.from(messageBodyText(body).replace(/\s*\n+\s*/g, ' '))
    .slice(0, 120)
    .join('');

// Thread list: newest activity first. Union the last message per contact from client_messages with
// the last live message per claimed client, then keep the most recent per contact.
export async function getInboxThreads(companyId: string): Promise<InboxThread[]> {
  const svc = createServiceClient();

  const [{ data: arch }, { data: live }, { data: contacts }] = await Promise.all([
    svc
      .from('client_messages')
      .select('contact_id, body, sent_at')
      .eq('company_id', companyId)
      .order('sent_at', { ascending: false })
      .limit(6000),
    svc
      .from('messages')
      .select('client_id, body, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(3000),
    svc
      .from('contacts')
      .select('id, first_name, last_name, email, profile_id')
      .eq('company_id', companyId)
      .eq('type', 'client'),
  ]);

  const cRows =
    (contacts ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null; profile_id: string | null }[];
  const byId = new Map(cRows.map((c) => [c.id, c]));
  const byProfile = new Map(cRows.filter((c) => c.profile_id).map((c) => [c.profile_id as string, c]));

  const latest = new Map<string, { body: string; at: string }>();
  const bump = (contactId: string, body: string, at: string): void => {
    const cur = latest.get(contactId);
    if (!cur || at > cur.at) latest.set(contactId, { body, at });
  };

  for (const m of (arch ?? []) as { contact_id: string; body: string | null; sent_at: string }[]) {
    if (m.body) bump(m.contact_id, m.body, m.sent_at);
  }
  for (const m of (live ?? []) as { client_id: string; body: string; created_at: string }[]) {
    const c = byProfile.get(m.client_id);
    if (c) bump(c.id, m.body, m.created_at);
  }

  return [...latest.entries()]
    .map(([contactId, e]) => {
      const c = byId.get(contactId);
      const name = c ? [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || 'Client' : 'Client';
      return { contactId, name, lastBody: preview(e.body), lastAt: e.at, hasAccount: !!c?.profile_id };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

// Every client (contact) for the "new message" picker: id + name + whether they have joined the app.
export async function getClientPickerList(companyId: string): Promise<{ contactId: string; name: string; hasAccount: boolean }[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('contacts')
    .select('id, first_name, last_name, email, profile_id')
    .eq('company_id', companyId)
    .eq('type', 'client')
    .order('first_name', { ascending: true })
    .limit(3000);
  return ((data ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null; profile_id: string | null }[]).map((c) => ({
    contactId: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || 'Client',
    hasAccount: !!c.profile_id,
  }));
}

// One contact's full thread: migrated archive + live messages, merged chronologically (oldest first).
export async function getContactThread(companyId: string, contactId: string): Promise<{ name: string; hasAccount: boolean; messages: InboxMessage[] }> {
  const svc = createServiceClient();

  const { data: c } = await svc
    .from('contacts')
    .select('id, first_name, last_name, email, profile_id')
    .eq('id', contactId)
    .eq('company_id', companyId)
    .maybeSingle();
  const contact = c as { first_name: string | null; last_name: string | null; email: string | null; profile_id: string | null } | null;
  const name = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || contact.email || 'Client' : 'Client';

  const [{ data: arch }, liveRes] = await Promise.all([
    svc
      .from('client_messages')
      .select('id, is_from_coach, sender_name, body, sent_at')
      .eq('contact_id', contactId)
      .order('sent_at', { ascending: true })
      .limit(2000),
    contact?.profile_id
      ? svc
          .from('messages')
          .select('id, sender_id, body, created_at')
          .eq('client_id', contact.profile_id)
          .order('created_at', { ascending: true })
          .limit(1000)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const out: InboxMessage[] = [];
  const archRows = (arch ?? []) as { id: string; is_from_coach: boolean; sender_name: string | null; body: string | null; sent_at: string }[];
  for (const m of archRows) {
    if (m.body) out.push({ id: 'a_' + m.id, fromCoach: m.is_from_coach, senderName: m.sender_name, body: m.body, at: m.sent_at, channel: 'archive' });
  }
  // Every send is now written to BOTH tables (client_messages as the record, messages as the live
  // transport), so a live row with an archive twin (same direction + body within a few seconds) is
  // the same message: keep the archive copy (it carries sender_name), drop the live duplicate.
  const isDupOfArchive = (fromCoach: boolean, body: string, atMs: number): boolean =>
    archRows.some(
      (a) =>
        a.body === body &&
        a.is_from_coach === fromCoach &&
        Math.abs(Date.parse(a.sent_at) - atMs) < 10_000,
    );
  for (const m of (liveRes.data ?? []) as { id: string; sender_id: string; body: string; created_at: string }[]) {
    const fromCoach = m.sender_id !== contact?.profile_id;
    if (isDupOfArchive(fromCoach, m.body, Date.parse(m.created_at))) continue;
    out.push({ id: 'l_' + m.id, fromCoach, senderName: null, body: m.body, at: m.created_at, channel: 'live' });
  }
  out.sort((a, b) => a.at.localeCompare(b.at));
  return { name, hasAccount: !!contact?.profile_id, messages: out };
}
