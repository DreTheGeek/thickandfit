'use server';

import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { logCoachAction } from '@/lib/coach/audit';
import { syncGhlPipelines, type SyncResult } from '@/lib/coach/ghl-sync';

/** In-app "Sync now" trigger for coaches. Runs the GHL -> Supabase pipeline sync. */
export async function runGhlSync(): Promise<SyncResult> {
  const ctx = await requireCoach();
  if (!ctx.companyId) {
    return { ok: false, pipelines: 0, stages: 0, opportunities: 0, linked: 0, unmatched: 0, error: 'no_company' };
  }
  // The GHL fetch helper throws on a non-OK response / rate limit. Never let that reach the client
  // as an unhandled error (it would blow up the Leads page on a transient GHL hiccup); degrade to a
  // handled failure so the button shows "sync failed" and the run is logged as an error.
  let result: SyncResult;
  try {
    result = await syncGhlPipelines(ctx.companyId);
  } catch (e) {
    result = {
      ok: false,
      pipelines: 0,
      stages: 0,
      opportunities: 0,
      linked: 0,
      unmatched: 0,
      error: e instanceof Error ? e.message : 'sync_failed',
    };
  }
  const sb = createServiceClient();
  logCoachAction(sb, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'ghl_sync',
    action: 'run',
    newState: result,
  });
  void sb.from('cron_job_log').insert({
    job_name: 'ghl-sync-manual',
    status: result.ok ? 'success' : 'error',
    detail: result,
  });
  if (result.ok) {
    revalidatePath('/coach/leads');
    revalidatePath('/coach');
  }
  return result;
}
