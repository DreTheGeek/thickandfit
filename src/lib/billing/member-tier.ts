import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * What this member actually bought, resolved on the SERVER.
 *
 * THE RULE THIS ENFORCES, in the owner's words: the welcome message must come from entitlement
 * state, not from a generic onboarding flag on the client. Training-only gets training language.
 * Nutrition gets nutrition language. That is what stops the app promising a service somebody did not
 * pay for, which is a refund conversation and a trust problem rather than a copy bug.
 *
 * PRECEDENCE, strongest evidence first:
 *   1. A live subscription row. Real billing state, the only thing that proves a purchase.
 *   2. The tier recorded at onboarding. Her stated INTENT, and today it is all there is: Stripe is
 *      not configured, so nobody has been charged and no subscription exists. Read back from the
 *      database rather than taken from the request that is writing it, so the value has at least
 *      survived a round trip and cannot be posted straight into a promise by a modified client.
 *   3. Self-guided. The floor. Guessing DOWN is safe: the worst case is a member who paid for
 *      nutrition briefly seeing training-only language. Guessing UP promises coaching nobody sold.
 *
 * When Stripe goes live, step 1 starts answering and step 2 becomes the fallback it was meant to be.
 * Nothing about the call sites changes.
 */
export type MemberTier = 'self' | 'team' | 'steph';

/** The tiers that include nutrition coaching: custom meal plans and food-log review. */
export function includesNutrition(tier: MemberTier): boolean {
  return tier === 'team' || tier === 'steph';
}

function normalize(v: unknown): MemberTier | null {
  return v === 'self' || v === 'team' || v === 'steph' ? v : null;
}

export async function resolveMemberTier(companyId: string, profileId: string): Promise<MemberTier> {
  const svc = createServiceClient();

  // 1. Real billing state, from the PROFILE-keyed entitlements table.
  //
  // NOT client_subscriptions.product_type, deliberately. That table is contact-keyed and carries two
  // incompatible vocabularies at once: the Lenus import wrote basic / personalCoaching / bootcamp,
  // and nothing in this repo records which of those means which tier here. Guessing would hand
  // nutrition-coaching language to somebody on a training-only plan, which is precisely the promise
  // this function exists to prevent. That mapping is a conversation with Stephanie, not an
  // inference. entitlements is what the app itself writes when a purchase completes.
  const { data: ent, error: entErr } = await svc
    .from('entitlements')
    .select('product_key, status')
    .eq('company_id', companyId)
    .eq('profile_id', profileId)
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!entErr) {
    const t = normalize((ent as { product_key?: unknown } | null)?.product_key);
    if (t) return t;
  }

  // 2. Recorded intent, read back from the row rather than trusted from a request body.
  const { data: onb } = await svc
    .from('onboarding_responses')
    .select('answers')
    .eq('company_id', companyId)
    .eq('profile_id', profileId)
    .maybeSingle();
  const fromOnboarding = normalize(((onb?.answers ?? null) as { tier?: unknown } | null)?.tier);
  if (fromOnboarding) return fromOnboarding;

  // 3. The floor.
  return 'self';
}
