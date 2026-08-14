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
// SHIPPED OFF. Absent STARTER_MEAL_PLAN_ID = off, the same shape as STARTER_PROGRAM_ID and
// NEXT_PUBLIC_SCAN_AUTO_ACCEPT. Turning it on changes what a paying member receives on day one, so
// it is a decision someone makes on purpose, in Vercel, without a deploy.
//
// A COPY, NOT A POINTER. meal_plans rows carry their own content and a template is
// (is_template: true, contact_id: null); an assignment is the same shape with contact_id set. That
// is how saveAsTemplateAction already works in the other direction, and copying is what lets the
// coach edit HER plan afterwards without editing the template for everyone else.
import { createServiceClient } from '@/lib/supabase/service';
import { ensureCrmContactFromProfile } from '@/lib/crm/ensure-contact';
import { normalizeTier, tierGetsMealPlan, type CheckoutTier } from '@/lib/billing/tiers';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AutoAssignMealPlanResult =
  | { status: 'off' }
  | { status: 'tier_excluded'; tier: CheckoutTier }
  | { status: 'assigned'; mealPlanId: string }
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
): Promise<AutoAssignMealPlanResult> {
  const templateId = (process.env.STARTER_MEAL_PLAN_ID ?? '').trim();
  if (!templateId) return { status: 'off' };
  if (!UUID.test(templateId)) {
    // Loud, because a typo means every paying member silently gets nothing and the failure looks
    // exactly like the feature being switched off.
    console.error('autoAssignStarterMealPlan: STARTER_MEAL_PLAN_ID is not a uuid, ignoring');
    return { status: 'bad_config', reason: 'not_a_uuid' };
  }
  if (!tierGetsMealPlan(tier)) return { status: 'tier_excluded', tier: normalizeTier(tier) };

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
