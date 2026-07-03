// Client-safe types + a defensive parser for the STRUCTURED meal-plan format. The in-app builder and
// the AI auto-generator both write this shape; the coach builder and the client `/nutrition/plan` view
// both render it. It mirrors Stephanie's real plans (see the meal-plan-method memory): kcal-budgeted
// meal slots, each offering a few recipe OPTIONS, each recipe with raw-weight ingredients, per-recipe
// macros, an optional tip, and numbered steps.
//
// PURE MODULE (no server-only imports) so client components can import the types + helpers. Server
// validation for writes lives alongside the builder action (Zod), but reads go through parseStructuredPlan
// so a malformed jsonb blob never crashes a render.

export type PlanMacros = { proteinG: number; carbG: number; fatG: number };
export type PlanIngredient = { qty: string; item: string };

export type PlanRecipe = {
  title: string;
  prepMin: number | null;
  cookMin: number | null;
  kcal: number | null;
  macros: PlanMacros | null;
  ingredients: PlanIngredient[];
  spices: PlanIngredient[];
  note: string | null;
  steps: string[];
};

export type PlanSlot = {
  name: string;
  kcalTarget: number | null;
  recipes: PlanRecipe[];
};

export type MacroSplit = { proteinPct: number; carbPct: number; fatPct: number };

export type StructuredPlan = {
  goal: string | null;
  calorieTarget: number | null;
  macros: PlanMacros | null;
  macroSplit: MacroSplit | null;
  slots: PlanSlot[];
};

// --- authoring helpers (used by the builder) -------------------------------------------------------
export function blankRecipe(): PlanRecipe {
  return {
    title: '',
    prepMin: null,
    cookMin: null,
    kcal: null,
    macros: { proteinG: 0, carbG: 0, fatG: 0 },
    ingredients: [{ qty: '', item: '' }],
    spices: [],
    note: null,
    steps: [''],
  };
}

export function blankSlot(name = ''): PlanSlot {
  return { name, kcalTarget: null, recipes: [blankRecipe()] };
}

// The 5 kcal-budgeted slots Stephanie uses. A new plan starts from these so the coach fills, not builds.
export function starterSlots(): PlanSlot[] {
  return ['Breakfast', 'Snack 1', 'Lunch', 'Snack 2', 'Dinner'].map((n) => blankSlot(n));
}

export function emptyStructuredPlan(): StructuredPlan {
  return { goal: null, calorieTarget: null, macros: null, macroSplit: null, slots: starterSlots() };
}

// A structured plan is "real" only when it has at least one recipe with a title. An empty scaffold
// (starterSlots with blank recipes) should render as "no plan yet", not an empty skeleton.
export function hasStructuredContent(p: StructuredPlan | null | undefined): boolean {
  return Boolean(p?.slots?.some((s) => s.recipes.some((r) => r.title.trim().length > 0)));
}

// --- defensive parsing (reads jsonb of unknown shape) ----------------------------------------------
function str(v: unknown, max = 4000): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}
function nOrNull(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function macrosOf(v: unknown): PlanMacros | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const p = nOrNull(o.proteinG);
  const c = nOrNull(o.carbG);
  const f = nOrNull(o.fatG);
  if (p == null && c == null && f == null) return null;
  return { proteinG: p ?? 0, carbG: c ?? 0, fatG: f ?? 0 };
}
function ingredientsOf(v: unknown): PlanIngredient[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => x != null && typeof x === 'object')
    .map((x) => ({ qty: str(x.qty, 40), item: str(x.item, 160) }))
    .filter((x) => x.item.trim().length > 0);
}
function stepsOf(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((s) => str(s, 1200)).filter((s) => s.trim().length > 0);
}
function recipeOf(v: unknown, index: number): PlanRecipe | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const note = str(o.note, 600).trim();
  const macros = macrosOf(o.macros);
  const ingredients = ingredientsOf(o.ingredients);
  const spices = ingredientsOf(o.spices);
  const steps = stepsOf(o.steps);
  let title = str(o.title, 160).trim();
  if (!title) {
    // A blank title with authored content (ingredients, steps, tip, or non-zero macros) is a recipe
    // the coach wrote but never named; default the name instead of silently dropping their work.
    // All-zero macros do not count as content: blank builder scaffolds carry {0,0,0} by default.
    const hasMacros = macros != null && (macros.proteinG !== 0 || macros.carbG !== 0 || macros.fatG !== 0);
    const hasContent = ingredients.length > 0 || spices.length > 0 || steps.length > 0 || note.length > 0 || hasMacros;
    if (!hasContent) return null;
    title = `Recipe ${index + 1}`;
  }
  return {
    title,
    prepMin: nOrNull(o.prepMin),
    cookMin: nOrNull(o.cookMin),
    kcal: nOrNull(o.kcal),
    macros,
    ingredients,
    spices,
    note: note || null,
    steps,
  };
}
function slotOf(v: unknown): PlanSlot | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const name = str(o.name, 80).trim();
  const recipes = Array.isArray(o.recipes)
    ? o.recipes.map((r, i) => recipeOf(r, i)).filter((r): r is PlanRecipe => r != null)
    : [];
  if (!name && recipes.length === 0) return null;
  return { name, kcalTarget: nOrNull(o.kcalTarget), recipes };
}
function splitOf(v: unknown): MacroSplit | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const p = nOrNull(o.proteinPct);
  const c = nOrNull(o.carbPct);
  const f = nOrNull(o.fatPct);
  if (p == null && c == null && f == null) return null;
  return { proteinPct: p ?? 0, carbPct: c ?? 0, fatPct: f ?? 0 };
}

// Returns a normalized StructuredPlan, or null when the value holds no usable slots/recipes. Callers
// treat null as "this plan has no structured content" and fall back to the legacy group view.
export function parseStructuredPlan(v: unknown): StructuredPlan | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const slots = Array.isArray(o.slots)
    ? o.slots.map(slotOf).filter((s): s is PlanSlot => s != null)
    : [];
  if (slots.length === 0) return null;
  const plan: StructuredPlan = {
    goal: str(o.goal, 200).trim() || null,
    calorieTarget: nOrNull(o.calorieTarget),
    macros: macrosOf(o.macros),
    macroSplit: splitOf(o.macroSplit),
    slots,
  };
  return hasStructuredContent(plan) ? plan : null;
}
