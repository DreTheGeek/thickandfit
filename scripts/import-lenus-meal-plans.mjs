// Bring her meal plans up to date: 103 published plans, 1,265 meals, 5,717 ingredients.
//
// meal_plans held 157 rows stopping on 2 July, while she kept writing and publishing plans into
// August. 17 were published after the cutoff and none of them were here. The plan document is the
// deliverable she is paid for, so a client whose plan was written in July had, in this app, no plan.
//
// FULL CONTENT, not just the header. Each row carries the meal groups, every meal, its macros, its
// ingredients with gram amounts and her printed portions ("35g (1/4 pc)"), the procedure, prep and
// cooking times and her spice list, in plan_jsonb. That is what makes it a plan rather than a
// calorie target.
//
// CALORIES ARE DERIVED, and deliberately so. The Lenus Nutrients type has no energy field at all;
// its UI computes kcal from the macros. We do the same (4/4/9) rather than storing a number the
// source never gave us, and the plan-level calorie_goal comes from her own
// calorieGoalForProfile, which IS a stated figure.
//
// The `structured` column is NOT touched: it holds the app meal-plan builder's own {goal, slots}
// shape and only 3 rows use it. Lenus content goes in plan_jsonb, where the other 156 migrated
// plans already live.
//
// IDEMPOTENT on (company_id, lenus_id), the unique index meal_plans already carries.
//
// Run: node scripts/import-lenus-meal-plans.mjs [--apply]

import { readFileSync } from 'node:fs';
import { makeSql, runBatched } from './lib/mgmt-sql.mjs';

const APPLY = process.argv.includes('--apply');
const SRC = '.capture/sweep/lenus-meal-plans.json';
const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';

const sql = makeSql();
const lit = (v) =>
  v === null || v === undefined || v === '' ? 'null'
  : typeof v === 'number' ? String(v)
  : typeof v === 'boolean' ? String(v)
  : `'${String(v).replace(/'/g, "''")}'`;
const jlit = (o) => (o == null ? 'null' : `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`);
const iso = (ms) => (ms ? new Date(ms).toISOString() : null);
const r1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null);

/** Atwater factors, the same arithmetic the Lenus UI does to show a meal's calories. */
const kcalOf = (n) => {
  if (!n) return null;
  const p = Number(n.protein) || 0;
  const c = Number(n.carbohydrate) || 0;
  const f = Number(n.fat) || 0;
  return Math.round(p * 4 + c * 4 + f * 9);
};

const doc = JSON.parse(readFileSync(SRC, 'utf8'));
const contacts = sql(`select id, lenus_id from contacts where company_id = '${COMPANY}' and lenus_id is not null`);
const byLenus = new Map(contacts.map((c) => [c.lenus_id, c.id]));

const statements = [];
const stat = { plans: 0, meals: 0, ingredients: 0, noContact: 0, sinceCutoff: 0 };
const CUTOFF = Date.parse('2026-07-02T00:00:00Z');

