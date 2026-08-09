import 'server-only';
import type { createServiceClient } from '@/lib/supabase/service';

type Svc = ReturnType<typeof createServiceClient>;

/**
 * Who owns the shared catalog.
 *
 * `exercises.company_id` is deliberately nullable and is NULL on all 1,259 production rows. The
 * read policy is `company_id IS NULL OR company_id = current_company_id()`, so NULL means "a shared
 * catalog row any tenant may READ". The service client bypasses RLS, so anything running on it has
 * to apply that rule itself, and both obvious spellings are wrong:
 *
 *   1. `company_id = X` matches zero rows. A write reports success and changes nothing; a read
 *      reports success and returns nothing.
 *   2. Restating the read policy verbatim matches every shared row for EVERY company. Readable is
 *      not the same as writable, and it is not the same as copy-into-their-corpus either. RLS Test
 *      Tenant B has a live subscriber; Stephanie's 367 movements and her cues are the product.
 *
 * So: a tenant always owns its own rows, and the shared NULL-company catalog belongs to the primary
 * tenant only, resolved as the oldest company rather than a hardcoded uuid ("Stephanie is tenant 1,
 * architecture supports white-label later"). A white-label tenant that later authors its own
 * library gets its own rows and none of hers.
 *
 * First written for the corpus indexer in `coach-ai/memory-index.ts`; extracted here when the
 * filming tracker needed the same rule, because a security rule with two copies has one that drifts.
 */
export async function primaryCompanyId(svc: Svc): Promise<string | null> {
  const { data } = await svc
    .from('companies')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * A PostgREST `.or()` filter naming every catalog row this company may act on.
 *
 * The primary tenant gets the shared rows plus its own. Everyone else gets only their own, which is
 * why this returns a string that is always safe to pass straight to `.or()`.
 */
export async function sharedCatalogScope(svc: Svc, companyId: string): Promise<string> {
  const primary = await primaryCompanyId(svc);
  return primary === companyId ? `company_id.is.null,company_id.eq.${companyId}` : `company_id.eq.${companyId}`;
}
