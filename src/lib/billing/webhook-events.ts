// Webhook idempotency ledger. claimEvent inserts the event id once; a duplicate insert (replay)
// hits the UNIQUE constraint and returns alreadyProcessed=true so the handler no-ops.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

type ClaimResult = { alreadyProcessed: boolean };

/** Atomically claim a Stripe event. Returns alreadyProcessed when it has been seen before. */
export async function claimEvent(eventId: string, eventType: string): Promise<ClaimResult> {
  const svc = createServiceClient();
  const { error } = await svc
    .from('webhook_events')
    .insert({ stripe_event_id: eventId, event_type: eventType });
  if (error) {
    // 23505 = unique_violation -> we have already processed (or are processing) this event.
    if (error.code === '23505') return { alreadyProcessed: true };
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
