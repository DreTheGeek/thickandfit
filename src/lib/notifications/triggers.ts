// Notification triggers: feature code calls these to fan a notification out to the right members.
// First real trigger: a coach community broadcast notifies every other member in the company,
// each in their own ui_locale.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { createNotificationsBulk } from '@/lib/notifications/create';
import { asNotifLocale, notifText } from '@/lib/notifications/i18n';
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
      title: notifText(locale, 'broadcast.title'),
      body: notifText(locale, 'broadcast.body', { name: params.authorName }),
      link: '/community',
    };
    return { profileId: m.id, payload };
  });

  await createNotificationsBulk(params.companyId, recipients);
}
