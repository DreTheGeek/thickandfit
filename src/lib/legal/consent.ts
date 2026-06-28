// Consent capture (anti-get-sued pillar). Records a timestamped, versioned acceptance of the Terms
// and Privacy Policy at sign-up, with IP + user-agent, into consent_captures. Server-only.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

// Bump whenever the Terms or Privacy Policy change so each acceptance is tied to the version in force.
export const CONSENT_VERSION = '2026-06-21';

/** Records Terms + Privacy consent for a newly signed-up user. Best-effort; never blocks sign-up. */
export async function recordSignupConsent(
  userId: string,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<void> {
  try {
    const sb = createServiceClient();
    // The handle_new_user trigger creates the profile (with company_id) on auth.users insert.
    const { data: profile } = await sb
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .maybeSingle();
    if (!profile?.company_id) return;
    const base = {
      company_id: profile.company_id,
      user_id: userId,
      consent_version: CONSENT_VERSION,
      accepted: true,
      ip_address: ipAddress,
      user_agent: userAgent,
    };
    await sb.from('consent_captures').insert([
      { ...base, consent_type: 'terms_of_service' },
      { ...base, consent_type: 'privacy_policy' },
    ]);
  } catch {
    // Non-blocking: a consent-logging failure must never fail the sign-up itself.
  }
}
