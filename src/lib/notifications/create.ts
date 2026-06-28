// createNotification: the single entry point for delivering a notification. Inserts the in-app
// row (service client, so a trigger can fan out to other members) AND best-effort fires a web
// push. Fire-and-forget side-effect convention: callers may `void createNotification(...)`.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { sendPush } from '@/lib/notifications/push';
import { isPushAllowed } from '@/lib/account/notification-preferences';
import { categoryForNotificationType } from '@/lib/account/notification-preferences-shared';
import type { NotificationPayload } from '@/lib/notifications/types';

// Fire a web push only if the recipient hasn't muted that category's push channel. The in-app
// row is always written; only the push is suppressed. Billing/transactional always delivers.
async function maybePush(
  profileId: string,
  payload: NotificationPayload,
  context: string,
): Promise<void> {
  try {
    const allowed = await isPushAllowed(profileId, categoryForNotificationType(payload.type));
    if (!allowed) return;
    await sendPush(profileId, {
      title: payload.title,
      body: payload.body,
      url: payload.link ?? '/notifications',
    });
  } catch (e: unknown) {
    console.error(`${context} push:`, e instanceof Error ? e.message : e);
  }
}

/**
 * Deliver a notification to one member.
 * @param companyId  tenant scope (required: every row is company-scoped)
 * @param profileId  recipient
 */
export async function createNotification(
  companyId: string,
  profileId: string,
  payload: NotificationPayload,
): Promise<void> {
  const svc = createServiceClient();
  const { error } = await svc.from('notifications').insert({
    company_id: companyId,
    profile_id: profileId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    link: payload.link ?? null,
  });
  if (error) {
    console.error('createNotification insert:', error.message);
    return;
  }

  // Best-effort push, gated on the recipient's notification preferences. No-op when VAPID keys absent.
  void maybePush(profileId, payload, 'createNotification');
}

/**
 * Deliver the SAME notification to many members (bulk insert one query) and fire push per member.
 * Used by the community-broadcast fan-out. Each recipient may have a different localized payload,
 * so callers pass a resolver that returns the payload for a given profile.
 */
export async function createNotificationsBulk(
  companyId: string,
  recipients: Array<{ profileId: string; payload: NotificationPayload }>,
): Promise<void> {
  if (recipients.length === 0) return;
  const svc = createServiceClient();
  const rows = recipients.map((r) => ({
    company_id: companyId,
    profile_id: r.profileId,
    type: r.payload.type,
    title: r.payload.title,
    body: r.payload.body,
    link: r.payload.link ?? null,
  }));
  const { error } = await svc.from('notifications').insert(rows);
  if (error) {
    console.error('createNotificationsBulk insert:', error.message);
    return;
  }

  for (const r of recipients) {
    void maybePush(r.profileId, r.payload, 'createNotificationsBulk');
  }
}
