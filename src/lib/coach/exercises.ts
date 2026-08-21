// Coach exercise library data layer. Reads public.exercises (shared corpus: company_id IS NULL
// is the seed, plus this tenant's own). One read, then filter / sort / facet / paginate in memory.
// Substitution chains are resolved per context through the existing engine. Service client because
// the coach console reads the shared corpus across the company_id IS NULL boundary.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { CONTEXTS, resolveSubstitutions } from '@/lib/substitutions/engine';
import { BLOCKS, BLOCK_ORDER, type Block } from '@/lib/exercises/blocks';

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
  /** Filmed and written by the coach herself (the 367 imported with her own cues), not seed content. */
  isCoachAuthored: boolean;
  /** Starred by the coach reading the page. Personal, not company-wide. */
  isFavorite: boolean;
  /** When she filmed it for the app. Null means it is still on the shoot list. */
  filmedAt: string | null;
  /** Her own session vocabulary. Null renders as "Unsorted" rather than being hidden. */
  block: Block | null;
  /** Her filmed demo is in storage and playable. */
  hasDemo: boolean;
  /** Her written coaching cues: the reason her library beats a generic one. */
  cues: string | null;
};

export type ExerciseFilters = {
  q: string;
  muscle: string[];
  equipment: string[];
  /** "My exercises". Defaults ON: her own 367 matter more to her than the seed library. */
  mine: boolean;
  /** "Favourites". */
  fav: boolean;
  /** "Still to film": her own rows with no filmed_at. Off by default. */
  toFilm: boolean;
  /** "Has my demo": rows whose footage is in storage and playable. Off by default. */
  hasDemo: boolean;
  /** Narrow to one or more of her blocks. Empty means show every block, grouped. */
  block: string[];
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
  /** Counts for the ownership toggles, computed over everything the search box has narrowed to. */
  counts: { mine: number; fav: number; toFilm: number; hasDemo: number };
  /** Shoot progress across her whole library, independent of every filter on screen. */
  filming: { filmed: number; total: number };
  /**
   * The page's rows split into her blocks, in her programming order.
   *
   * This is the organization fix. 367 movements in one A-Z grid ten pages deep is not a library a
   * coach can programme a leg day from. `rows` is kept alongside for callers that want the flat
   * list (the substitution candidate pool does).
   */
  groups: { block: Block | null; rows: ExerciseRow[] }[];
  /** How many rows sit in each block across everything the other filters allow. */
  blockFacets: Facet[];
};

const PAGE_SIZE = 40;

/** Filters for a programmatic read (substitution candidate pools), where no toggle is implied. */
export const NO_EXERCISE_FILTERS: Omit<ExerciseFilters, 'muscle' | 'pageSize'> = {
  q: '',
  equipment: [],
  mine: false,
  fav: false,
  toFilm: false,
  hasDemo: false,
  block: [],
  page: 1,
};

export function parseExerciseFilters(sp: Record<string, string | string[] | undefined>): ExerciseFilters {
  const arr = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);
  const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''));
  const pageRaw = Number.parseInt(one(sp.page), 10);
  // `mine` is the only filter that is ON when absent, so the OFF state has to be written into the
  // URL as mine=0 rather than by dropping the key. Anything else and the toggle cannot be turned off.
  return {
    q: one(sp.q).trim(),
    muscle: arr(sp.muscle),
    equipment: arr(sp.equipment),
    mine: one(sp.mine) !== '0',
    fav: one(sp.fav) === '1',
    toFilm: one(sp.tofilm) === '1',
    hasDemo: one(sp.demo) === '1',
    block: arr(sp.block),
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
  is_coach_authored: boolean | null;
  filmed_at: string | null;
  block: string | null;
  demo_storage_path: string | null;
  cues_en: string | null;
  cues_es: string | null;
};

function mapRow(r: ExerciseRaw, locale: string, favorites: ReadonlySet<string>): ExerciseRow {
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
    isCoachAuthored: r.is_coach_authored ?? false,
    isFavorite: favorites.has(r.id),
    filmedAt: r.filmed_at,
    block: (BLOCKS as readonly string[]).includes(r.block ?? '') ? (r.block as Block) : null,
    hasDemo: r.demo_storage_path != null,
    cues: (locale.startsWith('es') ? r.cues_es : r.cues_en) || r.cues_en,
  };
}

