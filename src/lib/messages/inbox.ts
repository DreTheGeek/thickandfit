// Contact-centric coach inbox. The old inbox read only the live `messages` table (2 rows) so it was
// empty. This unifies the migrated conversation archive (client_messages, 12k rows) with live in-app
// messages, keyed by CRM contact, so every client Stephanie has ever talked to shows up as a thread.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

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
      return { contactId, name, lastBody: e.body.slice(0, 120), lastAt: e.at, hasAccount: !!c?.profile_id };
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
  for (const m of (arch ?? []) as { id: string; is_from_coach: boolean; sender_name: string | null; body: string | null; sent_at: string }[]) {
    if (m.body) out.push({ id: 'a_' + m.id, fromCoach: m.is_from_coach, senderName: m.sender_name, body: m.body, at: m.sent_at, channel: 'archive' });
  }
  for (const m of (liveRes.data ?? []) as { id: string; sender_id: string; body: string; created_at: string }[]) {
    const fromCoach = m.sender_id !== contact?.profile_id;
    out.push({ id: 'l_' + m.id, fromCoach, senderName: null, body: m.body, at: m.created_at, channel: 'live' });
  }
  out.sort((a, b) => a.at.localeCompare(b.at));
  return { name, hasAccount: !!contact?.profile_id, messages: out };
}
