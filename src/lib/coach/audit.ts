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
  void client
    .from('audit_log')
    .insert({
      company_id: params.companyId,
      user_id: params.userId,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      action: params.action,
      previous_state: params.previousState ?? null,
      new_state: params.newState ?? null,
    })
    .then(() => undefined);
}
