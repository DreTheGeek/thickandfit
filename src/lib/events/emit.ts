// Domain-event emitter (0063). Fire-and-forget BY CONSTRUCTION: emitEvent returns void, so no
// caller can ever await it onto a hot path, and every failure is swallowed here (telemetry must
// never break a request) - the same contract as inferences.ts and notifications/create.ts.
//
// The event-type union is the strict allowed list. hydration/supplement/biomarker/wearable events
// are deliberately NOT here yet: those product features do not exist. Add the type the day the
// feature ships; consumers never churn because the union only grows.
//
// No Zod here on purpose: events are constructed by trusted server code from already-validated
// inputs; the closed TS unions are the contract (Zod is for external input per house rules).
import 'server-only';
import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';

export type DomainEventType =
  | 'food_logged'
  | 'food_corrected'
  | 'workout_logged'
  | 'weight_logged'
  | 'checkin_submitted'
  | 'insight_generated'
  | 'protein_goal_hit'
  | 'micronutrient_low'
  | 'goal_updated'
  | 'recommendation_shown'
  | 'recommendation_accepted';

export type AggregateType =
  | 'food_log'
  | 'workout_log'
  | 'weight_entry'
  | 'form_response'
  | 'user_insight'
  | 'goal'
  | 'recommendation';

export type DomainEvent = {
  companyId: string;
  profileId?: string | null;
  type: DomainEventType;
  aggregateType: AggregateType;
  aggregateId?: string | null; // the row the event describes, when one exists
  payload?: Record<string, unknown>; // keep small; no PII beyond profile_id
  correlationId?: string | null; // e.g. the ai_inference_id that caused this event
  idempotencyKey?: string; // omit -> derived from type + aggregateId/payload + company
  source?: 'app' | 'cron' | 'coach' | 'system';
  locale?: string | null;
  timezoneOffsetMinutes?: number | null;
};

// Idempotency: a natural key over the aggregate row id is perfect dedupe (row ids are unique per
// insert, so a retried request that re-inserts nothing also re-emits nothing). When no row id
// exists, callers pass a stable natural key (e.g. profileId + UTC day for a daily cron event) or
// let this derive one from the identifying parts.
export function eventKey(type: DomainEventType, ...parts: (string | number)[]): string {
  return `${type}:${createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32)}`;
}

export function emitEvent(e: DomainEvent): void {
  void insertEvent(e).catch((err: unknown) => {
    console.error('emitEvent:', err instanceof Error ? err.message : String(err));
  });
}

async function insertEvent(e: DomainEvent): Promise<void> {
  const svc = createServiceClient();
  const key =
    e.idempotencyKey ??
    (e.aggregateId
      ? `${e.type}:${e.aggregateId}`
      : eventKey(e.type, JSON.stringify(e.payload ?? {}), e.companyId, e.profileId ?? ''));
  const { error } = await svc.from('domain_events').upsert(
    {
      company_id: e.companyId,
      profile_id: e.profileId ?? null,
      aggregate_id: e.aggregateId ?? null,
      aggregate_type: e.aggregateType,
      event_type: e.type,
      event_version: 1,
      payload: e.payload ?? {},
      correlation_id: e.correlationId ?? null,
      idempotency_key: key,
      source: e.source ?? 'app',
      locale: e.locale ?? null,
      timezone_offset_minutes: e.timezoneOffsetMinutes ?? null,
    },
    { onConflict: 'idempotency_key', ignoreDuplicates: true },
  );
  if (error) console.error('emitEvent insert:', error.message);
}
