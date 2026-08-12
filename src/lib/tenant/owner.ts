import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Who the member believes her coach is.
 *
 * WHY THIS FILE EXISTS. Two separate places decided this by sort order, and both were one accident
 * away from lying to a member on a product whose entire proposition is that Stephanie is your coach:
 *
 *   - The home screen's "Your coach" card ordered profiles by created_at across BOTH coach and
 *     operator, so it resolved to the OPERATOR ACCOUNT OF THE AGENCY THAT BUILT THE APP, a month
 *     older than Stephanie's. Maria Garcia's dashboard read "TU ENTRENADORA / LaSean".
 *   - The auto-seeded welcome message picked the oldest coach as its byline. That happened to be
 *     Stephanie by 36 minutes. Had the second coach account been created earlier that afternoon,
 *     every new member's first message from her would have been signed by a nameless dev account.
 *
 * Both comments already SAID "the owner, which for tenant 1 is Stephanie". Neither query expressed
 * it. Sort order is not an identity, so 0124 added companies.owner_profile_id and this reads it.
 *
 * The fallback keeps the old behaviour for a tenant whose owner is not set, minus the bug: an
 * operator is agency or platform staff and can never be the face of a company, so only a coach is
 * eligible. Returns null rather than inventing someone; every caller must already handle that,
 * because "no coach yet" is a real state for a company mid-setup.
 */
export type CoachIdentity = { id: string; name: string | null };

export async function getCompanyCoach(companyId: string): Promise<CoachIdentity | null> {
  const svc = createServiceClient();

  const { data: company } = await svc
    .from('companies')
    .select('owner_profile_id')
    .eq('id', companyId)
    .maybeSingle();

  const ownerId = (company as { owner_profile_id: string | null } | null)?.owner_profile_id ?? null;
  if (ownerId) {
    const { data: owner } = await svc
      .from('profiles')
      .select('id, full_name')
      .eq('id', ownerId)
      // Re-assert the company scope: owner_profile_id is a plain FK, and a mis-set row must not
      // become a way to surface a name from another tenant.
      .eq('company_id', companyId)
      .maybeSingle();
    const found = owner as { id: string; full_name: string | null } | null;
    if (found) return { id: found.id, name: (found.full_name ?? '').trim() || null };
  }

  const { data: fallback } = await svc
    .from('profiles')
    .select('id, full_name')
    .eq('company_id', companyId)
    .eq('role', 'coach')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const f = fallback as { id: string; full_name: string | null } | null;
  return f ? { id: f.id, name: (f.full_name ?? '').trim() || null } : null;
}
