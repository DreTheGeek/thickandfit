// Read-side queries for the in-app notification center. RLS-scoped via the user session,
// so a member only ever sees their own rows. No service client here.
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AppNotification } from '@/lib/notifications/types';

type Row = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function mapRow(r: Row): AppNotification {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    link: r.link,
    readAt: r.read_at,
    createdAt: r.created_at,
  };
}

/** Most recent notifications for the current user, newest first. */
export async function getNotifications(profileId: string, limit = 50): Promise<AppNotification[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('getNotifications:', error.message);
    return [];
  }
  return (data as Row[]).map(mapRow);
}

/** Unread count for the bell badge. Cheap: counts only, no rows returned. */
export async function getUnreadCount(profileId: string): Promise<number> {
  const sb = await createClient();
  const { count, error } = await sb
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .is('read_at', null);
  if (error) {
    console.error('getUnreadCount:', error.message);
    return 0;
  }
  return count ?? 0;
}
