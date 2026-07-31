import 'server-only';
// The single tenant lookup.
//
// Stephanie is company 1 and the architecture stays multi-tenant for a later white-label, so every
// server path that writes on behalf of a PUBLIC (unauthenticated) caller has to resolve the company
// id the same way. This was a private helper inside funnel/service.ts; support intake needs the
// identical lookup, and a second copy is how the two drift apart the day the slug changes.
//
// Authenticated paths must NOT use this: they take company_id from the caller's own AuthContext,
// which is what keeps tenant isolation honest.
import { createServiceClient } from '@/lib/supabase/service';

export const TENANT_SLUG = 'thick-and-fit';

export async function resolveTenantId(): Promise<string> {
  const supabase = createServiceClient();
  const { data } = await supabase.from('companies').select('id').eq('slug', TENANT_SLUG).maybeSingle();
  if (!data) throw new Error('tenant: not configured');
  return (data as { id: string }).id;
}
