// Coach exercise library data layer. Reads public.exercises (shared corpus: company_id IS NULL
// is the seed, plus this tenant's own). One read, then filter / sort / facet / paginate in memory.
// Substitution chains are resolved per context through the existing engine. Service client because
// the coach console reads the shared corpus across the company_id IS NULL boundary.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { CONTEXTS, resolveSubstitutions } from '@/lib/substitutions/engine';
import { BLOCKS, BLOCK_ORDER, type Block } from '@/lib/exercises/blocks';
// Aliased: this module exports a `demoUrls` FIELD on ExercisesPage, and an unaliased import would
// shadow it inside the builder below.
import { demoUrls as demoUrls_ } from '@/lib/exercises/demo-url';

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

/**
 * Which vocabulary the chips AND the section headings speak.
 *
 * THE MEASUREMENT THAT DECIDES THIS. Of 660 live movements, her 366 filmed ones carry a `block` on
 * 364 of them (99%) and a `muscle_group` on 7 (2%). The 294 seed-catalog rows are the exact
 * opposite: 1 has a block (0%), 247 have a muscle group (84%).
 *
 * The two halves of this library are tagged on completely different axes. That is why the old
 * screen stacked a block chip row AND a muscle chip row AND an equipment chip row and felt broken:
 * every one of them was blank for half the corpus. One axis at a time, chosen by what she is
 * looking at, is the whole fix.
 */
export type FacetAxis = 'block' | 'muscle';

export type ExerciseGroup = {
  /** A block key, a muscle slug, or null for "Everything else". */
  key: string | null;
  /** The rows to render. Capped to a preview while browsing. */
  rows: ExerciseRow[];
  /** Rows in this group across the WHOLE filtered corpus, not just what is rendered. */
  total: number;
};

