'use server';
// Draw actions. Three verbs: run a draw, void a draw, verify a draw.
//
// Running a draw is a one-way action in spirit (a winner gets announced publicly), so it is
// rate-limited hard, audited, and the UI asks twice. Voiding never deletes: the row stays with a
// reason, because an audit trail with holes in it is not an audit trail.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOperator } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { logCoachAction } from '@/lib/coach/audit';
import { buildPool, newSeed, selectWinner, verifyDraw } from '@/lib/admin/waitlist-draw';
import { DEFAULT_FILTERS, DRAW_LABELS, type DrawKind, type VerifyResult } from '@/lib/admin/draw-types';

export type RunDrawResult =
  | { ok: true; drawId: string; winnerEmail: string | null; winnerName: string | null; entrantCount: number; totalEntries: number }
  | { ok: false; error: string };

const runSchema = z.object({
  kind: z.enum(['early_bird', 'main', 'founding_final', 'bonus']),
  confirmedOnly: z.boolean().optional(),
  convertedOnly: z.boolean().optional(),
  excludeTestAddresses: z.boolean().optional(),
});

const ERRORS: Record<string, string> = {
  invalid: 'Invalid draw request.',
  no_company: 'No company scope on your account.',
  rate_limited: 'Too many draws in a short window. Wait a minute.',
  empty_pool: 'No eligible entrants match those filters. Nothing was drawn.',
  failed: 'Could not record the draw. Nothing was drawn.',
};

/**
 * Run a draw: freeze the pool, mint a seed, select the winner, persist everything needed to
 * recompute it. Returns the winner so the operator can announce immediately.
 */
export async function runDrawAction(input: unknown): Promise<RunDrawResult> {
  const parsed = runSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERRORS.invalid };
  const ctx = await requireOperator();
  if (!ctx.companyId) return { ok: false, error: ERRORS.no_company };
  // 10/hour: a draw is a rare, deliberate, publicly-visible act.
  if (!(await checkRateLimit(ctx.userId, 'admin-run-draw', 10, 3600, { failClosed: true }))) {
    return { ok: false, error: ERRORS.rate_limited };
  }

  const kind = parsed.data.kind as DrawKind;
  const filters = {
    confirmedOnly: parsed.data.confirmedOnly ?? DEFAULT_FILTERS.confirmedOnly,
    convertedOnly: parsed.data.convertedOnly ?? DEFAULT_FILTERS.convertedOnly,
    excludeTestAddresses: parsed.data.excludeTestAddresses ?? DEFAULT_FILTERS.excludeTestAddresses,
  };

  const pool = await buildPool(ctx.companyId, filters);
  if (pool.entrantCount === 0) return { ok: false, error: ERRORS.empty_pool };

  const seed = newSeed();
  const winnerLeadId = selectWinner(pool.entries, seed);
  if (!winnerLeadId) return { ok: false, error: ERRORS.empty_pool };

  const sb = createServiceClient();

  // Resolve the winner's identity for the record (and so the operator can contact them).
  const { data: winnerRow } = await sb
    .from('waitlist_leads')
    .select('email, first_name, last_name, instagram_handle')
    .eq('company_id', ctx.companyId)
    .eq('id', winnerLeadId)
    .maybeSingle();
  const winner = winnerRow as { email: string; first_name: string | null; last_name: string | null; instagram_handle: string | null } | null;
  const winnerName = [winner?.first_name, winner?.last_name].filter(Boolean).join(' ').trim() || null;

  const { data: inserted, error } = await sb
    .from('waitlist_draws')
    .insert({
      company_id: ctx.companyId,
      kind,
      label: DRAW_LABELS[kind],
      seed,
      pool_hash: pool.poolHash,
      pool_snapshot: pool.entries,
      entrant_count: pool.entrantCount,
      total_entries: pool.totalEntries,
      filters,
      winner_lead_id: winnerLeadId,
      winner_email: winner?.email ?? null,
      winner_name: winnerName,
      drawn_by: ctx.userId,
    })
    .select('id')
    .single();
  if (error || !inserted) {
    console.error('runDrawAction insert:', error?.message);
    return { ok: false, error: ERRORS.failed };
  }

  logCoachAction(sb, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'waitlist_draw',
    entityId: (inserted as { id: string }).id,
    action: 'admin.run_draw',
    newState: {
      kind,
      seed,
      pool_hash: pool.poolHash,
      entrant_count: pool.entrantCount,
      total_entries: pool.totalEntries,
      winner_email: winner?.email ?? null,
      filters,
    },
  });

  revalidatePath('/admin/waitlist/draws');
  return {
    ok: true,
    drawId: (inserted as { id: string }).id,
    winnerEmail: winner?.email ?? null,
    winnerName,
    entrantCount: pool.entrantCount,
    totalEntries: pool.totalEntries,
  };
}

const voidSchema = z.object({ drawId: z.string().uuid(), reason: z.string().trim().min(3).max(400) });

/** Void a draw (winner ineligible, duplicate, rules violation). The row is retained with a reason. */
export async function voidDrawAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Give a reason of at least 3 characters.' };
  const ctx = await requireOperator();
  if (!ctx.companyId) return { ok: false, error: ERRORS.no_company };

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('waitlist_draws')
    .update({ voided_at: new Date().toISOString(), void_reason: parsed.data.reason })
    .eq('company_id', ctx.companyId)
    .eq('id', parsed.data.drawId)
    .is('voided_at', null)
    .select('id, winner_email');
  if (error) {
    console.error('voidDrawAction:', error.message);
    return { ok: false, error: ERRORS.failed };
  }
  if ((data ?? []).length === 0) return { ok: false, error: 'That draw is already voided or does not exist.' };

  logCoachAction(sb, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'waitlist_draw',
    entityId: parsed.data.drawId,
    action: 'admin.void_draw',
    newState: { reason: parsed.data.reason },
  });
  revalidatePath('/admin/waitlist/draws');
  return { ok: true };
}

/** Recompute a stored draw from its own snapshot + seed. Read-only proof of fairness. */
export async function verifyDrawAction(drawId: unknown): Promise<VerifyResult> {
  const parsed = z.string().uuid().safeParse(drawId);
  if (!parsed.success) return { ok: false, reason: 'Invalid draw id.' };
  const ctx = await requireOperator();
  if (!ctx.companyId) return { ok: false, reason: 'No company scope on your account.' };
  return verifyDraw(ctx.companyId, parsed.data);
}
