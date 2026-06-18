// Public health check. No auth. Consistent { ok, data } shape.
import { apiSuccess } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

export function GET() {
  return apiSuccess({ status: 'ok', service: 'thickandfit-api', version: 'v1' });
}
