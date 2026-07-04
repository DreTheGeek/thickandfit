// AI meal-plan generation. SERVER-ONLY.
// Given a client's onboarding intake (answers + predicted_goal + computed_targets) and the company's
// documented coaching knowledge, ask claude-sonnet-4-6 (JSON mode, same pattern as insights.ts
// extractNarrative) to draft a FULL structured meal plan in Stephanie's style (kcal-budgeted slots ->
// recipe options -> raw-weight ingredients, per-recipe macros, tips, steps), then insert a meal_plans
// row. It writes meal_plans.structured (the same shape the builder authors + the client/coach render)
// plus her free-veggie coach note to meal_plans.notes, so an AI plan is indistinguishable from a
// hand-built one.
//
// SCOPE: MEAL PLANS ONLY. There is no programs table; workout programs are public.plans +
// session_exercises with FK exercise_id UUIDs the model cannot invent, so workout-gen is deferred.
//
// Key-gating: with no OPENROUTER_API_KEY this returns { status: 'notConfigured' } and writes nothing.
// It never throws on a missing key; the route degrades cleanly. Every AI field is clamped/coerced and
// Zod-validated before any DB write, so a malformed model reply never writes a half-row.
import 'server-only';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { retrieveKnowledge } from '@/lib/coach-ai/knowledge';
import { SAFETY_CLAUSE_EN, planCaveat } from '@/lib/coach-ai/safety';
import { AI_MODELS } from '@/lib/ai/models';
import { aiConfigured, callJson } from '@/lib/ai/client';

// Flagship reasoning for generation (rare, quality-critical, PCOS-aware structured JSON).
const PLAN_MODEL = AI_MODELS.planGen;
// Bump when PLAN_SYSTEM changes so replay/eval can group inferences by prompt generation.
// v2: Dear-letter intro + member context (name/weight/top logged foods) + 2-3 options per main slot.
const PROMPT_VERSION = 'plan-gen.v2';

export type PlanLocale = 'en' | 'es';

export function isPlanGenConfigured(): boolean {
  return aiConfigured();
}

// --- The model output shape (validated before any write) --------------------
// Full STRUCTURED plan matching how Stephanie really writes them: kcal-budgeted slots -> recipe
// OPTIONS -> raw-weight ingredients, per-recipe macros, a tip, and steps. Written to meal_plans.structured
// (the same shape the builder authors), so an AI plan and a hand-built plan render identically.
const IngredientSchema = z.object({
  qty: z.string().trim().max(40).optional().default(''),
  item: z.string().trim().min(1).max(160),
});
const RecipeSchema = z.object({
  title: z.string().trim().min(1).max(160),
  prep_min: z.number().int().min(0).max(1440).nullable().optional().default(null),
  cook_min: z.number().int().min(0).max(1440).nullable().optional().default(null),
  kcal: z.number().int().min(0).max(5000).nullable().optional().default(null),
  protein_g: z.number().int().min(0).max(400).optional().default(0),
  carb_g: z.number().int().min(0).max(500).optional().default(0),
  fat_g: z.number().int().min(0).max(300).optional().default(0),
  ingredients: z.array(IngredientSchema).max(20).optional().default([]),
  spices: z.array(IngredientSchema).max(20).optional().default([]),
  note: z.string().trim().max(400).nullable().optional().default(null),
  steps: z.array(z.string().trim().min(1).max(800)).max(20).optional().default([]),
});
const SlotSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kcal_target: z.number().int().min(0).max(3000).nullable().optional().default(null),
  recipes: z.array(RecipeSchema).min(1).max(4),
});
const PlanSchema = z.object({
  name: z.string().trim().min(1).max(120),
  goal: z.string().trim().max(200).optional().default(''),
  calorie_goal: z.number().int().min(800).max(6000),
  protein_g: z.number().int().min(0).max(600),
  carb_g: z.number().int().min(0).max(900),
  fat_g: z.number().int().min(0).max(400),
  coach_note: z.string().trim().max(600).optional().default(''),
  // The "Dear {name}" opening letter of Stephanie's real plan documents.
  intro: z.string().trim().max(1500).optional().default(''),
  slots: z.array(SlotSchema).min(1).max(6),
});

