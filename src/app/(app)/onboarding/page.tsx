// Onboarding page. Requires auth (a client just signed up). Renders the live-prediction flow.
import { requireAuth } from '@/lib/auth/guards';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { PageHeader } from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  await requireAuth();
  return (
    <div className="mx-auto w-full max-w-xl px-6 py-10 md:px-10">
      <PageHeader
        title="Build your plan"
        subtitle="Answer a few questions to get your custom macros and a program that fits your life."
      />
      <OnboardingFlow />
    </div>
  );
}
