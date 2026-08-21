import 'server-only';
// Give a paying member her meal plan the moment she finishes onboarding.
//
// THE PROMISE THIS KEEPS. 2026-08-13, on the tiers that include nutrition: "You sign in, this is
// what you're trying to do, you pay the higher tier, here's your meal plan. Steph don't have to do
// anything." Nothing in the app did that. Onboarding's after() block sent the welcome email, seeded
// the intro message, assigned a check-in and (once configured) a training program — and no meal
// plan, ever, on any tier. A woman paying for nutrition coaching got a macro target and an empty
// plan tab until a human opened the console.
//
// TIER-GATED, unlike the training program. Everyone gets a starting program; a meal plan is what
// the higher tiers are partly FOR, and handing one to a self-guided member both gives away the
// upsell and tells her something about her purchase that is not true.
//
// IT IS GENERATED NOW, NOT COPIED, and the reason is that there was nothing to copy. This module
// waited on somebody naming a STARTER_MEAL_PLAN_ID, and the answer to "which of her 248 meal plans
// should a new member start on" turned out to be NONE OF THEM. All 248 came across from Lenus
// written for one named client, at that client's calorie goal, with her name in the title. Exactly
// one carried is_template and it was "Shelise - Meal Plan 2 (2200 kcal)": a real client's plan,
// promoted by mistake. Handing a stranger a plan with another member's name on it is a privacy
// problem rather than merely a wrong number, so that flag is cleared and the library now holds zero
// templates, correctly.
//
// So the default path is lib/coach-ai/plan-gen.ts, which already existed and already does the right
// thing: it reads HER intake, retrieves Stephanie's documented method from the knowledge base, and
// writes a plan in her structure (kcal-budgeted slots, raw-weight ingredients, her free-veggie
// note) at the calorie target this member's own onboarding computed. A generated plan is built for
// her; a copied template is somebody else's plan with the name swapped.
//
// STARTER_MEAL_PLAN_ID SURVIVES AS AN OVERRIDE, for the day she writes real templates and wants
// everybody on one. Same shape as STARTER_PROGRAM_ID.
//
// STILL OFF WITHOUT A KEY. generateMealPlan returns notConfigured with no OPENROUTER_API_KEY and
// writes nothing, so this degrades to exactly its old behaviour rather than erroring.
//
// A COPY, NOT A POINTER. meal_plans rows carry their own content and a template is
// (is_template: true, contact_id: null); an assignment is the same shape with contact_id set. That
// is how saveAsTemplateAction already works in the other direction, and copying is what lets the
// coach edit HER plan afterwards without editing the template for everyone else.
import { createServiceClient } from '@/lib/supabase/service';
import { ensureCrmContactFromProfile } from '@/lib/crm/ensure-contact';
import { normalizeTier, tierGetsMealPlan, type CheckoutTier } from '@/lib/billing/tiers';
import { generateMealPlan } from '@/lib/coach-ai/plan-gen';
import { getCompanyCoach } from '@/lib/tenant/owner';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AutoAssignMealPlanResult =
  | { status: 'off' }
  | { status: 'tier_excluded'; tier: CheckoutTier }
  | { status: 'assigned'; mealPlanId: string }
  | { status: 'generated'; mealPlanId: string }
  | { status: 'no_intake' }
  | { status: 'already_has_plan' }
  | { status: 'no_contact' }
  | { status: 'bad_config'; reason: string }
  | { status: 'error' };

/** Columns copied from the template. Everything else is identity or timestamps. */
type TemplateRow = {
  id: string;
  company_id: string;
  name: string;
  notes: string | null;
  calorie_goal: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
  split_protein_pct: number | null;
  split_carb_pct: number | null;
  split_fat_pct: number | null;
  macro_timing_name: string | null;
  num_meal_groups: number | null;
  plan_jsonb: unknown;
  structured: unknown;
};

const TEMPLATE_COLUMNS =
  'id, company_id, name, notes, calorie_goal, protein_g, carb_g, fat_g, split_protein_pct, split_carb_pct, split_fat_pct, macro_timing_name, num_meal_groups, plan_jsonb, structured';

/**
 * Copy the configured starter meal plan onto her record, if her tier includes one and she has none.
 *
 * Never overrides a coach. A member who already holds any meal plan is left alone, for the same
 * reason autoAssignStarterProgram skips one: the coach having chosen something is the whole point of
 * the manual path, and stomping it is worse than the gap this closes.
 */