type ParsedPlan = z.infer<typeof PlanSchema>;

const PLAN_SYSTEM = [
  "You are coach Stephanie's meal-planning assistant for a bilingual (English/Latin-American Spanish)",
  'fitness app. Given a member intake and her documented coaching method, produce ONE full meal plan',
  'in HER style. Return ONLY minified JSON of this exact shape, no prose, no markdown fences:',
  '{"name":string,"goal":string,"calorie_goal":int,"protein_g":int,"carb_g":int,"fat_g":int,',
  '"coach_note":string,"intro":string,"slots":[{"name":string,"kcal_target":int,"recipes":[{"title":string,',
  '"prep_min":int|null,"cook_min":int|null,"kcal":int,"protein_g":int,"carb_g":int,"fat_g":int,',
  '"ingredients":[{"qty":string,"item":string}],"spices":[{"qty":string,"item":string}],',
  '"note":string,"steps":[string]}]}]}',
  '',
  "Stephanie's method + style (follow it closely):",
  '- intro: the short personal letter that opens her real plan documents. 2-4 warm sentences,',
  '  addressed to the member BY FIRST NAME ("Dear Maria,"), acknowledging THEIR goal and preferences,',
  '  encouraging free choice between the options. Her tone: warm, direct, zero fluff. No sign-off',
  '  (the app renders it) and no medical claims.',
  '- 5 kcal-budgeted slots: Breakfast, Snack 1, Lunch, Snack 2, Dinner. Set each kcal_target so they',
  '  sum to the daily calorie_goal. Give 2-3 recipe OPTIONS for Breakfast/Lunch/Dinner and 1-2 for',
  '  snacks so the member can genuinely choose; OPTIONS WITHIN A SLOT must land within ~10% of the',
  "  slot's kcal_target so any choice keeps the day on target (this is how her real plans work).",
  '- When the member context lists foods they already eat and log, BUILD AROUND those foods first -',
  '  familiar meals get followed; novelty gets abandoned.',
  '- KEEP RECIPES SIMPLE: 3-5 core ingredients. Simple is the whole point.',
  '- Ingredients use RAW-WEIGHT grams as the qty (e.g. "135g"), and lean, specific items: 93/7 ground',
  '  beef (never fattier), protein pasta, Greek yogurt, egg whites, chicken breast. Name real products',
  '  where it helps (Fage, Kodiak, Quest). Put seasonings/sauces in "spices" (e.g. "1-2 tsp","Taco',
  '  seasoning"), not "ingredients".',
  '- Every recipe: realistic kcal + per-recipe protein_g/carb_g/fat_g that roughly match its portion,',
  '  a few numbered steps, and an optional short "note" tip (or "").',
  '- coach_note: a short, warm note in her voice reminding the member that if they are still hungry',
  '  they can add "free" veggies (spinach, onions, cucumbers) that barely move their macros.',
  '',
  'Rules:',
  '- Honor the member computed_targets when present (calories + protein/carb/fat grams). If absent,',
  '  pick sensible targets for the stated goal. Daily macros must roughly sum to calorie_goal at',
  '  4 kcal/g protein, 4 kcal/g carb, 9 kcal/g fat, and the recipe macros across chosen options should',
  '  land near the slot budgets.',
  '- If the intake shows PCOS, insulin issues, or an allergy, respect it (higher protein/fiber, avoid',
  '  the allergen) but never state a medical claim.',
  "- Name the plan for the member's goal. Reply in the member's language for ALL human-readable text",
  '  (name, goal, slot names, recipe titles, ingredients, notes, steps).',
  '- Ground choices in the coaching method provided below.',
  '',
  SAFETY_CLAUSE_EN,
].join('\n');

