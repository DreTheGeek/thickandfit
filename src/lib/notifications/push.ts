// Web Push send helper. KEY-GATED: if VAPID_PRIVATE_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY are not
// set (the current environment), every send is skipped silently and in-app notifications still
// work. The web-push library is imported lazily so a missing dep / missing keys never crashes
// a request path that doesn't push.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

export type PushPayload = {
  title: string;
  body: string;
  url?: string | null;
};

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:support@teamthickandfit.com';

/** True only when both VAPID keys are present. Push is a no-op otherwise. */
export function isPushConfigured(): boolean {
  return VAPID_PUBLIC.length > 0 && VAPID_PRIVATE.length > 0;
}

type SubRow = { id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Best-effort push to every device a profile has subscribed. Returns the number of pushes sent.
 * Skips silently (returns 0) when keys are absent. Prunes endpoints that the push service rejects
 * with 404/410 (expired subscriptions).
 */
export async function sendPush(profileId: string, payload: PushPayload): Promise<number> {
  if (!isPushConfigured()) return 0;

  // Lazy import: keeps the web-push native-ish dep out of the build graph until actually used.
  const webpush = (await import('web-push')).default;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const svc = createServiceClient();
  const { data, error } = await svc
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('profile_id', profileId);
  if (error || !data || data.length === 0) {
    if (error) console.error('sendPush load subs:', error.message);
    return 0;
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/notifications',
  });

  let sent = 0;
  const expired: string[] = [];
  await Promise.all(
    (data as SubRow[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
        sent += 1;
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          expired.push(sub.id);
        } else {
          console.error('sendPush send:', e instanceof Error ? e.message : e);
        }
      }
    }),
  );

  if (expired.length > 0) {
    void svc
      .from('push_subscriptions')
      .delete()
      .in('id', expired)
      .then(() => undefined, () => undefined);
  }

  return sent;
}
