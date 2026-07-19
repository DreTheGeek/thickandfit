// Direct-message data layer. One thread per client. Coach inbox groups by client_id; the subscriber
// reads their own thread. Service client (server-only), RLS-scoped at write time by the actions.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

export type ThreadMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
};

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
