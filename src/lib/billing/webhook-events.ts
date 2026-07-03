// Webhook idempotency ledger. claimEvent inserts the event id once; a duplicate insert (replay)
// hits the UNIQUE constraint. CRITICAL nuance: a claimed row is only "already processed" when the
// handler actually SUCCEEDED (processed_at set, error null). A failed attempt keeps its row (for
// observability) but is RECLAIMABLE, so Stripe's retry re-runs the idempotent handlers instead of
// hitting a duplicate 200 forever - the old behavior permanently dropped a money/entitlement event
// after one transient DB blip (customer charged, never entitled).
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

type ClaimResult = { alreadyProcessed: boolean };

/** Atomically claim a Stripe event. Returns alreadyProcessed only when a prior attempt SUCCEEDED. */
export async function claimEvent(eventId: string, eventType: string): Promise<ClaimResult> {
  const svc = createServiceClient();
  const { error } = await svc
    .from('webhook_events')
    .insert({ stripe_event_id: eventId, event_type: eventType });
  if (error) {
    if (error.code === '23505') {
      // Row exists: succeeded before (no-op), or failed/in-flight (reclaim so the retry re-runs).
      const { data } = await svc
        .from('webhook_events')
        .select('processed_at, error')
        .eq('stripe_event_id', eventId)
        .maybeSingle();
      const row = data as { processed_at: string | null; error: string | null } | null;
      const succeeded = Boolean(row?.processed_at) && !row?.error;
      return { alreadyProcessed: succeeded };
    }
    // Any other error: treat as not-claimed so Stripe retries rather than silently dropping.
    throw new Error(`Failed to claim webhook event: ${error.message}`);
  }
  return { alreadyProcessed: false };
}

/** Mark an event as fully processed (or record the error for observability). */
export async function markEventProcessed(eventId: string, errorMessage?: string): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from('webhook_events')
    .update({ processed_at: new Date().toISOString(), error: errorMessage ?? null })
    .eq('stripe_event_id', eventId);
}
