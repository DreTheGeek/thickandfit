// AI meal-plan generation. SERVER-ONLY.
// Given a client's onboarding intake (answers + predicted_goal + computed_targets) and the company's
// documented coaching knowledge, ask claude-sonnet-4-6 (JSON mode, same pattern as insights.ts
// extractNarrative) to draft a structured meal plan, then insert a meal_plans row the coach Meal Plans
// library already renders (typed macro columns + a plan_jsonb subset getMealPlanDetail parses).
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

const apiKey = process.env.OPENROUTER_API_KEY;

// Quality tier for generation (low volume). Same model + JSON-mode pattern as the nightly insights.
const PLAN_MODEL = 'anthropic/claude-sonnet-4-6';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export type PlanLocale = 'en' | 'es';

export function isPlanGenConfigured(): boolean {
  return Boolean(apiKey);
}

// --- The model output shape (validated before any write) --------------------
const MealGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  number_of_meals: z.number().int().min(1).max(12),
  example_items: z.array(z.string().trim().min(1).max(120)).max(8).optional().default([]),
});

const PlanSchema = z.object({
  name: z.string().trim().min(1).max(120),
  calorie_goal: z.number().int().min(800).max(6000),
  protein_g: z.number().int().min(0).max(600),
  carb_g: z.number().int().min(0).max(900),
  fat_g: z.number().int().min(0).max(400),
  split_protein_pct: z.number().int().min(0).max(100),
  split_carb_pct: z.number().int().min(0).max(100),
  split_fat_pct: z.number().int().min(0).max(100),
  macro_timing_name: z.string().trim().max(80).optional().default(''),
  meal_groups: z.array(MealGroupSchema).min(1).max(6),
});

type ParsedPlan = z.infer<typeof PlanSchema>;

const PLAN_SYSTEM = [
  "You are coach Stephanie's meal-planning assistant for a bilingual (English/Spanish) fitness app.",
  'Given a member intake and her documented coaching method, produce ONE structured meal plan.',
  'Return ONLY minified JSON of this exact shape, no prose, no markdown fences:',
  '{"name":string,"calorie_goal":int,"protein_g":int,"carb_g":int,"fat_g":int,',
  '"split_protein_pct":int,"split_carb_pct":int,"split_fat_pct":int,"macro_timing_name":string,',
  '"meal_groups":[{"name":string,"number_of_meals":int,"example_items":[string]}]}',
  'Rules:',
  '- Honor the member computed_targets when present (calories + protein/carb/fat grams). If absent,',
  '  pick sensible targets for the stated goal. Macros must roughly sum to the calorie goal at',
  '  4 kcal/g protein, 4 kcal/g carb, 9 kcal/g fat.',
  '- split_*_pct are the percent of total calories from each macro and should sum to about 100.',
  '- Keep meal_groups to 3-5 (e.g. Breakfast, Lunch, Dinner, Snacks). number_of_meals is how many',
  '  options that group offers. example_items are 2-4 short real food examples per group.',
  "- Name the plan for the member's goal. Reply in the member's language for all human-readable text",
  '  (name, group names, example items).',
  '- Ground choices in the coaching method provided; do not invent medical claims.',
  '',
  SAFETY_CLAUSE_EN,
].join('\n');

type Usage = { prompt_tokens?: number; completion_tokens?: number };

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Recompute macro split percentages from grams + calorie goal, so what we store is internally
// consistent even if the model's split_*_pct drift. Falls back to the model's values if we cannot.
function normalizeSplit(p: ParsedPlan): { protein: number; carb: number; fat: number } {
  const pK = p.protein_g * 4;
  const cK = p.carb_g * 4;
  const fK = p.fat_g * 9;
  const total = pK + cK + fK;
  if (total <= 0) {
    return { protein: p.split_protein_pct, carb: p.split_carb_pct, fat: p.split_fat_pct };
  }
  return {
    protein: Math.round((pK / total) * 100),
    carb: Math.round((cK / total) * 100),
    fat: Math.round((fK / total) * 100),
  };
}

function buildUserPrompt(
  goal: string | null,
  targets: unknown,
  answers: unknown,
  knowledge: string,
  locale: PlanLocale,
): string {
  return [
    `Language: ${locale === 'es' ? 'Spanish' : 'English'}`,
    `Member goal: ${goal ?? 'not set'}`,
    `Computed targets: ${targets ? JSON.stringify(targets) : 'not set'}`,
    `Intake answers: ${answers ? JSON.stringify(answers).slice(0, 2000) : 'none'}`,
    '',
    'Coaching method (ground the plan in this; empty means use general best practice):',
    knowledge || '(none provided yet)',
  ].join('\n');
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
  if (!apiKey) return { status: 'notConfigured' };

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

  let parsed: ParsedPlan | null = null;
  let usage: Usage = {};
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: PLAN_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PLAN_SYSTEM },
          { role: 'user', content: buildUserPrompt(goal, targets, answers, knowledgeText, input.locale) },
        ],
      }),
    });
    if (!res.ok) return { status: 'error' };
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: Usage;
    };
    usage = json.usage ?? {};
    const raw = json?.choices?.[0]?.message?.content?.trim();
    if (!raw) return { status: 'error' };
    parsed = parsePlan(raw);
  } catch {
    return { status: 'error' };
  }
  if (!parsed) return { status: 'error' };

  void logUsage(input.companyId, input.generatedBy, usage);

  const split = normalizeSplit(parsed);

  // plan_jsonb: only the minimal subset getMealPlanDetail reads (mealGroups[].name + numberOfMeals),
  // plus the example items + a generated_by marker for provenance. NOT the full Lenus GraphQL shape.
  const planJsonb = {
    name: parsed.name,
    generated_by: 'ai',
    // The model's intended macro grams, kept for reference. The meal_plans.protein_g/carb_g/fat_g
    // columns are GENERATED from calorie_goal + split_*_pct, so they may differ by a gram or two; this
    // preserves what the model actually intended.
    targetMacros: { proteinG: parsed.protein_g, carbG: parsed.carb_g, fatG: parsed.fat_g },
    mealGroups: parsed.meal_groups.map((g) => ({
      name: g.name,
      numberOfMeals: g.number_of_meals,
      exampleItems: g.example_items ?? [],
    })),
    caveat: planCaveat(input.locale),
  };

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
      macro_timing_name: parsed.macro_timing_name || null,
      num_meal_groups: parsed.meal_groups.length,
      is_template: false,
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