const SELECT_COLS =
  'id, company_id, name_en, name_es, muscle_group, equipment, difficulty, category, is_own_demo, is_coach_authored, filmed_at, block, demo_storage_path, cues_en, cues_es';

/** The starred ids for one coach. Empty set when nobody is asking (server-side candidate reads). */
async function loadFavoriteIds(profileId: string | null): Promise<Set<string>> {
  if (!profileId) return new Set();
  const sb = createServiceClient();
  const { data, error } = await sb.from('exercise_favorites').select('exercise_id').eq('profile_id', profileId);
  // A failed favourites read must not take the library down: the star is a convenience, the list is not.
  if (error) {
    console.error('[loadFavoriteIds]', error.message);
    return new Set();
  }
  return new Set(((data ?? []) as { exercise_id: string }[]).map((r) => r.exercise_id));
}

async function loadExercises(companyId: string, locale: string, profileId: string | null): Promise<ExerciseRow[]> {
  const sb = createServiceClient();
  const favorites = await loadFavoriteIds(profileId);
  // Shared-corpus pattern: the global seed (company_id IS NULL) plus this tenant's own exercises.
  const { data, error } = await sb
    .from('exercises')
    .select(SELECT_COLS)
    .or(`company_id.is.null,company_id.eq.${companyId}`)
    // Curated out (0105). This is the coach's BROWSE surface, so archived rows must not be offerable.
    // getExercise() below deliberately does NOT filter: it resolves a committed exercise by id and
    // must keep returning archived rows or history renders as "untitled" with no demo.
    .is('archived_at', null)
    .limit(2000);
  if (error) throw new Error(`loadExercises: ${error.message}`);
  return ((data ?? []) as ExerciseRaw[]).map((r) => mapRow(r, locale, favorites));
}

type FacetKey = 'q' | 'muscle' | 'equipment' | 'own' | 'film' | 'demo' | 'block';

/**
 * Has this movement been filmed?
 *
 * FOOTAGE IS PROOF, and reading the manual flag alone was telling her a flat lie. `filmed_at` is a
 * checkbox on the exercise row and it is null on ALL 366 of her coach-authored movements, while all
 * 366 have a file in `demo_storage_path`. So the library reported "0 of 366 filmed" and offered 366
 * movements as "still to film" to a woman who had filmed every one of them.
 *
 * The flag survives as an override for the real case it was built for: shot on a Sunday, not yet
 * uploaded. It can say yes before the file exists; it must not be able to say no after it does.
 */
function isFilmed(r: ExerciseRow): boolean {
  return r.hasDemo || r.filmedAt != null;
}

/** Her own, not yet shot. Only coach-authored rows are hers to film, so seed content never qualifies. */
function isToFilm(r: ExerciseRow): boolean {
  return r.isCoachAuthored && !isFilmed(r);
}

