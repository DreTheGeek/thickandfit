// Direct-message data layer. One thread per client. Coach inbox groups by client_id; the subscriber
// reads their own thread. Service client (server-only), RLS-scoped at write time by the actions.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

export type Thread = {
  clientId: string;
  name: string;
  lastBody: string;
  lastAt: string;
  unread: number;
};

export type ThreadMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
};

// Coach inbox: latest message per client + count of unread client-sent messages.
export async function getThreads(companyId: string): Promise<Thread[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('messages')
    .select('client_id, sender_id, body, created_at, read_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(3000);
  const rows =
    (data ?? []) as {
      client_id: string;
      sender_id: string;
      body: string;
      created_at: string;
      read_at: string | null;
    }[];

  const byClient = new Map<string, { lastBody: string; lastAt: string; unread: number }>();
  for (const m of rows) {
    let e = byClient.get(m.client_id);
    if (!e) {
      e = { lastBody: m.body, lastAt: m.created_at, unread: 0 }; // first seen = latest (desc)
      byClient.set(m.client_id, e);
    }
    if (m.sender_id === m.client_id && !m.read_at) e.unread += 1;
  }
  if (byClient.size === 0) return [];

  const ids = [...byClient.keys()];
  const { data: profs } = await sb.from('profiles').select('id, full_name, email').in('id', ids);
  const names = new Map(
    ((profs ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [
      p.id,
      (p.full_name || p.email || 'Client').trim(),
    ]),
  );

  return [...byClient.entries()]
    .map(([clientId, e]) => ({ clientId, name: names.get(clientId) ?? 'Client', ...e }))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

// All messages in one client's thread, oldest first.
export async function getThread(clientId: string): Promise<ThreadMessage[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('messages')
    .select('id, sender_id, body, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })
    .limit(500);
  return ((data ?? []) as { id: string; sender_id: string; body: string; created_at: string }[]).map(
    (m) => ({ id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at }),
  );
}
