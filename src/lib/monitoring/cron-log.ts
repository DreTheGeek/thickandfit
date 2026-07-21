// Cron run audit log with LOUD failures. The internal routes previously inserted into
// cron_job_log directly and discarded the result; when the insert started failing in prod
// (2026-07-08) the audit trail died silently while the jobs kept running, leaving ops blind.
// Every failure now lands in the function logs so the next run reveals the root cause.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

export type CronStatus = 'success' | 'error' | 'skipped';

export async function logCronRun(
  jobName: string,
  status: CronStatus,
  detail?: unknown,
): Promise<void> {
  try {
    const { error } = await createServiceClient()
      .from('cron_job_log')
      .insert({ job_name: jobName, status, detail: detail ?? null });
    if (error) console.error(`[cron_job_log] ${jobName} insert failed: ${error.message}`);
  } catch (e) {
    console.error(`[cron_job_log] ${jobName} insert threw:`, e instanceof Error ? e.message : e);
  }
}