for (const p of Object.values(doc.plans || {})) {
  const contactId = byLenus.get(p.pid);
  if (!contactId) { stat.noContact += 1; continue; }

  const groups = (p.mealGroups || []).map((g) => ({
    id: g.mealGroupId,
    meals: (g.meals || []).map((m) => {
      stat.meals += 1;
      stat.ingredients += (m.ingredients || []).length;
      return {
        id: m.id,
        name: m.name,
        kcal: kcalOf(m.nutrients),
        protein: r1(m.nutrients?.protein),
        carb: r1(m.nutrients?.carbohydrate),
        fat: r1(m.nutrients?.fat),
        procedure: m.procedure || null,
        comment: m.comment || null,
        prepTime: m.prepTime ?? null,
        cookingTime: m.cookingTime ?? null,
        tags: m.tags ?? null,
        scale: m.scale ?? null,
        // amountPrint is her own portion wording ("35g (1/4 pc)"). The gram figure alone loses the
        // household measure a client actually uses in her kitchen.
        ingredients: (m.ingredients || []).map((x) => ({
          foodId: x.foodId,
          name: x.name,
          amount: x.amount,
          print: x.amountPrint,
          unitLabel: x.unitLabel,
          unitSize: x.unitSize,
          protein: r1(x.nutrients?.protein),
          carb: r1(x.nutrients?.carbohydrate),
          fat: r1(x.nutrients?.fat),
        })),
        spices: (m.spices || []).map((s) => ({ name: s.spiceName, unit: s.spiceUnit, amount: s.amount })),
      };
    }),
  }));

  // protein_g / carb_g / fat_g are GENERATED columns: round(calorie_goal * split_pct / 100 / 4|9).
  // Writing grams directly is rejected by Postgres, so the split PERCENTAGES are what this stores,
  // derived from the calories her own meals actually contain. One meal per group is taken, since a
  // group offers variations of the same slot and summing them would double-count breakfast.
  const oneEach = groups.map((g) => g.meals[0]).filter(Boolean);
  const t = oneEach.reduce(
    (a, m) => ({ p: a.p + (m.protein ?? 0), c: a.c + (m.carb ?? 0), f: a.f + (m.fat ?? 0) }),
    { p: 0, c: 0, f: 0 },
  );
  const kcalTotal = t.p * 4 + t.c * 4 + t.f * 9;
  const pct = (grams, factor) => (kcalTotal > 0 ? Math.round((grams * factor * 100) / kcalTotal) : null);

  if (p.publishedAt && p.publishedAt > CUTOFF) stat.sinceCutoff += 1;
  stat.plans += 1;
  statements.push(
    `insert into meal_plans (company_id, lenus_id, contact_id, name, is_template, calorie_goal,
        num_meal_groups, split_protein_pct, split_carb_pct, split_fat_pct, plan_jsonb, updated_at)
     values (${lit(COMPANY)}, ${lit(p.planId)}, ${lit(contactId)}, ${lit(p.name || 'Meal plan')}, false,
             ${lit(Number.isFinite(p.kcal) ? Math.round(p.kcal) : null)}, ${groups.length},
             ${lit(pct(t.p, 4))}, ${lit(pct(t.c, 4))}, ${lit(pct(t.f, 9))},
             ${jlit({ source: 'lenus', publishedAt: iso(p.publishedAt), mealGroups: groups })},
             ${lit(iso(p.publishedAt) || new Date().toISOString())})
     on conflict (company_id, lenus_id)
     do update set contact_id = excluded.contact_id, name = excluded.name,
                   calorie_goal = excluded.calorie_goal, num_meal_groups = excluded.num_meal_groups,
                   split_protein_pct = excluded.split_protein_pct, split_carb_pct = excluded.split_carb_pct,
                   split_fat_pct = excluded.split_fat_pct,
                   plan_jsonb = excluded.plan_jsonb, updated_at = excluded.updated_at;`,
  );
}

console.log(`plans ${stat.plans} (published after 2 Jul: ${stat.sinceCutoff}) | meals ${stat.meals} | ingredients ${stat.ingredients}`);
if (stat.noContact) console.log(`skipped, no matching contact: ${stat.noContact}`);

if (!APPLY) {
  console.log(`\nDRY RUN. ${statements.length} statements, nothing written. Re-run with --apply.`);
  process.exit(0);
}

runBatched(sql, 'meal plans', statements, { maxChars: 5000, onProgress: (d, t) => { if (d % 25 < 3) console.log(`  ${d}/${t}`); } });

const after = sql(
  `select count(*) n, count(plan_jsonb) with_content, max(updated_at)::date newest from meal_plans where company_id = '${COMPANY}'`,
);
console.log(`meal_plans now ${after[0].n} (${after[0].with_content} with content), newest ${after[0].newest}`);
