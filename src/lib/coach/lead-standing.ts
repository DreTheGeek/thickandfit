// Pure lead/opportunity status helpers (client + server safe).
export type LeadStatus = 'open' | 'won' | 'lost' | 'abandoned';
export type LeadVariant = 'accent' | 'pending' | 'inactive';

export const LEAD_STATUSES = ['open', 'won', 'lost', 'abandoned'] as const;

/** Narrow an arbitrary string to a LeadStatus (single source of truth; unknown -> open). */
export function toLeadStatus(s: string | null): LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(s ?? '') ? (s as LeadStatus) : 'open';
}

export const LEAD_STATUS_VARIANT: Record<LeadStatus, LeadVariant> = {
  won: 'accent',
  open: 'pending',
  lost: 'inactive',
  abandoned: 'inactive',
};

export function leadStatusKey(status: string | null): string {
  switch (status) {
    case 'won':
      return 'oppStatusWon';
    case 'lost':
      return 'oppStatusLost';
    case 'abandoned':
      return 'oppStatusAbandoned';
    default:
      return 'oppStatusOpen';
  }
}

/** Slug used in the URL for pipeline switching, derived from the GHL pipeline name. */
export function pipelineSlug(name: string): string {
  return /re-?eng/i.test(name) ? 'reengagement' : 'marketing';
}
