// Onboarding page. Requires auth (a client just signed up). Renders the wizard,
// which owns its own full-screen chrome (progress + steps).
import type { ReactElement } from 'react';
import { requireAuth } from '@/lib/auth/guards';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage(): Promise<ReactElement> {
  await requireAuth();
  return <OnboardingFlow />;
}
