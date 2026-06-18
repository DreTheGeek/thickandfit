// Exercise search (authed). Filters by name, muscle group, equipment, difficulty.
// RLS scope applied manually (service client): shared system seed + this company's customs.
import { resolveAuth } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const muscle = searchParams.get('muscle');
  const equipment = searchParams.get('equipment');
  const difficulty = searchParams.get('difficulty');

  const supabase = createServiceClient();
  let query = supabase
    .from('exercises')
    .select('id, name_en, name_es, muscle_group, equipment, difficulty, video_mux_id, is_own_demo');

  query = ctx.companyId
    ? query.or(`company_id.is.null,company_id.eq.${ctx.companyId}`)
    : query.is('company_id', null);

  if (q) query = query.ilike('name_en', `%${q}%`);
  if (muscle) query = query.eq('muscle_group', muscle);
  if (equipment) query = query.eq('equipment', equipment);
  if (difficulty) query = query.eq('difficulty', difficulty);

  const { data } = await query.order('name_en', { ascending: true }).limit(60);
  return apiSuccess({ exercises: data ?? [] });
}
