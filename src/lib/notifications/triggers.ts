// Notification triggers: feature code calls these to fan a notification out to the right members.
// First real trigger: a coach community broadcast notifies every other member in the company,
// each in their own ui_locale.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { createNotification, createNotificationsBulk } from '@/lib/notifications/create';
import { asNotifLocale, notifText } from '@/lib/notifications/i18n';
import { COACHING_ROLES } from '@/lib/auth/session';
import type { NotificationPayload, NotificationType } from '@/lib/notifications/types';

type MemberRow = { id: string; ui_locale: string | null };

/**
 * Notify ONE member, rendered in their ui_locale. The generic building block behind the coach->member
 * "your coach assigned you X" nudges (program / habit / meal plan / form). Best-effort: logged, not thrown.
 */
export async function notifyMember(params: {
  companyId: string;
  profileId: string;
  type: NotificationType;
  titleKey: string;
  bodyKey: string;
  bodyVars?: Record<string, string>;
  link: string;
}): Promise<void> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('profiles')
    .select('ui_locale')
    .eq('id', params.profileId)
    .maybeSingle();
  const locale = asNotifLocale((data as { ui_locale?: string | null } | null)?.ui_locale);
  await createNotification(params.companyId, params.profileId, {
    type: params.type,
    title: notifText(locale, params.titleKey),
    body: notifText(locale, params.bodyKey, params.bodyVars ?? {}),
    link: params.link,
  });
}

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
 * A coach launched a challenge: notify every member so it "pops up" in the client portal (in-app
 * bell always; push unless the member muted the community channel). Mirrors notifyBroadcast.
 * Best-effort: failures are logged, never thrown.
 */
export async function notifyNewChallenge(params: {
  companyId: string;
  createdByProfileId: string;
  challengeTitle: string;
}): Promise<void> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('profiles')
    .select('id, ui_locale, role')
    .eq('company_id', params.companyId)
    .neq('id', params.createdByProfileId);
  if (error) {
    console.error('notifyNewChallenge load members:', error.message);
    return;
  }
  // Members only (subscribers + free). Coaches/assistants/operators don't need the "join" nudge.
  const members = ((data as (MemberRow & { role?: string })[]) ?? []).filter(
    (m) => m.role === 'subscriber' || m.role === 'free',
  );
  if (members.length === 0) return;

  const recipients = members.map((m) => {
    const locale = asNotifLocale(m.ui_locale);
    const payload: NotificationPayload = {
      type: 'challenge_started',
      title: notifText(locale, 'challengeStartedTitle'),
      body: notifText(locale, 'challengeStartedBody', { title: params.challengeTitle }),
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
 * A member submitted her check-in. Tell her coach.
 *
 * This did not exist. The response was written to form_responses correctly and then nothing
 * happened: no notification, no email, no bell. The only way Stephanie ever saw a check-in was by
 * opening that specific client's page and noticing. With 256 clients that is not a workflow, and
 * the check-in is the heartbeat of the coaching relationship, the one thing a member does every
 * week expecting to be read.
 *
 * Note the asymmetry this closes. Coach-to-member was already wired: assigning a program fires
 * notifyMember with a bell and a push. Member-to-coach had one wire (a chat reply) and the check-in
 * was not on it.
 */
export async function notifyCoachOfCheckin(params: {
  companyId: string;
  clientProfileId: string;
  clientName: string;
  formTitle: string;
}): Promise<void> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('profiles')
    .select('id, ui_locale')
    .eq('company_id', params.companyId)
    // COACHING_ROLES, not COACH_ROLES. The first version used the access set, which includes
    // operator, so one member's check-in pinged the agency's ops accounts alongside Stephanie.
    // Verified against the live DB: four recipients for one submission, two of them operators.
    .in('role', COACHING_ROLES)
    // Guard against a coach who is somehow also the submitting profile notifying herself.
    .neq('id', params.clientProfileId);
  if (error) {
    console.error('notifyCoachOfCheckin load coaches:', error.message);
    return;
  }
  const coaches = (data as MemberRow[]) ?? [];
  if (coaches.length === 0) return;

  const recipients = coaches.map((c) => {
    const locale = asNotifLocale(c.ui_locale);
    const payload: NotificationPayload = {
      type: 'checkin',
      title: notifText(locale, 'checkinDoneTitle'),
      body: notifText(locale, 'checkinDoneBody', { name: params.clientName }),
      // Straight to the woman's own record, not to a list she then has to search. The point of the
      // notification is that the next tap is reading what she wrote.
      link: `/coach/subscribers/${params.clientProfileId}`,
    };
    return { profileId: c.id, payload };
  });
  await createNotificationsBulk(params.companyId, recipients);
}

/**
 * Notify the coaching side that a client replied in the inbox, so a reply is never discovered late.
 *
 * Scoped to COACHING_ROLES, matching notifyCoachOfCheckin above. It used to include operator, which
 * was a defensible call when the team was three people and "never discovered late" outweighed the
 * noise. It stops being defensible at 256 clients: every reply would ping the agency's ops accounts
 * as well as Stephanie's, and the reliable outcome of a channel that fires for things you cannot
 * act on is that it gets muted. Observed live, driving a real member reply: six recipients, two of
 * them operators.
 *
 * Reverse this by swapping the constant back if the ops team does want inbox coverage; it is a
 * judgement call about who answers client DMs, not a correctness fix.
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
    .in('role', COACHING_ROLES)
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
