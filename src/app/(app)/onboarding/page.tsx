// Onboarding page. Requires auth (a client just signed up). Renders the wizard,
// which owns its own full-screen chrome (progress + steps).
import type { ReactElement } from 'react';
import { requireAuth } from '@/lib/auth/guards';
import { getSessionUser } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/service';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage(): Promise<ReactElement> {
  const ctx = await requireAuth();
  // Prefill the member's name so the wizard never asks for it twice. The fields stay editable.
  //
  // profiles.full_name FIRST, auth metadata second. That order matters and was previously reversed.
  // Auth user_metadata is written once at signup and nothing in the app ever updates it, while
  // profiles.full_name is the canonical record: it is what the dashboard greets you with, what the
  // coach console lists, and what onboarding itself writes on submit. With metadata winning, a name
  // corrected anywhere in the app was silently ignored here and the wizard prefilled the stale one.
  // Observed 2026-07-31: an account renamed to "LaSean Pickens" still onboarded as "LaSean Test".
  const { data: p } = await createServiceClient()
    .from('profiles')
    .select('full_name')
    .eq('id', ctx.userId)
    .maybeSingle();
  let fullName = ((p as { full_name?: string | null } | null)?.full_name ?? '').trim();

  let first = '';
  let last = '';
  if (!fullName) {
    // No profile name yet (the usual case on a fresh signup): fall back to what the signup form or
    // the OAuth provider put in auth metadata.
    const user = await getSessionUser();
    const meta = (user?.user_metadata ?? {}) as {
      first_name?: string;
      last_name?: string;
      full_name?: string;
    };
    first = (meta.first_name ?? '').trim();
    last = (meta.last_name ?? '').trim();
    fullName = (meta.full_name ?? '').trim();
  }
  if (!first && fullName) {
    const parts = fullName.split(/\s+/);
    first = parts[0] ?? '';
    last = parts.slice(1).join(' ');
  }
  return <OnboardingFlow initialFirstName={first} initialLastName={last} />;
}
