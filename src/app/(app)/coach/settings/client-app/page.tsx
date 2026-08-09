// Coach settings: Client App Experience.
//
// The page is a thin server shell on purpose. It guards, reads the row, and hands it to the form; all
// forty-odd controls are one client component so the Save button can compare a whole draft against a
// whole baseline. Splitting the form per section would mean a dirty flag per section and a coach
// hunting for which of five Save buttons is the live one.
import type { ReactElement } from 'react';
import { requireCoach } from '@/lib/auth/guards';
import { readCoachSettings } from '@/lib/coach/settings';
import { ClientAppForm } from '@/components/coach/settings/client-app-form';

export const dynamic = 'force-dynamic';

export default async function CoachClientAppSettingsPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const settings = await readCoachSettings(ctx.companyId);
  return <ClientAppForm initial={settings} />;
}
