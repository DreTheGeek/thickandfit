'use server';
// Pause a member, and bring her back.
//
// Stephanie offers pauses and had several running when she asked how to record one on 2026-08-13:
// "I have a few clients that are paused... to resume on 9-8." The answer was "give it to me and I
// can put it in the system." Nothing in the system knew what a pause was, so the only place to put
// one of those women was 'canceled', which tells her she left.
//
// COACH-DRIVEN, not self-serve. A pause is an agreement between her and a member — a date, a reason,
// sometimes a price. Putting a "pause my account" button in the member app would let someone stop
// billing on a whim and would contradict whatever the two of them arranged, so the only way in is a
// coach doing it on the client record.
//
// WHAT IT DOES NOT DO: touch Stripe. This governs ACCESS, which is what entitlements are for. Whether
// the card also stops being charged is a separate decision per member — some of her pauses are unpaid
// breaks and some are paid holds — and silently cancelling a subscription from a button labelled
// "pause" would be the worst possible surprise. Stop the billing in Stripe deliberately, or leave it.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { logCoachAction } from '@/lib/coach/audit';
import { upsertEntitlement } from '@/lib/billing/entitlement';

export type PauseResult = { ok: true } | { ok: false; error: string };

const PauseInput = z.object({
  profileId: z.string().uuid(),
  // Optional: "pause me until I say" is a real arrangement, and forcing a date would make the coach
  // invent one. Null renders as an open-ended break rather than a blank.
  resumesOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  note: z.string().max(500).optional(),
});

/**
 * Put a member on a break. Idempotent: re-pausing updates the resume date rather than stacking rows,
 * because upsertEntitlement keys on (company_id, source, external_txn_id) and the id below is stable.
 */
export async function pauseMemberAction(input: unknown): Promise<PauseResult> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'noCompany' };
  const parsed = PauseInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { profileId, resumesOn, note } = parsed.data;

  const { ok } = await upsertEntitlement({
    companyId: ctx.companyId,
    profileId,
    source: 'manual',
    status: 'paused',
    // Stable and distinct from the comp grant's `comp:${profileId}`, so a pause never overwrites a
    // comp and re-pausing the same member updates one row instead of minting a second.
    externalTxnId: `pause:${profileId}`,
    // The resume date rides expires_at, matching how manual comps already use the column. Midday UTC
    // rather than midnight so a timezone shift cannot land it on the day before.
    expiresAt: resumesOn ? `${resumesOn}T12:00:00Z` : null,
    rawPayload: { pausedBy: ctx.userId, note: note ?? null },
  });
  if (!ok) return { ok: false, error: 'failed' };

  const svc = createServiceClient();
  logCoachAction(svc, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'entitlement',
    entityId: profileId,
    action: 'member.pause',
    newState: { status: 'paused', resumesOn: resumesOn ?? null },
  });

  revalidatePath('/coach/clients');
  return { ok: true };
}

const ResumeInput = z.object({ profileId: z.string().uuid() });

/**
 * End the break.
 *
 * REVOKES the pause grant rather than deleting it, so "who was paused when" survives, and does NOT
 * mint an active grant: her real entitlement is whatever Stripe, Apple or a comp already says. A
 * resume that invented access would keep serving a member whose subscription lapsed during the break.
 */
export async function resumeMemberAction(input: unknown): Promise<PauseResult> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'noCompany' };
  const parsed = ResumeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { profileId } = parsed.data;

  const svc = createServiceClient();
  const { error } = await svc
    .from('entitlements')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('company_id', ctx.companyId)
    .eq('profile_id', profileId)
    .eq('external_txn_id', `pause:${profileId}`)
    .eq('status', 'paused');
  if (error) {
    console.error('resumeMemberAction:', error.message);
    return { ok: false, error: 'failed' };
  }

  logCoachAction(svc, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'entitlement',
    entityId: profileId,
    action: 'member.resume',
    newState: { status: 'revoked' },
  });

  revalidatePath('/coach/clients');
  return { ok: true };
}
