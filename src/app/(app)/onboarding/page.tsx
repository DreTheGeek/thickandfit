// Onboarding page. Requires auth (a client just signed up). Renders the wizard,
// which owns its own full-screen chrome (progress + steps).
import type { ReactElement } from 'react';
import { requireAuth } from '@/lib/auth/guards';
import { getSessionUser } from '@/lib/auth/session';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage(): Promise<ReactElement> {
  await requireAuth();
  // Prefill the name captured at signup (email form sets first/last; OAuth providers set full_name)
  // so the wizard never asks for it twice. The fields stay editable in the wizard.
  const user = await getSessionUser();
  const meta = (user?.user_metadata ?? {}) as {
    first_name?: string;
    last_name?: string;
    full_name?: string;
  };
  let first = (meta.first_name ?? '').trim();
  let last = (meta.last_name ?? '').trim();
  if (!first && meta.full_name) {
    const parts = meta.full_name.trim().split(/\s+/);
    first = parts[0] ?? '';
    last = parts.slice(1).join(' ');
  }
  return <OnboardingFlow initialFirstName={first} initialLastName={last} />;
}
