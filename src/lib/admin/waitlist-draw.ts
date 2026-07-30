import 'server-only';
// Verifiable weighted draw for the Libra Season giveaways.
//
// The requirement that shapes every decision here: because entries are earned partly by REFERRAL,
// this is a real promotion with real exposure. "Trust me, it was random" is not an answer. So the
// draw is deterministic given (pool, seed):
//
//   1. Freeze the pool     - snapshot every eligible lead and their entry weight.
//   2. Hash the pool       - sha256 over a canonical "leadId:weight" join, sorted, so any later
//                            edit to the pool is detectable.
//   3. Draw a seed         - crypto.randomBytes at draw time. Unpredictable before, fixed after.
//   4. Select by weight    - a seeded PRNG walks the cumulative weight line.
//
// Anyone holding the snapshot + seed can rerun selectWinner() and land on the same lead. That is
// what makes the result publishable, and it is why Math.random() is not used anywhere here (it is
// both non-reproducible and banned in this codebase).
import { createHash, randomBytes } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';

export type DrawKind = 'early_bird' | 'main' | 'founding_final' | 'bonus';

/** One row of the frozen pool. Kept deliberately tiny: this is stored as jsonb per draw. */
export type PoolEntry = { leadId: string; weight: number };

export type DrawPool = {
  entries: PoolEntry[];
  entrantCount: number;
  totalEntries: number;
  poolHash: string;
};

export type DrawFilters = {
  /** Only leads who completed double-opt-in. Recommended: an unconfirmed email cannot be notified. */
  confirmedOnly: boolean;
  /** Only leads who converted to paying members. This is what makes the final draw founding-only. */
  convertedOnly: boolean;
  /** Drop obvious internal/test addresses so staff cannot win. */
  excludeTestAddresses: boolean;
};

export const DEFAULT_FILTERS: DrawFilters = {
  confirmedOnly: true,
  convertedOnly: false,
  excludeTestAddresses: true,
};

/** Addresses that must never win: our own QA seeds and internal domains. */
const TEST_PATTERNS = [/@test\.local$/i, /^qa-/i, /@kaldrbusiness\.com$/i, /@thickandfit\.test$/i];

function isTestAddress(email: string): boolean {
  return TEST_PATTERNS.some((re) => re.test(email));
}

/**
 * Freeze the eligible pool. Weight = entry_count (1 signup + 2 quiz + 3 per referral, capped at
 * 20 referrals upstream), floored at 1 so a lead with a corrupted zero count still has a chance
 * rather than silently vanishing from a draw they were told they were in.
 */
export async function buildPool(companyId: string, filters: DrawFilters): Promise<DrawPool> {
  const sb = createServiceClient();
  let q = sb
    .from('waitlist_leads')
    .select('id, email, entry_count, confirmed_at, converted_at')
    .eq('company_id', companyId)
    .is('unsubscribed_at', null);
  if (filters.confirmedOnly) q = q.not('confirmed_at', 'is', null);
  if (filters.convertedOnly) q = q.not('converted_at', 'is', null);

  const { data, error } = await q.limit(50_000);
  if (error) {
    console.error('buildPool:', error.message);
    return { entries: [], entrantCount: 0, totalEntries: 0, poolHash: hashPool([]) };
  }

  const rows = (data ?? []) as { id: string; email: string; entry_count: number | null }[];
  const entries: PoolEntry[] = [];
  for (const r of rows) {
    if (filters.excludeTestAddresses && isTestAddress(r.email)) continue;
    const weight = Math.max(1, Math.floor(Number(r.entry_count) || 1));
    entries.push({ leadId: r.id, weight });
  }
  // Sort by leadId so the snapshot (and therefore the hash) is stable regardless of DB row order.
  entries.sort((a, b) => (a.leadId < b.leadId ? -1 : a.leadId > b.leadId ? 1 : 0));

  return {
    entries,
    entrantCount: entries.length,
    totalEntries: entries.reduce((sum, e) => sum + e.weight, 0),
    poolHash: hashPool(entries),
  };
}

