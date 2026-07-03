import type { ReactElement, ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { resolveAuth, COACH_ROLES } from '@/lib/auth/session';
import { SubscriberShell } from '@/components/app/subscriber-shell';
import { CoachShell } from '@/components/app/coach-shell';
import { TimezoneSync } from '@/components/app/timezone-sync';

// NOTE (paywall map): entitlement is enforced PER-PAGE via requireEntitled() on every training
// surface, not here - this layout only authenticates and picks the shell. A new (app) page MUST
// call requireEntitled/requireAuth/requireCoach itself (see src/lib/coach/system-map.ts).
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  const auth = await resolveAuth();
  if (!auth) redirect('/auth/sign-in');

  const shell = COACH_ROLES.includes(auth.role) ? (
    <CoachShell>{children}</CoachShell>
  ) : (
    <SubscriberShell>{children}</SubscriberShell>
  );
  return (
    <>
      <TimezoneSync />
      {shell}
    </>
  );
}
