// Recipe Library server data layer. One read of recipes (macros precomputed at import), then
// filter/sort/facet/paginate in memory. company_id pinned from requireCoach ctx. Pure types in
// recipes-types.ts (re-exported).
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { clampPage, type Bucket } from '@/lib/coach/clients-types';
import {
  HIGH_PROTEIN_G,
  qualityBand,
  type RecipeBookCard,
  type RecipeDetail,
  type RecipeFacets,
  type RecipeFilters,
  type RecipeIngredient,
  type RecipeRow,
  type RecipesPage,
} from '@/lib/coach/recipes-types';

export * from '@/lib/coach/recipes-types';

type RecipeRaw = {
  id: string;
  name_en: string | null;
  name_es: string | null;
  image_url: string | null;
  category: string | null;
  recipe_book_name: string | null;
  kcal: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
  total_time_minutes: number | null;
  has_video: boolean | null;
  ingredient_count: number | null;
  search_text: string | null;
  servings: number | null;
  quality_score: number | null;
};

const RECIPE_COLS =
  'id, name_en, name_es, image_url, category, recipe_book_name, kcal, protein_g, carb_g, fat_g, total_time_minutes, has_video, ingredient_count, search_text, servings, quality_score';

// One read of the caller's favorite recipe ids. Uses the RLS-scoped service client filtered by
// profile_id so each subscriber/coach sees only their own favorites.
async function favoriteIds(companyId: string, profileId: string): Promise<Set<string>> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('recipe_favorites')
    .select('recipe_id')
    .eq('company_id', companyId)
    .eq('profile_id', profileId);
  return new Set(((data ?? []) as { recipe_id: string }[]).map((r) => r.recipe_id));
}

function pickName(en: string | null, es: string | null, locale: string): string {
  // empty fallback; the component supplies a locale-aware label (t('recipeUntitled'))
  return (locale === 'es' ? es || en : en || es) || '';
}

function mapRow(r: RecipeRaw, locale: string, favs: Set<string>): RecipeRow {
  const score = r.quality_score ?? 0;
  return {
    id: r.id,
    name: pickName(r.name_en, r.name_es, locale),
    image: r.image_url,
    category: r.category,
    bookName: r.recipe_book_name,
    kcal: r.kcal ?? 0,
    proteinG: Number(r.protein_g ?? 0),
    carbG: Number(r.carb_g ?? 0),
    fatG: Number(r.fat_g ?? 0),
    totalTime: r.total_time_minutes ?? 0,
    hasVideo: r.has_video ?? false,
    ingredientCount: r.ingredient_count ?? 0,
    servings: r.servings ?? 1,
    qualityScore: score,
    qualityBand: qualityBand(score),
    isFavorite: favs.has(r.id),
  };
}

function tally(rows: { key: string | null }[]): Bucket[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!r.key) continue;
    m.set(r.key, (m.get(r.key) ?? 0) + 1);
  }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

function matches(r: RecipeRow, f: RecipeFilters, exclude: 'category' | 'book' | null, search: string): boolean {
  if (f.q && !search.includes(f.q.toLowerCase())) return false;
  if (exclude !== 'category' && f.category.length && !f.category.includes(r.category ?? '')) return false;
  if (exclude !== 'book' && f.book.length && !f.book.includes(r.bookName ?? '')) return false;
  if (f.hasVideo && !r.hasVideo) return false;
  if (f.highProtein && r.proteinG < HIGH_PROTEIN_G) return false;
  if (f.favorites && !r.isFavorite) return false;
  return true;
}

