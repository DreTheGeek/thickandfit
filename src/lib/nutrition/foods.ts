// Food search + portions (server). Reads the shared foods corpus (RLS: company_id IS NULL is
// readable by any authenticated user). Bilingual search over the lowercased search_text.
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { FoodLite, FoodPortion } from '@/lib/nutrition/macros';

export * from '@/lib/nutrition/macros';

type FoodRaw = {
  id: string;
  name_en: string;
  name_es: string | null;
  brand: string | null;
  category: string | null;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  density_g_per_ml: number | null;
};

function pickName(r: FoodRaw, locale: string): string {
  return (locale === 'es' ? r.name_es || r.name_en : r.name_en || r.name_es) || r.name_en;
}

function mapFood(r: FoodRaw, locale: string): FoodLite {
  return {
    id: r.id,
    name: pickName(r, locale),
    brand: r.brand,
    category: r.category,
    kcal: Number(r.kcal),
    proteinG: Number(r.protein_g),
    carbG: Number(r.carb_g),
    fatG: Number(r.fat_g),
    densityGPerMl: r.density_g_per_ml,
  };
}

const COLS = 'id, name_en, name_es, brand, category, kcal, protein_g, carb_g, fat_g, density_g_per_ml';

export async function searchFoods(query: string, locale: string): Promise<FoodLite[]> {
  const q = query.trim();
  const sb = await createClient();
  let req = sb.from('foods').select(COLS).limit(40);
  if (q) req = req.ilike('search_text', `%${q.toLowerCase()}%`);
  else req = req.order('name_en', { ascending: true });
  const { data, error } = await req;
  if (error) throw new Error(`searchFoods: ${error.message}`);
  return ((data ?? []) as unknown as FoodRaw[]).map((r) => mapFood(r, locale));
}

export async function getFoodWithPortions(
  id: string,
  locale: string,
): Promise<{ food: FoodLite; portions: FoodPortion[] } | null> {
  const sb = await createClient();
  const { data } = await sb.from('foods').select(COLS).eq('id', id).maybeSingle();
  if (!data) return null;
  const food = mapFood(data as unknown as FoodRaw, locale);
  const { data: pData } = await sb
    .from('food_portions')
    .select('id, label_en, label_es, grams, is_cooked, is_default')
    .eq('food_id', id)
    .order('is_default', { ascending: false });
  const portions: FoodPortion[] = ((pData ?? []) as { id: string; label_en: string; label_es: string | null; grams: number; is_cooked: boolean; is_default: boolean }[]).map((p) => ({
    id: p.id,
    label: (locale === 'es' ? p.label_es || p.label_en : p.label_en) || p.label_en,
    grams: Number(p.grams),
    isCooked: p.is_cooked,
    isDefault: p.is_default,
  }));
  return { food, portions };
}
