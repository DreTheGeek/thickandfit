// Coach exercise library data layer. Reads public.exercises (shared corpus: company_id IS NULL
// is the seed, plus this tenant's own). One read, then filter / sort / facet / paginate in memory.
// Substitution chains are resolved per context through the existing engine. Service client because
// the coach console reads the shared corpus across the company_id IS NULL boundary.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { CONTEXTS, resolveSubstitutions } from '@/lib/substitutions/engine';

export type ExerciseRow = {
  id: string;
  name: string;
  nameEn: string;
  nameEs: string | null;
  muscleGroup: string | null;
  equipment: string | null;
  difficulty: string | null;
  category: string | null;
  isOwnDemo: boolean;
  isShared: boolean;
};

export type ExerciseFilters = {
  q: string;
  muscle: string[];
  equipment: string[];
  page: number;
  pageSize: number;
};

export type Facet = { key: string; count: number };

export type ExercisesPage = {
  rows: ExerciseRow[];
  total: number;
  totalAll: number;
  page: number;
  pageSize: number;
  facets: { muscle: Facet[]; equipment: Facet[] };
};

const PAGE_SIZE = 40;

export function parseExerciseFilters(sp: Record<string, string | string[] | undefined>): ExerciseFilters {
  const arr = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);
  const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''));
  const pageRaw = Number.parseInt(one(sp.page), 10);
  return {
    q: one(sp.q).trim(),
    muscle: arr(sp.muscle),
    equipment: arr(sp.equipment),
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
    pageSize: PAGE_SIZE,
  };
}

type ExerciseRaw = {
  id: string;
  company_id: string | null;
  name_en: string;
  name_es: string | null;
  muscle_group: string | null;
  equipment: string | null;
  difficulty: string | null;
  category: string | null;
  is_own_demo: boolean | null;
};

function mapRow(r: ExerciseRaw, locale: string): ExerciseRow {
  const name = (locale.startsWith('es') ? r.name_es : r.name_en) || r.name_en;
  return {
    id: r.id,
    name,
    nameEn: r.name_en,
    nameEs: r.name_es,
    muscleGroup: r.muscle_group,
    equipment: r.equipment,
    difficulty: r.difficulty,
    category: r.category,
    isOwnDemo: r.is_own_demo ?? false,
    isShared: r.company_id == null,
  };
}

async function loadExercises(companyId: string, locale: string): Promise<ExerciseRow[]> {
  const sb = createServiceClient();
  // Shared-corpus pattern: the global seed (company_id IS NULL) plus this tenant's own exercises.
  const { data, error } = await sb
    .from('exercises')
    .select('id, company_id, name_en, name_es, muscle_group, equipment, difficulty, category, is_own_demo')
    .or(`company_id.is.null,company_id.eq.${companyId}`)
    .limit(2000);
  if (error) throw new Error(`loadExercises: ${error.message}`);
  return ((data ?? []) as ExerciseRaw[]).map((r) => mapRow(r, locale));
}

type FacetKey = 'q' | 'muscle' | 'equipment';

function matches(r: ExerciseRow, f: ExerciseFilters, exclude: FacetKey | null): boolean {
  if (exclude !== 'q' && f.q) {
    const q = f.q.toLowerCase();
    const hay = `${r.nameEn} ${r.nameEs ?? ''} ${r.muscleGroup ?? ''} ${r.equipment ?? ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (exclude !== 'muscle' && f.muscle.length && !(r.muscleGroup && f.muscle.includes(r.muscleGroup))) return false;
  if (exclude !== 'equipment' && f.equipment.length && !(r.equipment && f.equipment.includes(r.equipment))) return false;
  return true;
}

function tally(rows: ExerciseRow[], keyOf: (r: ExerciseRow) => string | null): Facet[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => a.key.localeCompare(b.key));
}

export async function getExercisesPage(
  companyId: string,
  filters: ExerciseFilters,
  locale: string,
): Promise<ExercisesPage> {
  const all = await loadExercises(companyId, locale);
  const filtered = all.filter((r) => matches(r, filters, null)).sort((a, b) => a.name.localeCompare(b.name));
  const start = (filters.page - 1) * filters.pageSize;
  return {
    rows: filtered.slice(start, start + filters.pageSize),
    total: filtered.length,
    totalAll: all.length,
    page: filters.page,
    pageSize: filters.pageSize,
    facets: {
      muscle: tally(all.filter((r) => matches(r, filters, 'muscle')), (r) => r.muscleGroup),
      equipment: tally(all.filter((r) => matches(r, filters, 'equipment')), (r) => r.equipment),
    },
  };
}

export async function getExercise(companyId: string, exerciseId: string, locale: string): Promise<ExerciseRow | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('exercises')
    .select('id, company_id, name_en, name_es, muscle_group, equipment, difficulty, category, is_own_demo')
    .eq('id', exerciseId)
    .or(`company_id.is.null,company_id.eq.${companyId}`)
    .maybeSingle();
  if (!data) return null;
  return mapRow(data as ExerciseRaw, locale);
}

export type SubstituteLite = {
  sortOrder: number;
  reasonTag: string | null;
  exercise: { id: string; name: string } | null;
};

export type ContextChain = {
  context: string;
  fallback: boolean;
  substitutes: SubstituteLite[];
};

/** Resolve every context's chain for one exercise (used by the detail editor). */
export async function getAllChains(companyId: string, exerciseId: string, locale: string): Promise<ContextChain[]> {
  const isEs = locale.startsWith('es');
  const results = await Promise.all(
    CONTEXTS.map(async (context): Promise<ContextChain> => {
      const resolved = await resolveSubstitutions(companyId, exerciseId, context);
      const substitutes: SubstituteLite[] = (resolved.substitutes as Array<{
        sort_order: number;
        reason_tag: string | null;
        exercise: { id: string; name_en: string; name_es: string | null } | null;
      }>).map((s) => ({
        sortOrder: s.sort_order,
        reasonTag: s.reason_tag,
        exercise: s.exercise
          ? { id: s.exercise.id, name: (isEs ? s.exercise.name_es : s.exercise.name_en) || s.exercise.name_en }
          : null,
      }));
      return { context, fallback: resolved.fallback, substitutes };
    }),
  );
  return results;
}

export type ReasonTag = { key: string; label: string };

export async function getReasonTags(locale: string): Promise<ReasonTag[]> {
  const sb = createServiceClient();
  const { data } = await sb.from('substitution_reason_tags').select('key, label_en, label_es').order('key');
  const isEs = locale.startsWith('es');
  return ((data ?? []) as { key: string; label_en: string; label_es: string | null }[]).map((r) => ({
    key: r.key,
    label: (isEs ? r.label_es : r.label_en) || r.label_en,
  }));
}
