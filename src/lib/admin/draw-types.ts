// Client-safe constants + types for the giveaway draws. These MUST live outside waitlist-draw.ts:
// that module is `import 'server-only'` (it touches node:crypto and the service client), so a
// 'use client' component importing a runtime VALUE from it pulls the whole server module into the
// browser bundle and the build fails with "'server-only' cannot be imported from a Client
// Component module". Types alone would be fine (erased at compile), but DRAW_LABELS is a value.
//
// Same split as src/lib/admin/access-types.ts, for the same reason.

export type DrawKind = 'early_bird' | 'main' | 'founding_final' | 'bonus';

/** One row of a frozen draw pool. Stored as jsonb per draw. */
export type PoolEntry = { leadId: string; weight: number };

export type DrawFilters = {
  /** Only leads who completed double-opt-in. An unconfirmed email cannot be notified. */
  confirmedOnly: boolean;
  /** Only leads who converted to paying members. This is what makes the final draw founding-only. */
  convertedOnly: boolean;
  /** Drop internal/test addresses so staff cannot win. */
  excludeTestAddresses: boolean;
};

export const DEFAULT_FILTERS: DrawFilters = {
  confirmedOnly: true,
  convertedOnly: false,
  excludeTestAddresses: true,
};

export const DRAW_LABELS: Record<DrawKind, string> = {
  early_bird: 'Early-bird (around Aug 18)',
  main: 'Main prize (doors open, Sept 27)',
  founding_final: 'Founding-members final (window close)',
  bonus: 'Bonus drawing',
};

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

export type VerifyResult =
  | { ok: true; recomputedWinnerLeadId: string; matches: boolean; poolHashMatches: boolean }
  | { ok: false; reason: string };
