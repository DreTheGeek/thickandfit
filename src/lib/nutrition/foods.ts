// Food search + portions (server). Reads the shared foods corpus (RLS: company_id IS NULL is
// readable by any authenticated user). Bilingual search over the lowercased search_text.
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { foodStateFromName, type FoodLite, type FoodPortion, type FoodState } from '@/lib/nutrition/macros';

export * from '@/lib/nutrition/macros';

export type FoodDetail = { food: FoodLite; portions: FoodPortion[]; cookedFactor: number | null; foodState: FoodState | null };

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

export async function getFoodDetail(id: string, locale: string): Promise<FoodDetail | null> {
  const sb = await createClient();
  const { data } = await sb.from('foods').select(COLS).eq('id', id).maybeSingle();
  if (!data) return null;
  const raw = data as unknown as FoodRaw & { category: string | null };
  const food = mapFood(raw, locale);

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

  let cookedFactor: number | null = null;
  if (raw.category) {
    const { data: rData } = await sb
      .from('cooked_uncooked_ratios')
      .select('factor')
      .eq('category', raw.category)
      .eq('state_from', 'raw')
      .eq('state_to', 'cooked')
      .limit(1)
      .maybeSingle();
    cookedFactor = rData ? Number((rData as { factor: number }).factor) : null;
  }

  return { food, portions, cookedFactor, foodState: foodStateFromName(`${raw.name_en} ${raw.name_es ?? ''}`) };
}

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

// Manual barcode lookup. Normalizes the entry (digits only), then matches foods.barcode. The
// un-paywalled differentiator: any logged barcode resolves straight to a loggable food.
export async function lookupFoodByBarcode(barcode: string, locale: string): Promise<FoodLite | null> {
  const code = barcode.replace(/\D/g, '');
  if (!code) return null;
  const sb = await createClient();
  const { data, error } = await sb.from('foods').select(COLS).eq('barcode', code).limit(1).maybeSingle();
  if (error) throw new Error(`lookupFoodByBarcode: ${error.message}`);
  if (!data) return null;
  return mapFood(data as unknown as FoodRaw, locale);
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
