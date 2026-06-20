// Pure, client-safe types + filter parsing for the recipe Library. Re-exported by recipes.ts.
import type { Bucket } from '@/lib/coach/clients-types';

export type RecipeSort = 'name' | 'kcal' | 'protein' | 'time' | 'quality';

export type RecipeFilters = {
  q: string;
  book: string[];
  category: string[];
  hasVideo: boolean;
  highProtein: boolean;
  favorites: boolean;
  sort: RecipeSort;
  dir: 'asc' | 'desc';
  page: number;
  pageSize: number;
};

// 3-band quality rating derived from quality_score (0-100).
export type QualityBand = 'needs_review' | 'usable' | 'high';

export type RecipeRow = {
  id: string;
  name: string;
  image: string | null;
  category: string | null;
  bookName: string | null;
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  totalTime: number;
  hasVideo: boolean;
  ingredientCount: number;
  servings: number;
  qualityScore: number;
  qualityBand: QualityBand;
  isFavorite: boolean;
};

export type RecipeIngredient = {
  name: string;
  amountPrint: string | null;
  amountGrams: number | null;
  proteinG: number;
  carbG: number;
  fatG: number;
  kcal: number;
  confidence: number;
  isVerified: boolean;
};

export type RecipeDetail = RecipeRow & {
  procedure: string | null;
  prepTime: number | null;
  cookTime: number | null;
  ingredients: RecipeIngredient[];
  spices: string[];
  sourceUrl: string | null;
  creatorHandle: string | null;
  videoUrl: string | null;
};

// Thresholds: <50 needs review, 50-79 usable, 80+ high quality.
export function qualityBand(score: number): QualityBand {
  if (score >= 80) return 'high';
  if (score >= 50) return 'usable';
  return 'needs_review';
}

export type RecipeFacets = { category: Bucket[]; book: Bucket[]; hasVideoCount: number; highProteinCount: number; favoritesCount: number };
export type RecipesPage = { rows: RecipeRow[]; total: number; page: number; pageSize: number; facets: RecipeFacets; totalAll: number };
export type RecipeBookCard = { id: string; name: string; slug: string; cover: string | null; count: number };

const SORTS: readonly RecipeSort[] = ['name', 'kcal', 'protein', 'time', 'quality'];
const HIGH_PROTEIN_G = 25;
export { HIGH_PROTEIN_G };

function toArr(v: string | string[] | undefined): string[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).filter((s) => typeof s === 'string' && s.length > 0);
}

export function parseRecipeFilters(raw: Record<string, string | string[] | undefined>): RecipeFilters {
  const sortRaw = typeof raw.sort === 'string' ? raw.sort : '';
  return {
    q: typeof raw.q === 'string' ? raw.q.trim().slice(0, 80) : '',
    book: toArr(raw.book),
    category: toArr(raw.category),
    hasVideo: raw.hasVideo === '1',
    highProtein: raw.highProtein === '1',
    favorites: raw.favorites === '1',
    sort: SORTS.includes(sortRaw as RecipeSort) ? (sortRaw as RecipeSort) : 'name',
    dir: raw.dir === 'desc' ? 'desc' : 'asc',
    page: Math.max(1, Math.floor(Number(raw.page)) || 1),
    pageSize: Math.min(60, Math.max(12, Math.floor(Number(raw.pageSize)) || 24)),
  };
}
