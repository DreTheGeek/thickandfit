// Thin JS helper for the existing audit_log table (the DB trigger only covers a few tables).
// Fire-and-forget per the codebase side-effect convention (void). Every coach mutation calls this.
import 'server-only';
import type { createServiceClient } from '@/lib/supabase/service';

type ServiceClient = ReturnType<typeof createServiceClient>;

export function logCoachAction(
  client: ServiceClient,
  params: {
    companyId: string;
    userId: string;
    entityType: string;
    entityId?: string | null;
    action: string;
    previousState?: unknown;
    newState?: unknown;
  },
): void {
  void writeAudit(client, params);
}

/**
 * The same write, AWAITED.
 *
 * Fire-and-forget is fine for a log nobody will be asked about. It is not fine on this platform for
 * one that matters: a floating promise created just before a serverless response is returned can be
 * killed when the function freezes, and the write simply never happens. Measured, not assumed - an
 * invite that really did send an email left NO audit row at all, while the database trigger's own
 * rows from the same second landed normally.
 *
 * Use this for anything a person could later be asked to account for: money, access, deletion, or
 * mail going out to real clients. It costs one round trip.
 */
export async function logCoachActionNow(
  client: ServiceClient,
  params: Parameters<typeof logCoachAction>[1],
): Promise<void> {
  await writeAudit(client, params);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function writeAudit(
  client: ServiceClient,
  params: Parameters<typeof logCoachAction>[1],
): Promise<void> {
  /**
   * entity_id is a UUID COLUMN, and the parameter type is `string`.
   *
   * Passing anything else - an email address, "batch:50" - makes Postgres reject the whole INSERT,
   * so the audit row for that action simply does not exist. That happened: an invite really sent an
   * email to a real address and nothing recorded who sent it, while the database trigger's own rows
   * from the same second landed fine.
   *
   * Losing the id is bad. Losing the ENTIRE RECORD of a launch action because the id was the wrong
   * shape is much worse, so a non-uuid is dropped into new_state and the row is written anyway.
   */
  let entityId = params.entityId ?? null;
  let extra = params.newState;
  if (entityId != null && !UUID.test(entityId)) {
    console.error(`[audit_log] entity_id is not a uuid (${entityId}); keeping it in new_state`);
    extra = { ...(typeof extra === 'object' && extra ? extra : {}), entity_ref: entityId };
    entityId = null;
  }

  const { error } = await client.from('audit_log').insert({
    company_id: params.companyId,
    user_id: params.userId,
    entity_type: params.entityType,
    entity_id: entityId,
    action: params.action,
    previous_state: params.previousState ?? null,
    new_state: extra ?? null,
  });
  // Never throws. An audit write that fails must not take down the action it is recording; it must
  // be loud instead, which is the whole reason this is not swallowed silently.
  if (error) console.error('[audit_log] write failed', error.message);
}
