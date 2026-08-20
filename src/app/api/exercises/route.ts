// Exercise search (authed). Filters by name, muscle group, equipment, difficulty.
// RLS scope applied manually (service client): shared system seed + this company's customs.
import { resolveAuth } from '@/lib/auth/session';
import { withApiLog } from '@/lib/telemetry/request-log';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

async function GET_h(req: Request) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const muscle = searchParams.get('muscle');
  const equipment = searchParams.get('equipment');
  const difficulty = searchParams.get('difficulty');
  // Her starred movements. The table and its write action already existed for the coach console;
  // this is the member's half of the same feature.
  const onlyFavorites = searchParams.get('favorites') === '1';

  const supabase = createServiceClient();

  let favoriteIds: string[] | null = null;
  if (onlyFavorites) {
    const { data: favs } = await supabase
      .from('exercise_favorites')
      .select('exercise_id')
      .eq('profile_id', ctx.userId);
    favoriteIds = ((favs ?? []) as { exercise_id: string }[]).map((r) => r.exercise_id);
    // No stars is an empty list, not an unfiltered one. `.in()` with [] would return nothing anyway,
    // but returning early makes that a decision rather than an accident of PostgREST behaviour.
    if (favoriteIds.length === 0) return apiSuccess({ exercises: [] });
  }

  let query = supabase
    .from('exercises')
    .select('id, name_en, name_es, muscle_group, equipment, difficulty, video_mux_id, is_own_demo')
    // Curated out (0105). The single door behind the program builder and the exercise browser, so
    // one filter here covers both pickers.
    .is('archived_at', null);

  if (favoriteIds) query = query.in('id', favoriteIds);

  query = ctx.companyId
    ? query.or(`company_id.is.null,company_id.eq.${ctx.companyId}`)
    : query.is('company_id', null);

  if (q) {
    // Escape LIKE metacharacters so user input can't act as a wildcard / injection.
    const safeQ = q.replace(/[%_\\]/g, (c) => `\\${c}`);
    // Match either language so Spanish-speaking members find exercises by their ES name
    // (name_es is filled by WP13's es-fill; until then it is NULL and only name_en matches).
    query = query.or(`name_en.ilike.%${safeQ}%,name_es.ilike.%${safeQ}%`);
  }
  if (muscle) query = query.eq('muscle_group', muscle);
  if (equipment) query = query.eq('equipment', equipment);
  if (difficulty) query = query.eq('difficulty', difficulty);

  const { data } = await query.order('name_en', { ascending: true }).limit(60);
  return apiSuccess({ exercises: data ?? [] });
}

export const GET = withApiLog(GET_h);
