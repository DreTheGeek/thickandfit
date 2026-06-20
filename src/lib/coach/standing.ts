// Pure, framework-agnostic client-standing helpers. Imported by both the server data layer
// (clients.ts) and client components (status-pill.tsx), so it carries no 'server-only' or
// 'use client' directive. One canonical definition of healthy / at-risk / churned.
export type Standing = 'healthy' | 'at_risk' | 'churned';
export type StandingVariant = 'accent' | 'pending' | 'inactive';

const AT_RISK_HEALTH = new Set(['lapsed', 'due-soon/late']);

/** The single source of truth for a client's standing, from subscription status + billing health. */
export function deriveStanding(status: string | null, health: string | null): Standing {
  const s = status ?? '';
  const h = health ?? '';
  if (s === 'canceled' || s === 'churned') return 'churned';
  if (s === 'past_due' || s === 'unpaid') return 'at_risk';
  if (s === 'active') return AT_RISK_HEALTH.has(h) ? 'at_risk' : 'healthy';
  return 'churned';
}

export const STANDING_VARIANT: Record<Standing, StandingVariant> = {
  healthy: 'accent',
  at_risk: 'pending',
  churned: 'inactive',
};

/** i18n key (app.coach.*) for the specific subscription status label. */
export function statusLabelKey(status: string | null): string {
  switch (status) {
    case 'active':
      return 'statusActive';
    case 'past_due':
      return 'statusPastDue';
    case 'unpaid':
      return 'statusUnpaid';
    case 'canceled':
      return 'statusCanceled';
    case 'churned':
      return 'statusChurned';
    default:
      return 'statusUnknown';
  }
}