function matches(r: ExerciseRow, f: ExerciseFilters, exclude: FacetKey | null): boolean {
  if (exclude !== 'q' && f.q) {
    const q = f.q.toLowerCase();
    const hay = `${r.nameEn} ${r.nameEs ?? ''} ${r.muscleGroup ?? ''} ${r.equipment ?? ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (exclude !== 'muscle' && f.muscle.length && !(r.muscleGroup && f.muscle.includes(r.muscleGroup))) return false;
  if (exclude !== 'equipment' && f.equipment.length && !(r.equipment && f.equipment.includes(r.equipment))) return false;
  // The two ownership toggles are OR, not AND: with both on she wants her own PLUS anything she
  // starred, which is how she used the old list. AND would hide every starred seed exercise the
  // moment "My exercises" is on, i.e. always, since it defaults on.
  if (exclude !== 'own' && (f.mine || f.fav)) {
    const own = (f.mine && r.isCoachAuthored) || (f.fav && r.isFavorite);
    if (!own) return false;
  }
  // "Still to film" narrows rather than widens, so unlike the two above it is an AND. Turning it on
  // while "Favourites" is on means "the ones I starred that I still owe a shoot", which is the
  // reading she wants on a shoot day.
  if (exclude !== 'film' && f.toFilm && !isToFilm(r)) return false;
  if (exclude !== 'demo' && f.hasDemo && !r.hasDemo) return false;
  if (exclude !== 'block' && f.block.length && !(r.block && f.block.includes(r.block))) return false;
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
  profileId: string | null = null,
): Promise<ExercisesPage> {
  const all = await loadExercises(companyId, locale, profileId);
  // Sort by BLOCK first, then name. Sorting by name alone scatters every block across every page,
  // so "Hamstrings & glutes" would appear as a handful of rows on all ten pages instead of as one
  // run she can read top to bottom. Unplaced rows sort last, with the "Everything else" heading.
  const rank = (r: ExerciseRow): number => (r.block ? BLOCK_ORDER.indexOf(r.block) : BLOCK_ORDER.length);
  const filtered = all
    .filter((r) => matches(r, filters, null))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const start = (filters.page - 1) * filters.pageSize;
  // Toggle counts ignore the toggles themselves, so "My exercises 367" does not read 367 only while
  // it happens to be on. They DO respect the search box and the chips, which is the useful reading:
  // "of what you are looking at, this many are yours".
  const ownPool = all.filter((r) => matches(r, filters, 'own'));
  const filmPool = all.filter((r) => matches(r, filters, 'film'));
  const demoPool = all.filter((r) => matches(r, filters, 'demo'));
  const blockPool = all.filter((r) => matches(r, filters, 'block'));

  // Group the page she is actually looking at, in her programming order, with anything the
  // classifier could not place last and visible rather than dropped.
  const pageRows = filtered.slice(start, start + filters.pageSize);
  const byBlock = new Map<Block | null, ExerciseRow[]>();
  for (const r of pageRows) {
    const list = byBlock.get(r.block);
    if (list) list.push(r);
    else byBlock.set(r.block, [r]);
  }
  const groups = [
    ...BLOCK_ORDER.filter((b) => byBlock.has(b)).map((b) => ({ block: b as Block | null, rows: byBlock.get(b) ?? [] })),
    ...(byBlock.has(null) ? [{ block: null, rows: byBlock.get(null) ?? [] }] : []),
  ];
  // Her shoot progress is deliberately measured against the WHOLE library, not the filtered view.
  // "12 of 367" has to mean the same thing after she types in the search box, or the number is
  // useless for planning a shoot day.
  const hers = all.filter((r) => r.isCoachAuthored);
  return {
    rows: pageRows,
    total: filtered.length,
    totalAll: all.length,
    page: filters.page,
    pageSize: filters.pageSize,
    facets: {
      muscle: tally(all.filter((r) => matches(r, filters, 'muscle')), (r) => r.muscleGroup),
      equipment: tally(all.filter((r) => matches(r, filters, 'equipment')), (r) => r.equipment),
    },
    groups,
    blockFacets: BLOCK_ORDER.map((b) => ({ key: b, count: blockPool.filter((r) => r.block === b).length })).filter(
      (f) => f.count > 0,
    ),
    counts: {
      mine: ownPool.filter((r) => r.isCoachAuthored).length,
      fav: ownPool.filter((r) => r.isFavorite).length,
      toFilm: filmPool.filter(isToFilm).length,
      hasDemo: demoPool.filter((r) => r.hasDemo).length,
    },
    filming: { filmed: hers.filter(isFilmed).length, total: hers.length },
  };
}

export async function getExercise(
  companyId: string,
  exerciseId: string,
  locale: string,
  profileId: string | null = null,
): Promise<ExerciseRow | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('exercises')
    .select(SELECT_COLS)
    .eq('id', exerciseId)
    .or(`company_id.is.null,company_id.eq.${companyId}`)
    .maybeSingle();
  if (!data) return null;
  return mapRow(data as ExerciseRaw, locale, await loadFavoriteIds(profileId));
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