export type ExercisesPage = {
  rows: ExerciseRow[];
  total: number;
  totalAll: number;
  page: number;
  pageSize: number;
  /** The vocabulary in play. Derived from `mine`; see FacetAxis. */
  axis: FacetAxis;
  /** The ONE chip row, already in display order for the axis. */
  facets: Facet[];
  /** Feeds the equipment select. Off the chip rows entirely: it is a narrowing, not a way in. */
  equipmentOptions: Facet[];
  /** Counts for the ownership toggles, computed over everything the search box has narrowed to. */
  counts: { mine: number; fav: number; toFilm: number; hasDemo: number };
  /** Shoot progress across her whole library, independent of every filter on screen. */
  filming: { filmed: number; total: number };
  /**
   * Sections, keyed by the current axis.
   *
   * EMPTY unless she is browsing. A search result should not be grouped at all: the chip or the
   * query already states the group, and grouping a filtered set is what produced the same heading
   * on all ten pages. `rows` is kept alongside for callers that want the flat list (the
   * substitution candidate pool does).
   */
  groups: ExerciseGroup[];
  /**
   * True when nothing is narrowing the list, so it renders as a browsable set of sections with no
   * pagination. False the moment she searches or taps a chip, which flips it to a flat paged grid.
   */
  browsing: boolean;
  /**
   * Signed playback URLs for the rendered rows, keyed by exercise id.
   *
   * The storage PATH is deliberately absent from ExerciseRow. That type crosses into a client
   * component, so anything on it lands in the RSC payload, and the bucket is private: a path in the
   * page source is an index of the library. Only minted when the caller asks (`signDemos`).
   */
  demoUrls: Record<string, string>;
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

async function loadExercises(
  companyId: string,
  locale: string,
  profileId: string | null,
): Promise<{ rows: ExerciseRow[]; demoPathById: Map<string, string> }> {
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
  const raw = (data ?? []) as ExerciseRaw[];
  // The path is kept HERE, beside the query, and never on ExerciseRow. See ExercisesPage.demoUrls.
  const demoPathById = new Map<string, string>();
  for (const r of raw) {
    if (r.demo_storage_path) demoPathById.set(r.id, r.demo_storage_path);
  }
  return { rows: raw.map((r) => mapRow(r, locale, favorites)), demoPathById };
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

/** How many rows a section shows before "See all N". Enough to scan, few enough to keep scrolling. */
const SECTION_PREVIEW = 8;

export async function getExercisesPage(
  companyId: string,
  filters: ExerciseFilters,
  locale: string,
  profileId: string | null = null,
  opts: { signDemos?: boolean } = {},
): Promise<ExercisesPage> {
  const { rows: all, demoPathById } = await loadExercises(companyId, locale, profileId);

  /**
   * ONE AXIS, chosen by scope. `mine` is ON by default and her own rows are 99% blocked and 2%
   * muscled, so blocks are the way into her library. Turning it off puts her in the seed catalog,
   * which is the mirror image, so the vocabulary flips with her.
   *
   * The headings follow the same rule, not just the chips. Grouping the seed catalog by block would
   * put all 294 rows under "Everything else", which is how you fix half a bug.
   */
  const axis: FacetAxis = filters.mine ? 'block' : 'muscle';
  const keyOf = (r: ExerciseRow): string | null => (axis === 'block' ? r.block : r.muscleGroup);

  // Sort by the axis first, then name. Sorting by name alone scatters every group across every
  // page, so "Hamstrings & glutes" would appear as a handful of rows on all ten pages instead of as
  // one run she can read top to bottom. Unplaced rows sort last, under "Everything else".
  const axisOrder: string[] =
    axis === 'block'
      ? [...BLOCK_ORDER]
      : [...new Set(all.map((r) => r.muscleGroup).filter((m): m is string => m != null))].sort((a, b) =>
          a.localeCompare(b),
        );
  const rank = (r: ExerciseRow): number => {
    const k = keyOf(r);
    const i = k ? axisOrder.indexOf(k) : -1;
    return i === -1 ? axisOrder.length : i;
  };
  const filtered = all
    .filter((r) => matches(r, filters, null))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const start = (filters.page - 1) * filters.pageSize;

  /**
   * Nothing is narrowing the list, so show her the shape of the library instead of page 1 of 10.
   *
   * The moment she searches or taps anything this goes false and the screen becomes a flat paged
   * grid. That is deliberate: a search RESULT should not be grouped, because the query already
   * states the group, and grouping a filtered set is exactly what printed the same heading on all
   * ten pages.
   */
  const browsing =
    !filters.q &&
    !filters.fav &&
    !filters.toFilm &&
    !filters.hasDemo &&
    filters.block.length === 0 &&
    filters.muscle.length === 0 &&
    filters.equipment.length === 0;
  // Toggle counts ignore the toggles themselves, so "My exercises 367" does not read 367 only while
  // it happens to be on. They DO respect the search box and the chips, which is the useful reading:
  // "of what you are looking at, this many are yours".
  const ownPool = all.filter((r) => matches(r, filters, 'own'));
  const filmPool = all.filter((r) => matches(r, filters, 'film'));
  const demoPool = all.filter((r) => matches(r, filters, 'demo'));

  /**
   * Sections built over the WHOLE filtered corpus, not the page slice.
   *
   * The old version grouped `pageRows`, so a block spanning three pages printed its heading three
   * times and the library looked fragmented rather than organised. Each section now knows its true
   * total and shows a preview, with "See all N" writing the axis filter, which is also what flips
   * `browsing` off and turns the screen into the flat paged grid for that one group.
   */
  const pageRows = filtered.slice(start, start + filters.pageSize);
  const byKey = new Map<string | null, ExerciseRow[]>();
  for (const r of filtered) {
    const k = keyOf(r);
    const list = byKey.get(k);
    if (list) list.push(r);
    else byKey.set(k, [r]);
  }
  const groups: ExerciseGroup[] = !browsing
    ? []
    : [
        ...axisOrder.filter((k) => byKey.has(k)),
        // Anything the classifier could not place goes LAST and stays visible. Dropping it would
        // hide 295 movements on the seed catalog and 2 of hers.
        ...(byKey.has(null) ? [null] : []),
      ].map((k) => {
        const rows = byKey.get(k) ?? [];
        return { key: k, rows: rows.slice(0, SECTION_PREVIEW), total: rows.length };
      });
  // Her shoot progress is deliberately measured against the WHOLE library, not the filtered view.
  // "12 of 367" has to mean the same thing after she types in the search box, or the number is
  // useless for planning a shoot day.
  const hers = all.filter((r) => r.isCoachAuthored);

  /**
   * The one chip row, in axis order, using the SAME exclude-self faceting as before: a chip's count
   * ignores its own selection, so "Glutes 71" does not read 71 only while glutes is on.
   */
  const facetPool = all.filter((r) => matches(r, filters, axis === 'block' ? 'block' : 'muscle'));
  const facetCounts = new Map<string, number>();
  for (const r of facetPool) {
    const k = keyOf(r);
    if (k) facetCounts.set(k, (facetCounts.get(k) ?? 0) + 1);
  }
  const facets: Facet[] = axisOrder
    .map((key) => ({ key, count: facetCounts.get(key) ?? 0 }))
    .filter((f) => f.count > 0);

  // Signed only for what is actually rendered. The detail page passes no opts, so its 300- and
  // 800-row candidate pools never mint a URL.
  const shown = browsing ? groups.flatMap((g) => g.rows) : pageRows;
  const demoUrls: Record<string, string> = {};
  if (opts.signDemos) {
    const paths = shown.map((r) => demoPathById.get(r.id)).filter((p): p is string => p != null);
    const signed = await demoUrls_(paths);
    for (const r of shown) {
      const p = demoPathById.get(r.id);
      const url = p ? signed.get(p) : undefined;
      if (url) demoUrls[r.id] = url;
    }
  }

  return {
    rows: pageRows,
    total: filtered.length,
    totalAll: all.length,
    page: filters.page,
    pageSize: filters.pageSize,
    axis,
    facets,
    equipmentOptions: tally(all.filter((r) => matches(r, filters, 'equipment')), (r) => r.equipment),
    groups,
    browsing,
    demoUrls,
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
