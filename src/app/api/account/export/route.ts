// GET /api/account/export?type=food|weights -> CSV of the signed-in member's own logged data.
// Data portability (GDPR/CCPA friendly) + lets a member keep their history. Owner-scoped.
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { toCsv } from '@/lib/csv/csv';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const ctx = await requireAuth();
  const type = new URL(req.url).searchParams.get('type') === 'weights' ? 'weights' : 'food';
  const svc = createServiceClient();

  let headers: string[];
  let rows: (string | number | null)[][];
  let name: string;

  if (type === 'weights') {
    const { data } = await svc
      .from('weight_entries')
      .select('recorded_on, weight_kg, source')
      .eq('profile_id', ctx.userId)
      .order('recorded_on', { ascending: true })
      .limit(10000);
    headers = ['Date', 'Weight (kg)', 'Source'];
    rows = ((data ?? []) as { recorded_on: string; weight_kg: number; source: string | null }[]).map((w) => [w.recorded_on, w.weight_kg, w.source ?? '']);
    name = 'weights';
  } else {
    const { data } = await svc
      .from('food_log')
      .select('log_date, meal_slot, name, kcal, protein_g, carb_g, fat_g, grams, source')
      .eq('profile_id', ctx.userId)
      .order('log_date', { ascending: true })
      .limit(20000);
    headers = ['Date', 'Meal', 'Food', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Grams', 'Source'];
    rows = ((data ?? []) as { log_date: string; meal_slot: string | null; name: string | null; kcal: number; protein_g: number; carb_g: number; fat_g: number; grams: number | null; source: string | null }[]).map((f) => [
      f.log_date, f.meal_slot ?? '', f.name ?? '', f.kcal, f.protein_g, f.carb_g, f.fat_g, f.grams ?? '', f.source ?? '',
    ]);
    name = 'food-log';
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(headers, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="thickandfit-${name}-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
