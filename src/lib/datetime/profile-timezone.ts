// Server-only loader for a profile's IANA timezone. Kept separate from local-day.ts so the pure
// Intl helpers stay dependency-free and importable from client components; this file pulls in the
// service client and is server-only.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { resolveTimezone } from '@/lib/datetime/local-day';

/**
 * The IANA timezone for a profile, falling back to the app default when unset or unreadable.
 * Uses the service client (reading one's own/ a member's tz is safe; callers are already auth-gated).
 */
export async function getProfileTimezone(profileId: string): Promise<string> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('profiles')
    .select('timezone')
    .eq('id', profileId)
    .maybeSingle();
  return resolveTimezone((data as { timezone: string | null } | null)?.timezone);
}
