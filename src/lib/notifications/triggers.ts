// Notification triggers: feature code calls these to fan a notification out to the right members.
// First real trigger: a coach community broadcast notifies every other member in the company,
// each in their own ui_locale.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { createNotification, createNotificationsBulk } from '@/lib/notifications/create';
import { asNotifLocale, notifText } from '@/lib/notifications/i18n';
import { COACH_ROLES } from '@/lib/auth/session';
import type { NotificationPayload } from '@/lib/notifications/types';

type MemberRow = { id: string; ui_locale: string | null };

/**
 * Notify every member of a company (except the author) that a coach posted a broadcast.
 * Best-effort: failures are logged, never thrown, so posting the broadcast always succeeds.
 */
export async function notifyBroadcast(params: {
  companyId: string;
  authorProfileId: string;
  authorName: string;
}): Promise<void> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('profiles')
    .select('id, ui_locale')
    .eq('company_id', params.companyId)
    .neq('id', params.authorProfileId);
  if (error) {
    console.error('notifyBroadcast load members:', error.message);
    return;
  }
  const members = (data as MemberRow[]) ?? [];
  if (members.length === 0) return;

  const recipients = members.map((m) => {
    const locale = asNotifLocale(m.ui_locale);
    const payload: NotificationPayload = {
      type: 'community_broadcast',
      title: notifText(locale, 'broadcastTitle'),
      body: notifText(locale, 'broadcastBody', { name: params.authorName }),
      link: '/community',
    };
    return { profileId: m.id, payload };
  });

  await createNotificationsBulk(params.companyId, recipients);
}

/**
 * Notify a member that their coach sent them a direct message (in-app bell + best-effort push).
 * Best-effort: failures are logged, never thrown.
 */
export async function notifyClientMessage(params: {
  companyId: string;
  clientProfileId: string;
  senderName: string;
}): Promise<void> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('profiles')
    .select('ui_locale')
    .eq('id', params.clientProfileId)
    .maybeSingle();
  const locale = asNotifLocale((data as MemberRow | null)?.ui_locale);
  await createNotification(params.companyId, params.clientProfileId, {
    type: 'coach_message',
    title: notifText(locale, 'messageTitle'),
    body: notifText(locale, 'messageBody', { name: params.senderName }),
    link: '/inbox',
  });
}

/**
 * Notify every coach-side user (coach / assistant / operator) that a client replied in the inbox,
 * so a reply is never discovered late. Best-effort.
 */
export async function notifyCoachOfReply(params: {
  companyId: string;
  clientProfileId: string;
  clientName: string;
}): Promise<void> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('profiles')
    .select('id, ui_locale')
    .eq('company_id', params.companyId)
    .in('role', COACH_ROLES)
    .neq('id', params.clientProfileId);
  if (error) {
    console.error('notifyCoachOfReply load coaches:', error.message);
    return;
  }
  const coaches = (data as MemberRow[]) ?? [];
  if (coaches.length === 0) return;
  const recipients = coaches.map((c) => {
    const locale = asNotifLocale(c.ui_locale);
    const payload: NotificationPayload = {
      type: 'coach_message',
      title: notifText(locale, 'replyTitle'),
      body: notifText(locale, 'replyBody', { name: params.clientName }),
      link: '/coach/inbox',
    };
    return { profileId: c.id, payload };
  });
  await createNotificationsBulk(params.companyId, recipients);
}
