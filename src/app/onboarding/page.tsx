// Onboarding page. Requires auth (a client just signed up). Renders the live-prediction flow.
import { requireAuth } from '@/lib/auth/guards';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  await requireAuth();
  return (
    <main className="mx-auto max-w-xl px-6 py-12 text-black">
      <h1 className="mb-6 text-3xl font-bold uppercase tracking-tight">Let&apos;s build your plan</h1>
      <OnboardingFlow />
    </main>
  );
}
