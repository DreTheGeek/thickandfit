'use server';

// Legacy-claim server action (WP13). Runs once after a legacy client sets their password from the
// invite link and lands on /claim. It:
//   1. Calls the claim_legacy_contact() SECURITY DEFINER RPC (0042), which reconciles auth.uid() with
//      the unclaimed legacy contact by email within the tenant (no-op for a genuinely new signup).
//   2. If a contact was claimed, kicks off that client's progress-photo import (their Lenus media).
// Both steps are idempotent: re-running claims nothing new and imports no duplicates.
import { after } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { autoAssignStarterProgram } from '@/lib/programs/auto-assign';
import { importLegacyPhotos } from '@/lib/legacy/photo-import';
import { indexMemberSources } from '@/lib/coach-ai/memory-index';

export type ClaimResult =
  | { status: 'claimed'; photosImported: number }
  | { status: 'not_legacy' } // signed in fine, but no legacy contact to claim (new user)
  | { status: 'error' };

export async function claimLegacyAction(): Promise<ClaimResult> {
  const ctx = await requireAuth();

  // The claim runs through the SSR (RLS-bound) client so the RPC sees auth.uid(); the function is
  // SECURITY DEFINER and self-scopes to the caller, so this is safe.
  const sb = await createClient();
  const { data, error } = await sb.rpc('claim_legacy_contact');
  if (error) {
    console.error('claimLegacyAction rpc:', error.message);
    return { status: 'error' };
  }

  const result = (data ?? {}) as { claimed?: boolean; lenus_id?: string | null };
  if (!result.claimed) return { status: 'not_legacy' };

  // Claimed: import this client's Lenus progress photos into their private gallery. The import uses
  // the service client (it reads the admin-only lenus schema and writes the private bucket).
  let photosImported = 0;
  if (ctx.companyId) {
    const svc = createServiceClient();
    const { data: profile } = await svc
      .from('profiles')
      .select('lenus_profile_id')
      .eq('id', ctx.userId)
      .maybeSingle();
    const lenusId = (profile?.lenus_profile_id as string | null) ?? result.lenus_id ?? null;
    const imp = await importLegacyPhotos(ctx.userId, ctx.companyId, lenusId);
    photosImported = imp.imported;

    // A STARTER PROGRAM, on the same terms as a new signup.
    //
    // autoAssignStarterProgram only ever ran from /api/onboarding/submit, and a migrating client
    // never goes through onboarding: she follows an invite, claims her account, and arrives with
    // her whole history and nothing to train. That is the worst possible first screen for the
    // person being asked to leave a platform she already pays for.
    //
    // Same function, so the same guarantees hold: inert unless STARTER_PROGRAM_ID is set, verifies
    // the plan belongs to this company, and NEVER overrides a coach. If Steph has already assigned
    // her something by hand, this does nothing.
    await autoAssignStarterProgram(ctx.companyId, ctx.userId);

    // Backfill this newly-claimed client's history into the coach's memory + graph now that their
    // Lenus data (contact-keyed) is queryable. Runs after the response so it never delays the claim;
    // bounded + capped so it completes, and the 6h reconciler keeps them fresh afterward. Best-effort.
    const companyId = ctx.companyId;
    const userId = ctx.userId;
    after(async () => {
      try {
        const svc = createServiceClient();
        const { data: contact } = await svc
          .from('contacts')
          .select('id')
          .eq('company_id', companyId)
          .eq('profile_id', userId)
          .limit(1)
          .maybeSingle();
        const contactId = (contact as { id: string } | null)?.id ?? null;
        await indexMemberSources({ companyId, profileId: userId, contactId });
      } catch (e) {
        console.error('claim memory backfill:', e instanceof Error ? e.message : e);
      }
    });
  }

  return { status: 'claimed', photosImported };
}
