import type { ReactElement, ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { resolveAuth, COACH_ROLES } from '@/lib/auth/session';
import { SubscriberShell } from '@/components/app/subscriber-shell';
import { CoachShell } from '@/components/app/coach-shell';

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  const auth = await resolveAuth();
  if (!auth) redirect('/auth/sign-in');

  if (COACH_ROLES.includes(auth.role)) {
    return <CoachShell>{children}</CoachShell>;
  }
  return <SubscriberShell>{children}</SubscriberShell>;
}