type Usage = { prompt_tokens?: number; completion_tokens?: number };

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Macro split percentages from grams + calorie goal, so what we store is internally consistent. Zeros
// when the model returns no usable macro grams (the generated protein_g/carb_g/fat_g columns go null).
function normalizeSplit(p: ParsedPlan): { protein: number; carb: number; fat: number } {
  const pK = p.protein_g * 4;
  const cK = p.carb_g * 4;
  const fK = p.fat_g * 9;
  const total = pK + cK + fK;
  if (total <= 0) {
    return { protein: 0, carb: 0, fat: 0 };
  }
  return {
    protein: Math.round((pK / total) * 100),
    carb: Math.round((cK / total) * 100),
    fat: Math.round((fK / total) * 100),
  };
}

type MemberContext = {
  firstName: string | null;
  latestWeightKg: number | null;
  topFoods: string[]; // what they actually eat + log, most-logged first
  // From the migrated Lenus intake (client_intake): the coaching context that must shape the plan.
  goalType: string | null;
  targetWeightKg: number | null;
  injuries: string[] | null;
  dietaryExclusions: string[] | null;
  medicalConditions: string | null;
  trainingExperience: string | null;
};

// Pull the member's REAL data so the plan is personal, not generic: their name (the Dear-letter),
// latest weight, and the foods they demonstrably eat (plans built on familiar foods get followed).
async function loadMemberContext(
  sb: ReturnType<typeof createServiceClient>,
  companyId: string,
  profileId: string,
): Promise<MemberContext> {
  const [{ data: prof }, { data: w }, { data: logs }] = await Promise.all([
    sb.from('profiles').select('full_name').eq('id', profileId).maybeSingle(),
    sb
      .from('weight_entries')
      .select('weight_kg')
      .eq('company_id', companyId)
      .eq('profile_id', profileId)
      .order('recorded_on', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from('food_log')
      .select('name')
      .eq('company_id', companyId)
      .eq('profile_id', profileId)
      .order('logged_at', { ascending: false })
      .limit(300),
  ]);
  const counts = new Map<string, number>();
  for (const r of (logs ?? []) as { name: string | null }[]) {
    const n = (r.name ?? '').trim().toLowerCase();
    if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  const topFoods = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n);
  const fullName = ((prof as { full_name: string | null } | null)?.full_name ?? '').trim();

  // Migrated intake: joined via the contact this profile claimed. This is the health context (injuries,
  // dietary exclusions, conditions, goal) the coach expects the plan to respect - now the AI sees it too.
  const { data: intakeRow } = await sb
    .from('client_intake')
    .select('goal_type, target_weight_kg, injuries, dietary_exclusions, medical_conditions, training_experience')
    .eq('company_id', companyId)
    .eq('profile_id', profileId)
    .maybeSingle();
  const ik = intakeRow as {
    goal_type: string | null; target_weight_kg: number | string | null; injuries: string[] | null;
    dietary_exclusions: string[] | null; medical_conditions: string | null; training_experience: string | null;
  } | null;

  return {
    firstName: fullName ? fullName.split(/\s+/)[0] : null,
    latestWeightKg: w ? Number((w as { weight_kg: number }).weight_kg) : null,
    topFoods,
    goalType: ik?.goal_type ?? null,
    targetWeightKg: ik?.target_weight_kg != null ? Number(ik.target_weight_kg) : null,
    injuries: ik?.injuries ?? null,
    dietaryExclusions: ik?.dietary_exclusions ?? null,
    medicalConditions: ik?.medical_conditions ?? null,
    trainingExperience: ik?.training_experience ?? null,
  };
}

function buildUserPrompt(
  goal: string | null,
  targets: unknown,
  answers: unknown,
  knowledge: string,
  locale: PlanLocale,
  member: MemberContext,
): string {
  return [
    `Language: ${locale === 'es' ? 'Spanish' : 'English'}`,
    `Member first name: ${member.firstName ?? 'not set (open the intro without a name)'}`,
    `Member goal: ${goal ?? 'not set'}`,
    `Computed targets: ${targets ? JSON.stringify(targets) : 'not set'}`,
    `Latest logged weight (kg): ${member.latestWeightKg ?? 'none'}`,
    member.targetWeightKg != null ? `Target weight (kg): ${member.targetWeightKg} (direction: ${member.goalType ?? 'unspecified'})` : '',
    `Foods this member already eats and logs (build around these first): ${member.topFoods.length ? member.topFoods.join(', ') : 'no logs yet'}`,
    // Migrated health context: HARD constraints the plan must honor.
    member.dietaryExclusions && member.dietaryExclusions.length
      ? `MUST EXCLUDE these foods/ingredients (dietary restriction, do not include any): ${member.dietaryExclusions.join(', ')}`
      : '',
    member.medicalConditions ? `Medical conditions to respect: ${member.medicalConditions}` : '',
    member.injuries && member.injuries.length ? `Injuries/limitations: ${member.injuries.join(', ')}` : '',
    member.trainingExperience ? `Training background: ${member.trainingExperience.slice(0, 300)}` : '',
    `Intake answers: ${answers ? JSON.stringify(answers).slice(0, 2000) : 'none'}`,
    '',
    'Coaching method (ground the plan in this; empty means use general best practice):',
    knowledge || '(none provided yet)',
  ].filter(Boolean).join('\n');
}

function parsePlan(raw: string): ParsedPlan | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const obj = JSON.parse(cleaned);
    const result = PlanSchema.safeParse(obj);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

async function logUsage(companyId: string, userId: string, usage: Usage): Promise<void> {
  try {
    const sb = createServiceClient();
    await sb.from('ai_usage_log').insert({
      company_id: companyId,
      user_id: userId,
      feature: 'meal-plan-gen',
      model: PLAN_MODEL,
      prompt_tokens: Math.max(0, Math.round(num(usage.prompt_tokens))),
      completion_tokens: Math.max(0, Math.round(num(usage.completion_tokens))),
      cost_cents: 0,
    });
  } catch {
    // Metering is best-effort; never fail the generation because logging failed.
  }
}

export type GenerateMealPlanInput = {
  companyId: string;
  // The coach/operator running the generation (for usage metering + created context).
  generatedBy: string;
  // The client this plan is for. profileId is used to read their intake; contactId (if known) is the
  // meal_plans.contact_id FK target. These are DIFFERENT id spaces, so the caller passes both.
  clientProfileId: string;
  contactId?: string | null;
  locale: PlanLocale;
};

export type GenerateMealPlanResult =
  | { status: 'notConfigured' }
  | { status: 'noData' }
  | { status: 'error' }
  | { status: 'ok'; planId: string; embedded: boolean };

// Generate + persist one meal plan for a client. Reads their onboarding intake, retrieves the
// company's coaching knowledge, calls Sonnet in JSON mode, validates, and inserts a meal_plans row.
export async function generateMealPlan(input: GenerateMealPlanInput): Promise<GenerateMealPlanResult> {
  if (!aiConfigured()) return { status: 'notConfigured' };

  const sb = createServiceClient();

  // Member intake. maybeSingle: a client may not have onboarded yet.
  const { data: onb } = await sb
    .from('onboarding_responses')
    .select('answers, predicted_goal, computed_targets')
    .eq('profile_id', input.clientProfileId)
    .eq('company_id', input.companyId)
    .maybeSingle();

  const goal = (onb?.predicted_goal as string | null) ?? null;
  const targets = onb?.computed_targets ?? null;
  const answers = onb?.answers ?? null;
  if (!goal && !targets && !answers) return { status: 'noData' };

  // Ground the plan in Stephanie's method. Retrieval is keyed on the goal/targets summary so it pulls
  // the most relevant guidance. Key-gated inside knowledge.ts (returns [] when retrieval is unkeyed).
  const knowledgeQuery = [goal ?? '', targets ? JSON.stringify(targets) : '', 'meal plan macros nutrition']
    .filter(Boolean)
    .join(' ');
  const hits = await retrieveKnowledge(input.companyId, knowledgeQuery, 6);
  const knowledgeText = hits.map((h) => `- ${h.content}`).join('\n');

  // Their name, latest weight, and the foods they actually log - the plan is personal, not generic.
  const member = await loadMemberContext(sb, input.companyId, input.clientProfileId);

  let parsed: ParsedPlan | null = null;
  let usage: Usage = {};
  try {
    const res = await callJson({
      models: [PLAN_MODEL],
      timeoutMs: 120_000, // flagship reasoning on a rare, coach-triggered path
      messages: [
        { role: 'system', content: PLAN_SYSTEM },
        { role: 'user', content: buildUserPrompt(goal, targets, answers, knowledgeText, input.locale, member) },
      ],
      // fire: the inference id has no consumer (plans are reviewed, not corrected field-by-field).
      // ai_usage_log token metering below stays untouched; metering and audit are separate lifecycles.
      provenance: {
        feature: 'plan-gen',
        promptVersion: PROMPT_VERSION,
        companyId: input.companyId,
        profileId: input.clientProfileId,
        mode: 'fire',
      },
    });
    if (res.status !== 'ok') return { status: 'error' };
    usage = { prompt_tokens: res.usage.promptTokens, completion_tokens: res.usage.completionTokens };
    parsed = parsePlan(res.content);
  } catch {
    return { status: 'error' };
  }
  if (!parsed) return { status: 'error' };

  void logUsage(input.companyId, input.generatedBy, usage);

  const split = normalizeSplit(parsed);

  // The full structured plan (same shape the builder authors + the client/coach render). camelCase to
  // match src/lib/coach/meal-plan-structured.ts; parseStructuredPlan normalizes it again on read.
  const structured = {
    goal: parsed.goal || null,
    calorieTarget: parsed.calorie_goal,
    macros: { proteinG: parsed.protein_g, carbG: parsed.carb_g, fatG: parsed.fat_g },
    macroSplit: { proteinPct: split.protein, carbPct: split.carb, fatPct: split.fat },
    intro: parsed.intro || null,
    slots: parsed.slots.map((s) => ({
      name: s.name,
      kcalTarget: s.kcal_target ?? null,
      recipes: s.recipes.map((r) => ({
        title: r.title,
        prepMin: r.prep_min ?? null,
        cookMin: r.cook_min ?? null,
        kcal: r.kcal ?? null,
        macros: { proteinG: r.protein_g, carbG: r.carb_g, fatG: r.fat_g },
        ingredients: r.ingredients.map((i) => ({ qty: i.qty ?? '', item: i.item })),
        spices: r.spices.map((i) => ({ qty: i.qty ?? '', item: i.item })),
        note: r.note || null,
        steps: r.steps,
      })),
    })),
  };
  // A provenance marker + the caveat (the client note comes from coach_note -> meal_plans.notes).
  const planJsonb = { generated_by: 'ai', caveat: planCaveat(input.locale) };

  // NOTE: meal_plans.protein_g / carb_g / fat_g are GENERATED ALWAYS columns, computed by Postgres
  // from calorie_goal * split_*_pct (protein/carb at 4 kcal/g, fat at 9). We must NOT write them
  // directly (the insert would error). We instead drive them through calorie_goal + the normalized
  // split percentages, which reproduce the model's gram targets as closely as the formula allows.
  const { data: inserted, error } = await sb
    .from('meal_plans')
    .insert({
      company_id: input.companyId,
      contact_id: input.contactId ?? null,
      name: parsed.name,
      calorie_goal: parsed.calorie_goal,
      split_protein_pct: split.protein,
      split_carb_pct: split.carb,
      split_fat_pct: split.fat,
      num_meal_groups: parsed.slots.length,
      is_template: false,
      structured,
      notes: parsed.coach_note || null,
      plan_jsonb: planJsonb,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    console.error('generateMealPlan insert:', error?.message);
    return { status: 'error' };
  }

  return { status: 'ok', planId: (inserted as { id: string }).id, embedded: hits.length > 0 };
}