export async function autoAssignStarterMealPlan(
  companyId: string,
  profileId: string,
  tier: unknown,
  /** Her language, so a Spanish-speaking member is not handed an English meal plan on day one. */
  locale: 'en' | 'es' = 'en',
): Promise<AutoAssignMealPlanResult> {
  // TIER FIRST, before any work at all. A self-guided member is not getting a meal plan whether or
  // not one could be built, and the cheapest way to honour that is to never look.
  if (!tierGetsMealPlan(tier)) return { status: 'tier_excluded', tier: normalizeTier(tier) };

  const templateId = (process.env.STARTER_MEAL_PLAN_ID ?? '').trim();
  if (templateId && !UUID.test(templateId)) {
    // Loud, because a typo means every paying member silently gets nothing and the failure looks
    // exactly like the feature being switched off.
    console.error('autoAssignStarterMealPlan: STARTER_MEAL_PLAN_ID is not a uuid, ignoring');
    return { status: 'bad_config', reason: 'not_a_uuid' };
  }

  const svc = createServiceClient();

  // meal_plans is contact-keyed only — there is no profile_id on the table — so a native signup
  // needs her CRM row to exist before she can hold a plan at all. Best-effort and idempotent.
  await ensureCrmContactFromProfile(profileId);
  const { data: contact, error: contactErr } = await svc
    .from('contacts')
    .select('id')
    .eq('company_id', companyId)
    .eq('profile_id', profileId)
    .maybeSingle();
  if (contactErr) {
    console.error('autoAssignStarterMealPlan contact:', contactErr.message);
    return { status: 'error' };
  }
  const contactId = (contact as { id: string } | null)?.id ?? null;
  if (!contactId) return { status: 'no_contact' };

  // Checked BEFORE either path does its work. Generation is a flagship model call, and running one
  // for a member who already has a plan would burn real money and, worse, race the coach's own.
  const { data: existing, error: existingErr } = await svc
    .from('meal_plans')
    .select('id')
    .eq('company_id', companyId)
    .eq('contact_id', contactId)
    .limit(1);
  if (existingErr) {
    console.error('autoAssignStarterMealPlan existing:', existingErr.message);
    return { status: 'error' };
  }
  if ((existing ?? []).length > 0) return { status: 'already_has_plan' };

  // ------------------------------------------------------------------ the default: build her one
  if (!templateId) {
    // generatedBy is the metering and attribution id, so it has to be a real person in this
    // company. The owner, because this is the company acting rather than any individual coach.
    const coach = await getCompanyCoach(companyId);
    if (!coach) {
      console.error('autoAssignStarterMealPlan: no company owner to attribute generation to');
      return { status: 'error' };
    }
    const gen = await generateMealPlan({
      companyId,
      generatedBy: coach.id,
      clientProfileId: profileId,
      contactId,
      locale,
    });
    if (gen.status === 'ok') return { status: 'generated', mealPlanId: gen.planId };
    // notConfigured: no OPENROUTER_API_KEY, so this degrades to exactly the behaviour it had before
    // generation existed rather than erroring. noData: she has no onboarding row to build from,
    // which only a human can resolve.
    if (gen.status === 'notConfigured') return { status: 'off' };
    if (gen.status === 'noData') return { status: 'no_intake' };
    return { status: 'error' };
  }

  // --------------------------------------------------------- the override: copy a real template
  // The template must exist AND belong to this company. The service client bypasses RLS and the
  // tenant predicate on several policies is weaker than it looks (.planning/RLS-TENANT-BOUNDARY.md),
  // so a mistyped id must not be able to hand a member another company's nutrition.
  const { data: template, error: templateErr } = await svc
    .from('meal_plans')
    .select(TEMPLATE_COLUMNS)
    .eq('id', templateId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (templateErr) {
    console.error('autoAssignStarterMealPlan template:', templateErr.message);
    return { status: 'error' };
  }
  if (!template) {
    console.error(`autoAssignStarterMealPlan: plan ${templateId} not found in company ${companyId}`);
    return { status: 'bad_config', reason: 'plan_not_in_company' };
  }

  const t = template as unknown as TemplateRow;
  const { data: created, error } = await svc
    .from('meal_plans')
    .insert({
      company_id: companyId,
      contact_id: contactId,
      // contact_id set + is_template false is what makes this HER plan rather than a library row.
      is_template: false,
      name: t.name,
      notes: t.notes,
      calorie_goal: t.calorie_goal,
      protein_g: t.protein_g,
      carb_g: t.carb_g,
      fat_g: t.fat_g,
      split_protein_pct: t.split_protein_pct,
      split_carb_pct: t.split_carb_pct,
      split_fat_pct: t.split_fat_pct,
      macro_timing_name: t.macro_timing_name,
      num_meal_groups: t.num_meal_groups,
      plan_jsonb: t.plan_jsonb as never,
      structured: t.structured as never,
    })
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('autoAssignStarterMealPlan insert:', error.message);
    return { status: 'error' };
  }
  return { status: 'assigned', mealPlanId: (created as { id: string } | null)?.id ?? templateId };
}
