// Authenticated endpoint. Validates SHA-256 API key, returns the key's company scope.
// Demonstrates AC-1 (auth + consistent shape) and AC-3 (usage logging with real status + latency).
import { validateApiKey, bearerFrom, apiSuccess, apiError, logApiUsage } from '@/lib/api/auth';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const start = Date.now();
  const ctx = await validateApiKey(bearerFrom(req));

  if (!ctx) {
    logApiUsage({
      companyId: null,
      apiKeyId: null,
      route: '/api/v1/me',
      method: 'GET',
      statusCode: 401,
      latencyMs: Date.now() - start,
    });
    return apiError('Unauthorized', 401);
  }

  const supabase = createServiceClient();
  const { data: company } = await supabase
    .from('companies')
    .select('id, name, slug')
    .eq('id', ctx.companyId)
    .maybeSingle();

  logApiUsage({
    companyId: ctx.companyId,
    apiKeyId: ctx.apiKeyId,
    route: '/api/v1/me',
    method: 'GET',
    statusCode: 200,
    latencyMs: Date.now() - start,
  });

  return apiSuccess({ company, api_key_id: ctx.apiKeyId });
}