/** Canonical hash of a pool. Same pool always hashes the same; any weight or membership change does not. */
export function hashPool(entries: PoolEntry[]): string {
  const canonical = entries
    .slice()
    .sort((a, b) => (a.leadId < b.leadId ? -1 : a.leadId > b.leadId ? 1 : 0))
    .map((e) => `${e.leadId}:${e.weight}`)
    .join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

/** Unpredictable draw seed. 32 hex chars is plenty of entropy and stays readable in the audit row. */
export function newSeed(): string {
  return randomBytes(16).toString('hex');
}

/**
 * mulberry32, seeded from the first 8 hex chars of sha256(seed). Deterministic, uniform enough for a
 * giveaway, and tiny enough that a third party can reimplement it to verify a result. Returns a
 * float in [0, 1).
 */
function seededRandom(seed: string): () => number {
  const h = createHash('sha256').update(seed).digest('hex');
  let a = Number.parseInt(h.slice(0, 8), 16) >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Weighted selection over the frozen pool. Walks the cumulative weight line with one seeded draw.
 * Returns null for an empty pool (the caller surfaces "no eligible entrants" rather than crashing).
 *
 * Deterministic: same (entries, seed) always returns the same leadId. This is the verification hook.
 */
export function selectWinner(entries: PoolEntry[], seed: string): string | null {
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  if (total <= 0) return null;

  const rand = seededRandom(seed);
  // Multiply into the integer weight space so the comparison is exact rather than float-fuzzy.
  const target = Math.floor(rand() * total);
  let cursor = 0;
  for (const e of entries) {
    cursor += e.weight;
    if (target < cursor) return e.leadId;
  }
  // Unreachable unless float drift at the very top of the range; last entry is the correct fallback.
  return entries[entries.length - 1].leadId;
}

export type DrawRow = {
  id: string;
  kind: DrawKind;
  label: string;
  seed: string;
  poolHash: string;
  entrantCount: number;
  totalEntries: number;
  winnerLeadId: string | null;
  winnerEmail: string | null;
  winnerName: string | null;
  drawnAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  filters: DrawFilters | Record<string, unknown>;
};

/** Past draws, newest first. */
export async function listDraws(companyId: string): Promise<DrawRow[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('waitlist_draws')
    .select('id, kind, label, seed, pool_hash, entrant_count, total_entries, winner_lead_id, winner_email, winner_name, drawn_at, voided_at, void_reason, filters')
    .eq('company_id', companyId)
    .order('drawn_at', { ascending: false })
    .limit(50);
  if (error) {
    console.error('listDraws:', error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    kind: r.kind as DrawKind,
    label: r.label as string,
    seed: r.seed as string,
    poolHash: r.pool_hash as string,
    entrantCount: Number(r.entrant_count) || 0,
    totalEntries: Number(r.total_entries) || 0,
    winnerLeadId: (r.winner_lead_id as string | null) ?? null,
    winnerEmail: (r.winner_email as string | null) ?? null,
    winnerName: (r.winner_name as string | null) ?? null,
    drawnAt: r.drawn_at as string,
    voidedAt: (r.voided_at as string | null) ?? null,
    voidReason: (r.void_reason as string | null) ?? null,
    filters: (r.filters as Record<string, unknown>) ?? {},
  }));
}

export type VerifyResult =
  | { ok: true; recomputedWinnerLeadId: string; matches: boolean; poolHashMatches: boolean }
  | { ok: false; reason: string };

/**
 * Re-run a stored draw from its own snapshot and report whether it still produces the recorded
 * winner. This is the button an operator presses when someone questions the result: it proves the
 * pool has not been edited (hash) and that the winner follows from the seed (recompute).
 */
export async function verifyDraw(companyId: string, drawId: string): Promise<VerifyResult> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('waitlist_draws')
    .select('seed, pool_hash, pool_snapshot, winner_lead_id')
    .eq('company_id', companyId)
    .eq('id', drawId)
    .maybeSingle();
  if (error || !data) return { ok: false, reason: 'Draw not found.' };

  const row = data as { seed: string; pool_hash: string; pool_snapshot: unknown; winner_lead_id: string | null };
  const snapshot = Array.isArray(row.pool_snapshot) ? (row.pool_snapshot as PoolEntry[]) : [];
  if (snapshot.length === 0) return { ok: false, reason: 'Stored pool snapshot is empty or malformed.' };

  const recomputed = selectWinner(snapshot, row.seed);
  if (!recomputed) return { ok: false, reason: 'Could not recompute a winner from the snapshot.' };

  return {
    ok: true,
    recomputedWinnerLeadId: recomputed,
    matches: recomputed === row.winner_lead_id,
    poolHashMatches: hashPool(snapshot) === row.pool_hash,
  };
}

export const DRAW_LABELS: Record<DrawKind, string> = {
  early_bird: 'Early-bird (around Aug 18)',
  main: 'Main prize (doors open, Sept 27)',
  founding_final: 'Founding-members final (window close)',
  bonus: 'Bonus drawing',
};
