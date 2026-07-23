// Eating-disorder screen: the single source of truth for whether a member gets the gentle,
// behavior-first posture. The coach persona already reads this to soften its language (see
// coach-ai/context.ts). The member-facing surfaces (You, Evolution) read the SAME signal so the UI
// matches the coaching: a member the coach handles gently should never be shown a shrinking-number
// hero or a weight loss celebrated in the success colour.
//
// Clinical basis: the migrated Lenus rows hold up to five SCOFF booleans (cutoff: >=2 positives).
// The in-app intake instead stores an explicit self-report, so one strong signal (a stated difficult
// relationship with food, or a preference for light tracking) also flips gentle on. Read
// defensively: a missing or empty payload is a negative screen.
import { createServiceClient } from '@/lib/supabase/service';

const SCOFF_KEYS = [
  'foodDomination',
  'recentWeightLost',
  'feelSickWhenNotFull',
  'selfDoubtOverWeight',
  'worryLostEatingControl',
] as const;

/** True when the eating_disorder_screening jsonb indicates a difficult relationship with food. */
export function scoffPositive(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.disorderedEatingHistory === true || payload.prefersLightTracking === true) return true;
  let flags = 0;
  for (const k of SCOFF_KEYS) if (payload[k] === true) flags += 1;
  return flags >= 2;
}

/**
 * Whether the current member should get the gentle, non-weight-forward framing on their own screens.
 * Resolves the member's single intake row via their CRM contact (same path as the health profile).
 * Fails safe to `false` (standard framing) if anything is missing, but NEVER throws: a lookup error
 * must not blank a member's profile.
 */
export async function prefersGentleFraming(profileId: string, companyId: string): Promise<boolean> {
  try {
    const svc = createServiceClient();
    const { data: contact } = await svc
      .from('contacts')
      .select('id')
      .eq('company_id', companyId)
      .eq('profile_id', profileId)
      .limit(1)
      .maybeSingle();
    const contactId = (contact as { id: string } | null)?.id ?? null;
    if (!contactId) return false;
    const { data } = await svc
      .from('client_intake')
      .select('eating_disorder_screening')
      .eq('company_id', companyId)
      .eq('contact_id', contactId)
      .maybeSingle();
    const eds = (data as { eating_disorder_screening: Record<string, unknown> | null } | null)
      ?.eating_disorder_screening;
    return scoffPositive(eds);
  } catch {
    return false;
  }
}
