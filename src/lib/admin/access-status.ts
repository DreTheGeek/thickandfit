import 'server-only';
// Server-only helpers for reading admin/teammate STATE (never mutating it). Kept out of
// access-actions.ts because that file is 'use server' and every exported async there becomes a
// callable server action — a helper returning a non-serializable Set would be a footgun there.
import { createServiceClient } from '@/lib/supabase/service';

type AuthUserLite = {
  id: string;
  banned_until?: string | null;
  last_sign_in_at?: string | null;
};

/** One pass over auth.admin.listUsers. /admin/team has ~7 staff, so this is a single round trip in
 *  practice; both readers below share it rather than paging twice. */
async function listAuthUsers(label: string): Promise<AuthUserLite[]> {
  const svc = createServiceClient();
  const all: AuthUserLite[] = [];
  const perPage = 200;
  let page = 1;
  for (;;) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error(`${label}:`, error.message);
      return all;
    }
    const users = (data?.users ?? []) as unknown as AuthUserLite[];
    all.push(...users);
    if (users.length < perPage) break;
    page += 1;
    if (page > 25) break; // 5,000 users hard stop — well beyond a staff Team page.
  }
  return all;
}

/** IDs of currently-disabled (banned) teammates. */
export async function getDisabledTeammateIds(): Promise<Set<string>> {
  const users = await listAuthUsers('getDisabledTeammateIds');
  const disabled = new Set<string>();
  const now = Date.now();
  for (const u of users) {
    // banned_until: an ISO string in the future when banned, null when not.
    if (u.banned_until && Date.parse(u.banned_until) > now) disabled.add(u.id);
  }
  return disabled;
}

/** IDs of teammates who have NEVER signed in, i.e. their invite was never accepted.
 *
 *  Worth surfacing on /admin/team because the set-password link expires in ONE HOUR (the Supabase
 *  recovery TTL). Without this, an invite that lands in a spam folder is indistinguishable from one
 *  that was accepted, and the page shows a full-looking roster of people who cannot actually log in.
 *  Two real invites sat dead for six days before this existed. */
export async function getNeverSignedInIds(): Promise<Set<string>> {
  const users = await listAuthUsers('getNeverSignedInIds');
  const pending = new Set<string>();
  for (const u of users) {
    if (!u.last_sign_in_at) pending.add(u.id);
  }
  return pending;
}
