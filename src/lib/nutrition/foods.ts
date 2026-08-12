// Food search + portions (server). Reads the shared foods corpus (RLS: company_id IS NULL is
// readable by any authenticated user). Bilingual search over the lowercased search_text.
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { foodStateFromName, type FoodLite, type FoodPortion, type FoodState } from '@/lib/nutrition/macros';
import { groundFoodByBarcode } from '@/lib/nutrition/external-foods';

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

  // PER-FOOD FIRST, then the category average.
  //
  // cooked_uncooked_ratios has had a food_id column since it was created and nothing ever selected
  // on it, so every per-food yield was unreachable and the whole table behaved as seven category
  // constants. That is fine for meat, where a category average is close enough, and useless for
  // vegetables: boiled broccoli holds 90% of its raw weight and boiled spinach 36%, so 0125 adds
  // the per-food rows and this reads them.
  let cookedFactor: number | null = null;
  const { data: byFood } = await sb
    .from('cooked_uncooked_ratios')
    .select('factor')
    .eq('food_id', raw.id)
    .eq('state_from', 'raw')
    .eq('state_to', 'cooked')
    .limit(1)
    .maybeSingle();
  if (byFood) cookedFactor = Number((byFood as { factor: number }).factor);
  else if (raw.category) {
    const { data: rData } = await sb
      .from('cooked_uncooked_ratios')
      .select('factor')
      .eq('category', raw.category)
      .is('food_id', null)
      .eq('state_from', 'raw')
      .eq('state_to', 'cooked')
      .limit(1)
      .maybeSingle();
    cookedFactor = rData ? Number((rData as { factor: number }).factor) : null;
  }

  // A food whose name states no cooking method ("Spinach", "Broccoli") is the RAW entry by USDA
  // convention, and that is the only reading under which a raw->cooked factor means anything. Left
  // as null the toggle never appeared, so every per-food yield above would have stayed invisible
  // even once it was reachable. Only inferred when a factor exists, so this cannot start guessing
  // about foods nobody has given a yield for.
  const named = foodStateFromName(`${raw.name_en} ${raw.name_es ?? ''}`);
  const foodState = named ?? (cookedFactor != null ? ('raw' as const) : null);

  return { food, portions, cookedFactor, foodState };
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

// Barcode lookup. Normalizes to digits, matches the local foods.barcode first, then falls back to
// Open Food Facts (2.5M packaged products, free) and caches the hit. The un-paywalled differentiator:
// any scanned barcode resolves straight to a loggable food, MyFitnessPal-style but without the paywall.
export async function lookupFoodByBarcode(barcode: string, locale: string): Promise<FoodLite | null> {
  const code = barcode.replace(/\D/g, '');
  if (!code) return null;
  const sb = await createClient();
  const { data, error } = await sb.from('foods').select(COLS).eq('barcode', code).limit(1).maybeSingle();
  if (error) throw new Error(`lookupFoodByBarcode: ${error.message}`);
  if (data) return mapFood(data as unknown as FoodRaw, locale);
  // Not in the local corpus -> Open Food Facts, cached into `foods` for next time.
  return groundFoodByBarcode(code, locale);
}

// The member's recently-logged distinct foods, newest first -> one-tap re-log. food_log is RLS
// owner-scoped, so the session client already limits it to the caller.
export async function getRecentFoods(userId: string, locale: string, limit = 8): Promise<FoodLite[]> {
  const sb = await createClient();
  const { data: logs } = await sb
    .from('food_log')
    .select('food_id, logged_at')
    .eq('profile_id', userId)
    .not('food_id', 'is', null)
    .order('logged_at', { ascending: false })
    .limit(80);
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const r of (logs ?? []) as { food_id: string }[]) {
    if (seen.has(r.food_id)) continue;
    seen.add(r.food_id);
    ids.push(r.food_id);
    if (ids.length >= limit) break;
  }
  if (ids.length === 0) return [];
  const { data } = await sb.from('foods').select(COLS).in('id', ids);
  const byId = new Map(((data ?? []) as unknown as FoodRaw[]).map((r) => [r.id, mapFood(r, locale)]));
  return ids.map((id) => byId.get(id)).filter((f): f is FoodLite => f != null);
}

// The member's starred foods (newest first) for one-tap re-log. RLS owner-scoped.
export async function getFavorites(userId: string, locale: string, limit = 12): Promise<FoodLite[]> {
  const sb = await createClient();
  const { data: favs } = await sb
    .from('user_food_favorites')
    .select('food_id')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  const ids = ((favs ?? []) as { food_id: string }[]).map((r) => r.food_id);
  if (ids.length === 0) return [];
  const { data } = await sb.from('foods').select(COLS).in('id', ids);
  const byId = new Map(((data ?? []) as unknown as FoodRaw[]).map((r) => [r.id, mapFood(r, locale)]));
  return ids.map((id) => byId.get(id)).filter((f): f is FoodLite => f != null);
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
