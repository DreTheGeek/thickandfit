import 'server-only';
// Server-only helpers for reading admin/teammate STATE (never mutating it). Kept out of
// access-actions.ts because that file is 'use server' and every exported async there becomes a
// callable server action — a helper returning a non-serializable Set would be a footgun there.
import { createServiceClient } from '@/lib/supabase/service';

/** IDs of currently-disabled (banned) teammates. Iterates auth.admin.listUsers pages because
 *  /admin/team has ~7 staff — one round trip in practice. */
export async function getDisabledTeammateIds(): Promise<Set<string>> {
  const svc = createServiceClient();
  const disabled = new Set<string>();
  const perPage = 200;
  let page = 1;
  for (;;) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error('getDisabledTeammateIds:', error.message);
      return disabled;
    }
    // banned_until: an ISO string in the future when banned, null when not.
    const users = (data?.users ?? []) as unknown as { id: string; banned_until?: string | null }[];
    const now = Date.now();
    for (const u of users) {
      if (u.banned_until && Date.parse(u.banned_until) > now) disabled.add(u.id);
    }
    if (users.length < perPage) break;
    page += 1;
    if (page > 25) break; // 5,000 users hard stop — well beyond a staff Team page.
  }
  return disabled;
}
