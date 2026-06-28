// Access entitlement (pay-to-enter + comped-full). A subscriber/free user has app access if they
// hold an active paid subscription OR an unexpired coach-granted comp. Coaches/operators are entitled
// by role and are checked by the caller (the app layout / guards), not here.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { getSubscriptionForProfile, isActiveStatus } from '@/lib/billing/subscriptions';

/** True if this profile may use the paid app right now (active subscription or live comp). */
export async function isEntitled(profileId: string): Promise<boolean> {
  const sub = await getSubscriptionForProfile(profileId);
  if (sub && isActiveStatus(sub.status)) return true;

  const svc = createServiceClient();
  const { data } = await svc
    .from('profiles')
    .select('comp_access_until')
    .eq('id', profileId)
    .maybeSingle();
  const until = (data as { comp_access_until: string | null } | null)?.comp_access_until ?? null;
  return Boolean(until && new Date(until).getTime() > Date.now());
}

/** Grant a profile comped access for `days` from now (challenge winners, free clients). Coach-only. */
export async function grantCompAccess(profileId: string, days: number): Promise<void> {
  const until = new Date(Date.now() + Math.max(1, Math.floor(days)) * 86_400_000).toISOString();
  const svc = createServiceClient();
  await svc.from('profiles').update({ comp_access_until: until }).eq('id', profileId);
}

/** Revoke comped access immediately (clears the timestamp). Coach-only. */
export async function revokeCompAccess(profileId: string): Promise<void> {
  const svc = createServiceClient();
  await svc.from('profiles').update({ comp_access_until: null }).eq('id', profileId);
}

/** True once the client has accepted the health / assumption-of-risk disclaimer. */
export async function hasAckedHealth(profileId: string): Promise<boolean> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('profiles')
    .select('health_ack_at')
    .eq('id', profileId)
    .maybeSingle();
  return Boolean((data as { health_ack_at: string | null } | null)?.health_ack_at);
}

/** Record the client's health-disclaimer acceptance (timestamped). */
export async function ackHealth(profileId: string): Promise<void> {
  const svc = createServiceClient();
  await svc.from('profiles').update({ health_ack_at: new Date().toISOString() }).eq('id', profileId);
}
