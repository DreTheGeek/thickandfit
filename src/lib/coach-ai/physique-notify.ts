// Safety loop for the physique read: when a member's analysis is flagged for a wellbeing concern, the
// member is told "Stephanie will follow up personally". This makes that promise real by notifying the
// company's coaches so a human actually reaches out. SERVER-ONLY. Fire-and-forget (void it); it never
// throws and never blocks the member's result.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { createNotification } from '@/lib/notifications/create';
import { notifText, asNotifLocale } from '@/lib/notifications/i18n';
import { APPROVER_ROLES } from '@/lib/auth/session';

export async function notifyCoachesOfFlaggedPhysique(companyId: string, memberId: string): Promise<void> {
  try {
    const svc = createServiceClient();
    const [memberRes, coachRes] = await Promise.all([
      svc.from('profiles').select('full_name').eq('id', memberId).maybeSingle(),
      // Wellbeing escalation goes to the SENIOR tier (head coach + operator), not junior assistant
      // coaches, for appropriateness + the member's privacy.
      svc.from('profiles').select('id, ui_locale').eq('company_id', companyId).in('role', APPROVER_ROLES),
    ]);

    const name = ((memberRes.data as { full_name?: string } | null)?.full_name || '').trim() || 'A member';
    const coaches = (coachRes.data as { id: string; ui_locale: string | null }[] | null) ?? [];

    for (const coach of coaches) {
      if (coach.id === memberId) continue; // never alert the member as if they were their own coach
      const locale = asNotifLocale(coach.ui_locale);
      void createNotification(companyId, coach.id, {
        type: 'system', // maps to the always-delivered "coach" preference category
        title: notifText(locale, 'physiqueFlagTitle'),
        body: notifText(locale, 'physiqueFlagBody', { name }),
        link: `/coach/subscribers/${memberId}`,
      });
    }
  } catch (e) {
    console.error('notifyCoachesOfFlaggedPhysique:', e instanceof Error ? e.message : e);
  }
}
