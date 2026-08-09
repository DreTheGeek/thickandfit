// Coach settings: Coaching Preferences.
//
// Reads the signed-in coach's own email so the notification section can name the address the mail
// would actually go to. The old screen said "Send an email to {you} every time there is a", and
// showing the literal address is the difference between a coach knowing where the alert lands and
// assuming it lands somewhere.
import type { ReactElement } from 'react';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { readCoachSettings } from '@/lib/coach/settings';
import { CoachingPrefsForm } from '@/components/coach/settings/coaching-prefs-form';

export const dynamic = 'force-dynamic';

export default async function CoachCoachingPrefsPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const svc = createServiceClient();

  const [settings, { data: me }] = await Promise.all([
    readCoachSettings(ctx.companyId),
    svc.from('profiles').select('email').eq('id', ctx.userId).maybeSingle(),
  ]);

  const coachEmail = ((me as { email: string | null } | null)?.email ?? '').trim();

  return <CoachingPrefsForm initial={settings} coachEmail={coachEmail} />;
}