export async function getRecipesPage(
  companyId: string,
  filters: RecipeFilters,
  locale: string,
  profileId: string,
): Promise<RecipesPage> {
  const sb = createServiceClient();
  const [{ data, error }, favs] = await Promise.all([
    sb.from('recipes').select(RECIPE_COLS).eq('company_id', companyId).limit(2000),
    favoriteIds(companyId, profileId),
  ]);
  if (error) throw new Error(`getRecipesPage: ${error.message}`);
  const raws = (data ?? []) as RecipeRaw[];
  const searchById = new Map(raws.map((r) => [r.id, (r.search_text ?? '').toLowerCase()]));
  const sx = (id: string): string => searchById.get(id) ?? '';
  const all = raws.map((r) => mapRow(r, locale, favs));

  const filtered = all.filter((r) => matches(r, filters, null, sx(r.id)));
  const mul = filters.dir === 'asc' ? 1 : -1;
  filtered.sort((a, b) => {
    switch (filters.sort) {
      case 'kcal':
        return (a.kcal - b.kcal) * mul;
      case 'protein':
        return (a.proteinG - b.proteinG) * mul;
      case 'time':
        return (a.totalTime - b.totalTime) * mul;
      case 'quality':
        return (a.qualityScore - b.qualityScore) * mul;
      default:
        return a.name.localeCompare(b.name) * mul;
    }
  });

  const page = clampPage(filters.page, filtered.length, filters.pageSize);
  const start = (page - 1) * filters.pageSize;
  const facets: RecipeFacets = {
    category: tally(all.filter((r) => matches(r, filters, 'category', sx(r.id))).map((r) => ({ key: r.category }))),
    book: tally(all.filter((r) => matches(r, filters, 'book', sx(r.id))).map((r) => ({ key: r.bookName }))),
    hasVideoCount: all.filter((r) => r.hasVideo).length,
    highProteinCount: all.filter((r) => r.proteinG >= HIGH_PROTEIN_G).length,
    favoritesCount: all.filter((r) => r.isFavorite).length,
  };
  return {
    rows: filtered.slice(start, start + filters.pageSize),
    total: filtered.length,
    page,
    pageSize: filters.pageSize,
    facets,
    totalAll: all.length,
  };
}

export async function getRecipeDetail(
  companyId: string,
  id: string,
  locale: string,
  profileId: string,
): Promise<RecipeDetail | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('recipes')
    .select(
      `${RECIPE_COLS}, procedure_en, procedure_es, prep_time_minutes, cooking_time_minutes, spices, source_url, creator_handle, video_url`,
    )
    .eq('company_id', companyId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getRecipeDetail: ${error.message}`);
  if (!data) return null;
  const raw = data as RecipeRaw & {
    procedure_en: string | null;
    procedure_es: string | null;
    prep_time_minutes: number | null;
    cooking_time_minutes: number | null;
    spices: unknown;
    source_url: string | null;
    creator_handle: string | null;
    video_url: string | null;
  };

  const [{ data: ingData }, { data: favRow }] = await Promise.all([
    sb
      .from('recipe_ingredients')
      .select('ingredient_name, amount_print, amount_grams, protein_g, carb_g, fat_g, kcal, confidence, is_verified')
      .eq('company_id', companyId)
      .eq('recipe_id', id)
      .order('sequence', { ascending: true })
      .limit(200),
    sb
      .from('recipe_favorites')
      .select('recipe_id')
      .eq('company_id', companyId)
      .eq('profile_id', profileId)
      .eq('recipe_id', id)
      .maybeSingle(),
  ]);

  const base = mapRow(raw, locale, new Set(favRow ? [id] : []));

  const ingredients: RecipeIngredient[] = (
    (ingData ?? []) as {
      ingredient_name: string;
      amount_print: string | null;
      amount_grams: number | null;
      protein_g: number | null;
      carb_g: number | null;
      fat_g: number | null;
      kcal: number | null;
      confidence: number | null;
      is_verified: boolean | null;
    }[]
  ).map((i) => ({
    name: i.ingredient_name,
    amountPrint: i.amount_print,
    amountGrams: i.amount_grams == null ? null : Number(i.amount_grams),
    proteinG: Number(i.protein_g ?? 0),
    carbG: Number(i.carb_g ?? 0),
    fatG: Number(i.fat_g ?? 0),
    kcal: i.kcal ?? 0,
    confidence: Number(i.confidence ?? 0),
    isVerified: i.is_verified ?? false,
  }));

  const spices = Array.isArray(raw.spices)
    ? (raw.spices as unknown[]).map((s) => (typeof s === 'string' ? s : (s as { name?: string })?.name ?? '')).filter(Boolean)
    : [];

  return {
    ...base,
    procedure: locale === 'es' ? raw.procedure_es || raw.procedure_en : raw.procedure_en || raw.procedure_es,
    prepTime: raw.prep_time_minutes,
    cookTime: raw.cooking_time_minutes,
    ingredients,
    spices,
    sourceUrl: raw.source_url,
    creatorHandle: raw.creator_handle,
    videoUrl: raw.video_url,
  };
}

export async function getRecipeBooks(companyId: string): Promise<RecipeBookCard[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('recipe_books')
    .select('id, name, slug, cover_image_url, recipe_count')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  return ((data ?? []) as { id: string; name: string; slug: string; cover_image_url: string | null; recipe_count: number }[]).map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    cover: b.cover_image_url,
    count: b.recipe_count,
  }));
}
